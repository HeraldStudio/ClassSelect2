const control = require('./control')
const db = require('./db')
const { Mutex } = require('await-semaphore')
const mutex = new Mutex()
const data = require('./data.json')

const composedClassList = data.groupGroups.map((gg, ggid) => {
  gg.groups = data.groups.map((k, gid) => {
    k.gid = gid
    return k
  }).filter(k => {
    return k.ggid === ggid
  }).map(g => {
    g.classes = data.classes.map((c, cid) => {
      c.cid = cid
      return c
    }).filter(c => c.gid === g.gid)
    return g
  })
  return gg
})

const userInfo = async (ctx) => {
  if (!ctx.params.token) {
    ctx.throw(401, '需要登录')
  }
  let user = await db.user.find({ token: ctx.params.token }, 1)
  if (!user) {
    ctx.throw(403, '登录无效或已过期，请重新登录')
  }
  return user
}

exports.route = {
  async get() {
    if (control.state === 2) {
      this.throw(404, '选课已结束，具体开课信息请留意东南大学学生事务服务中心微信推送！')
    }
    if (control.state === 0) {
      this.throw(404, '选课尚未开放')
    }
    let user = await userInfo(this)
    return await Promise.all(composedClassList.map(async gg => {
      gg.groups = await Promise.all(gg.groups.map(async g => {
        g.classes = await Promise.all(g.classes.map(async c => {
          c.count = await db.selection.count('*', { cid: c.cid })
          c.selected = await db.selection.count('*', { cid: c.cid, cardnum: user.cardnum }) > 0
          return c
        }))
        return g
      }))
      return gg
    }))
  },

  async post() {
    if (control.state === 2) {
      this.throw(404, '选课已结束，具体开课信息请留意东南大学学生事务服务中心微信推送！')
    }
    if (control.state === 0) {
      this.throw(404, '选课尚未开放')
    }

    let { cid } = this.params
    let user = await userInfo(this)
    let clazz = data.classes[cid]
    if (!clazz) {
      this.throw(404, '课程不存在')
    }

    await mutex.use(async () => {
      let selected = await db.selection.find({ cardnum: user.cardnum, cid }, 1)
      if (selected) {
        this.throw(409, '该课程已经选择！')
      }
      if (clazz.capacity > 0) {
        let count = await db.selection.count('*', { cid })
        if (count >= clazz.capacity) {
          this.throw(409, '课程名额已满')
        }
      }

      let group = data.groups[clazz.gid]
      if (!group) {
        this.throw(404, '课程方向不存在')
      }
      if (group.maxSelect > 0) {
        let count = await db.selection.count('*', { cardnum: user.cardnum, gid: clazz.gid })
        if (count >= group.maxSelect) {
          this.throw(409, `${group.name}内最多选择 ${group.maxSelect} 门课程，请先退选不需要的课程！`)
        }
      }

      let groupGroup = data.groupGroups[group.ggid]
      if (!groupGroup) {
        this.throw(404, '课程大类不存在')
      }
      if (groupGroup.maxSelect > 0) {
        let count = await db.selection.count('gid', { cardnum: user.cardnum, ggid: group.ggid })
        if (count >= groupGroup.maxSelect) {
          this.throw(409, `${groupGroup.name}内最多选择 ${group.maxSelect} 个方向的课程，请先退选不需要的课程！`)
        }
      }

      let now = Date.now()

      await db.selection.insert({
        cardnum: user.cardnum,
        cid: cid,
        gid: clazz.gid,
        ggid: group.ggid,
        time: now
      })
    })

    return '添加课程成功，选课结果请以最终公布名单为准'
  },

  async delete() {
    if (control.state === 2) {
      this.throw(404, '选课已结束，具体开课信息请留意东南大学学生事务服务中心微信推送！')
    }
    if (control.state === 0) {
      this.throw(404, '选课尚未开放')
    }

    let { cid } = this.params
    let user = await userInfo(this)

    await mutex.use(async () => {
      let sel = await db.selection.find({ cardnum: user.cardnum, cid }, 1)
      if (!sel) {
        this.throw(404, '未选择该课程！')
      }

      await db.selection.remove({ cardnum: user.cardnum, cid })
    })

    return '取消课程成功'
  }
}
