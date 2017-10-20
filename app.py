import json
from uuid import uuid4

import time

import tornado
import tornado.ioloop
import tornado.options
from sqlalchemy.orm import scoped_session, sessionmaker
from tornado.options import define, options
from tornado.web import RequestHandler

from db import User, ClassGroupGroup, ClassGroup, Class, Selection, Log, engine


class BaseHandler(RequestHandler):
    @property
    def db(self):
        return self.application.db

    def on_finish(self):
        self.db.close()

    def write_json(self, trunk):
        self.write(json.dumps(trunk, ensure_ascii=False))

    def finish_success(self, trunk):
        self.write_json({
            'content':  trunk,
            'code':     200
        })
        self.finish()

    def finish_err(self, code, reason):
        self.write_json({
            'content': reason,
            'code': code
        })
        self.finish()


class LoginHandler(BaseHandler):

    # 用户登录
    async def post(self):
        try:
            cardnum = self.get_argument('cardnum')
            schoolnum = self.get_argument('schoolnum')
            user = self.db.query(User).filter(User.cardnum == cardnum, User.schoolnum == schoolnum).one()
            token = str(uuid4().hex)
            user.token = token
            self.db.commit()
            self.finish_success(token)
        except:
            self.db.rollback()
            self.finish_err(401, u'一卡通号或学号不正确')


class ClassSelectHandler(BaseHandler):

    # 静态缓存，每次运行只写一次，永不刷新
    group_groups_cache = None

    # 列举课程
    async def get(self):
        if ClassSelectHandler.group_groups_cache:
            self.finish_success(ClassSelectHandler.group_groups_cache)
        else:
            try:
                group_groups_json = []
                group_groups = self.db.query(ClassGroupGroup).all()
                for group_group in group_groups:
                    group_group_json = {
                        'ggid': group_group.ggid,
                        'name': group_group.name,
                        'max_select': group_group.max_select
                    }
                    groups_json = []
                    groups = self.db.query(ClassGroup).filter(ClassGroup.ggid == group_group.ggid).all()
                    for group in groups:
                        classes = self.db.query(Class).filter(Class.gid == group.gid).all()
                        group_json = {
                            'gid': group_group.gid,
                            'name': group_group.name,
                            'max_select': group_group.max_select,
                            'classes': [{
                                'cid': clazz.cid,
                                'name': clazz.name,
                                'desc': clazz.desc,
                                'pic': clazz.pic,
                                'capacity': clazz.capacity,
                            } for clazz in classes]
                        }
                        groups_json.append(group_json)

                    group_group_json['groups'] = groups_json
                    group_groups_json.append(group_group_json)

                # 保存缓存
                ClassSelectHandler.group_groups_cache = group_groups_json
                self.finish_success(group_groups_json)
            except:
                self.db.rollback()
                self.finish_err(500, u'获取课程列表失败')

    @property
    async def user_info(self):
        token = self.get_argument('token')
        user = self.db.query(User).filter(User.token == token).one()
        return user

    async def post(self):
        # 取课程参数
        cid = self.get_argument('cid')

        try:
            # 取用户登录信息
            user = await self.user_info
        except:
            self.db.rollback()
            self.finish_err(403, u'登录无效或已过期，请重新登录')
            return

        try:
            clazz = await self.db.query(Class).filter(Class.cid == cid).one()
        except:
            self.db.rollback()
            self.finish_err(404, u'课程不存在')
            return

        # 判断该课是否满员
        count = self.db.query(Selection).filter(Selection.cid == clazz.cid).count()
        if 0 < clazz.max_select <= count:
            self.finish_err(409, u'课程名额已满')
            return

        # 判断用户是否选过该课
        count = self.db.query(Selection).filter(Selection.uid == user.uid, Selection.cid == cid).count()
        if len(count):
            self.finish_err(409, u'该课程已经选择！')
            return

        # 判断课类是否选满
        count = self.db.query(Selection).filter(Selection.uid == user.uid, Selection.gid == clazz.gid).count()
        try:
            group = self.db.query(ClassGroup).filter(ClassGroup.gid == clazz.gid).one()
        except:
            self.db.rollback()
            self.finish_err(404, u'课程类不存在')
            return
        if 0 < group.max_select <= count:
            self.finish_err(409, u'[' + group.name + u'] 内最多选择 ' + group.max_select + ' 门课程，请先退选不需要的课程！')
            return

        # 判断课类类是否选满
        count = self.db.query(Selection).filter(Selection.uid == user.uid, Selection.ggid == clazz.ggid).distinct(Selection.gid).count()
        try:
            group_group = self.db.query(ClassGroupGroup).filter(ClassGroupGroup.ggid == group.ggid).one()
        except:
            self.db.rollback()
            self.finish_err(404, u'课程大类不存在')
            return
        if 0 < group_group.max_select <= count:
            self.finish_err(409, u'[' + group_group.name + u'] 内最多选择 ' + group_group.max_select + ' 小类的课程，请先退选不需要的课程！')
            return

        # 进行选课
        try:
            sel = Selection(uid=user.uid, cid=clazz.cid, gid=clazz.gid, ggid=group.ggid, time=time.strftime('%Y-%m-%d %X', time.localtime(time.time())))
            self.db.add(sel)

            # 保存日志
            log = Log(uid=user.uid, cid=clazz.cid, operation='select')
            self.db.add(log)

            self.db.commit()
        except:
            self.db.rollback()
            self.finish_err(500, u'添加课程失败')

    async def delete(self):
        # 取课程参数
        cid = self.get_argument('cid')

        try:
            # 取用户登录信息
            user = await self.user_info
        except:
            self.db.rollback()
            self.finish_err(403, u'登录无效或已过期，请重新登录')
            return

        try:
            clazz = await self.db.query(Class).filter(Class.cid == cid).one()
        except:
            self.db.rollback()
            self.finish_err(404, u'课程不存在')
            return

        # 判断用户是否选过该课
        sel = self.db.query(Selection).filter(Selection.uid == user.uid, Selection.cid == cid).one_or_none()
        if not sel:
            self.finish_err(404, u'未选择该课程！')
            return

        # 取消选课
        try:
            self.db.delete(sel)

            # 保存日志
            log = Log(uid=user.uid, cid=clazz.cid, operation='deselect')
            self.db.add(log)

            self.db.commit()
        except:
            self.db.rollback()
            self.finish_err(500, u'取消课程失败')


define("port", default=8080, help="run on the given port", type=int)

class Application(tornado.web.Application):
    def __init__(self):
        tornado.web.Application.__init__(self, [
            (r'/login', LoginHandler), # POST
            (r'/class', ClassSelectHandler) # GET, PUT, DELETE
        ], debug=True)
        self.db = scoped_session(sessionmaker(bind=engine, autocommit=False, autoflush=True, expire_on_commit=False))


if __name__ == '__main__':
    tornado.options.parse_command_line()
    Application().listen(options.port)
    tornado.ioloop.IOLoop.instance().start()
