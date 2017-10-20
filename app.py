import json
import traceback
from uuid import uuid4
from config import isOpen

import time

import tornado
import tornado.ioloop
import tornado.options
import tornado.web
from sqlalchemy.orm import scoped_session, sessionmaker
from tornado.options import define, options
from tornado.web import RequestHandler

from db import User, ClassGroupGroup, ClassGroup, Class, Selection, Log, engine


class BaseHandler(RequestHandler):
    @property
    def db(self):
        return self.application.db

    def finish(self, chunk=None):
        self.set_header('Access-Control-Allow-Origin','*')
        self.set_header('Access-Control-Allow-Methods','POST, GET, PUT, DELETE')
        super(BaseHandler, self).finish(chunk)

    def on_finish(self):
        self.db.close()

    def write_json(self, trunk):
        self.write(json.dumps(trunk, ensure_ascii=False))

    def finish_success(self, trunk):
        self.write_json ({
            'content': trunk,
            'code': 200
        })
        self.finish()

    def options(self):
        self.finish()

    def finish_err(self, code, reason):
        self.write_json ({
            'content': reason,
            'code': code
        })
        self.finish()


class MainHandler(BaseHandler):
    # 欢迎语
    async def get(self):
        self.write(u'助学选课后端\n\nPowered by Herald Studio')
        self.finish()


class LoginHandler(BaseHandler):
    # 用户登录
    async def post(self):
        if not isOpen():
            self.finish_err(404, u'选课尚未开放')
            return

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

    @property
    async def user_info(self):
        token = self.get_argument('token')
        user = self.db.query(User).filter(User.token == token, User.token != '').one()
        return user

    # 列举课程
    async def get(self):

        try:
            # 取用户登录信息
            user = await self.user_info
        except:
            self.db.rollback()
            self.finish_err(403, u'登录无效或已过期，请重新登录')
            return

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
                        'gid': group.gid,
                        'name': group.name,
                        'max_select': group.max_select,
                        'classes': [{
                            'cid': clazz.cid,
                            'name': clazz.name,
                            'desc': clazz.desc,
                            'pic': clazz.pic,
                            'capacity': clazz.capacity,
                            'count': self.db.query(Selection).filter(Selection.cid == clazz.cid).count(),
                            'selected': self.db.query(Selection).filter(Selection.cid == clazz.cid, Selection.uid == user.uid).count() > 0
                        } for clazz in classes]
                    }
                    groups_json.append(group_json)

                group_group_json['groups'] = groups_json
                group_groups_json.append(group_group_json)

            self.finish_success(group_groups_json)
        except Exception as e:
            traceback.print_exc(e)
            self.db.rollback()
            self.finish_err(500, u'获取课程列表失败')

    async def post(self):
        # 取课程参数
        cid = int(self.get_argument('cid'))

        try:
            # 取用户登录信息
            user = await self.user_info
        except:
            self.db.rollback()
            self.finish_err(403, u'登录无效或已过期，请重新登录')
            return

        try:
            clazz = self.db.query(Class).filter(Class.cid == cid).one()
        except:
            self.db.rollback()
            self.finish_err(404, u'课程不存在')
            return

        # 判断用户是否选过该课
        count = self.db.query(Selection).filter(Selection.uid == user.uid, Selection.cid == cid).count()
        if count > 0:
            self.finish_err(409, u'该课程已经选择！')
            return

        # 判断课类是否选满
        count = self.db.query(Selection).filter(Selection.uid == user.uid, Selection.gid == clazz.gid).count()
        try:
            group = self.db.query(ClassGroup).filter(ClassGroup.gid == clazz.gid).one()
        except:
            self.db.rollback()
            self.finish_err(404, u'课程方向不存在')
            return
        if 0 < group.max_select <= count:
            self.finish_err(409, u'[' + group.name + u'] 方向内最多选择 ' + str(group.max_select) + u' 门课程，请先退选不需要的课程！')
            return

        # 判断课类类是否选满
        count = self.db.query(Selection).filter(Selection.uid == user.uid, Selection.ggid == group.ggid).distinct(
            Selection.gid).count()
        try:
            group_group = self.db.query(ClassGroupGroup).filter(ClassGroupGroup.ggid == group.ggid).one()
        except:
            self.db.rollback()
            self.finish_err(404, u'课程大类不存在')
            return
        if 0 < group_group.max_select <= count:
            self.finish_err(409, u'[' + group_group.name + u'] 大类内最多选择 ' + str(group_group.max_select) + u' 个方向的课程，请先退选不需要的课程！')
            return

        # 判断该课是否满员
        count = self.db.query(Selection).filter(Selection.cid == clazz.cid).count()
        if 0 < clazz.capacity <= count:
            self.finish_err(409, u'课程名额已满')
            return

        # 进行选课
        try:
            t = time.strftime('%Y-%m-%d %X', time.localtime(time.time()))
            sel = Selection(uid=user.uid, cid=clazz.cid, gid=clazz.gid, ggid=group.ggid, time=t)
            self.db.add(sel)

            # 保存日志
            log = Log(uid=user.uid, cid=clazz.cid, operation='select', time=t)
            self.db.add(log)

            self.db.commit()
        except:
            self.db.rollback()
            self.finish_err(500, u'添加课程失败')
            return

        self.finish_success(u'添加课程成功，选课结果请以最终公布名单为准')

    async def delete(self):
        # 取课程参数
        cid = int(self.get_argument('cid'))

        try:
            # 取用户登录信息
            user = await self.user_info
        except:
            self.db.rollback()
            self.finish_err(403, u'登录无效或已过期，请重新登录')
            return

        try:
            clazz = self.db.query(Class).filter(Class.cid == cid).one()
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
            t = time.strftime('%Y-%m-%d %X', time.localtime(time.time()))
            log = Log(uid=user.uid, cid=clazz.cid, operation='deselect', time=t)
            self.db.add(log)

            self.db.commit()
        except:
            self.db.rollback()
            self.finish_err(500, u'取消课程失败')
            return

        self.finish_success(u'取消课程成功')


class ExportHandler(BaseHandler):
    async def get(self):
        csv = u'课程号,课程,学号,一卡通号,姓名,选课时间\n'
        classes = self.db.query(Class).all()
        for clazz in classes:
            selections = self.db.query(Selection).filter(Selection.cid == clazz.cid).all()
            for selection in selections:
                user = self.db.query(User).filter(User.uid == selection.uid).one_or_none()
                if user:
                    csv += str(clazz.cid)   + ',' + \
                           clazz.name       + ',' + \
                           user.schoolnum   + ',' + \
                           user.cardnum     + ',' + \
                           user.name        + ',' + \
                           selection.time   + '\n'

        self.set_header('Content-Type', 'text/csv')
        self.write(csv.encode('gbk'))
        self.finish()


define("port", default=8087, help='run on the given port', type=int)


class Application(tornado.web.Application):
    def __init__(self):
        tornado.web.Application.__init__(self, [
            (r'/', MainHandler),  # GET
            (r'/login', LoginHandler),  # POST
            (r'/class', ClassSelectHandler),  # GET, POST, DELETE
            (r'/export', ExportHandler)  # GET
        ], debug=True)
        self.db = scoped_session(sessionmaker(bind=engine, autocommit=False, autoflush=True, expire_on_commit=False))


if __name__ == '__main__':
    tornado.options.parse_command_line()
    Application().listen(options.port)
    tornado.ioloop.IOLoop.instance().start()
