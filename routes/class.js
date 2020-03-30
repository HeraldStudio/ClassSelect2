const control = require('../control')
const db = require('../db')
const mongodb = require('../mongodb')
const { Mutex } = require('await-semaphore')
const mutex = new Mutex()
const data = require('../data.json')
const moment = require('moment')

const overlap = (allClazz, cid) => {
  let clazz = data.classes[cid]
  let flag = false
  allClazz.forEach((selected) => {
    if(clazz.weekday === selected.weekday){
      let selectedStartTime = +moment(selected.startTime, "HH:mm")
      let selectedEndTime = +moment(selected.endTime, "HH:mm")
      let clazzStartTime = +moment(clazz.startTime, "HH:mm")
      let clazzEndTime = +moment(clazz.endTime, "HH:mm")
      if(selectedStartTime < clazzStartTime){
        if(selectedEndTime > clazzStartTime) {
          flag = true
        }
      } else {
        if(selectedStartTime < clazzEndTime) {
          flag = true
        }
      }
    }
  })
  return flag
}

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
  let userCollection = await mongodb('user')
  if (!ctx.params.token) {
    ctx.throw(401, '需要登录')
  }
  //let user = await db.user.find({ token: ctx.params.token }, 1)
  let user = await userCollection.findOne({ token: ctx.params.token })
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
    let selectionCollection = await mongodb('selection')
    return await Promise.all(composedClassList.map(async gg => {
      gg.groups = await Promise.all(gg.groups.map(async g => {
        g.classes = await Promise.all(g.classes.map(async c => {
          c.count = await selectionCollection.countDocuments({ cid: c.cid })
          c.selected = (await selectionCollection.countDocuments({ cid: c.cid, cardnum: user.cardnum })) > 0
          if(c.selected) {
            let classDocument = await selectionCollection.findOne({ cid: c.cid, cardnum: user.cardnum })
            c.canDelete = classDocument.canDelete
          }
          //c.count = await db.selection.count('*', { cid: c.cid })
          //c.selected = await db.selection.count('*', { cid: c.cid, cardnum: user.cardnum }) > 0
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
    let user = await userInfo(this)
    if (user.cardnum === '101012413' ){
      this.throw(404, '王老师不需要选课哦～')
    }
    let selectionCollection = await mongodb('selection')
    let { cid } = this.params
    cid = parseInt(cid)
    let clazz = data.classes[cid]
    if (!clazz) {
      this.throw(404, '课程不存在')
    }

    await mutex.use(async () => {
      //let selected = await db.selection.find({ cardnum: user.cardnum, cid }, 1)
      let selected = await selectionCollection.findOne({ cardnum: user.cardnum, cid })
      if (selected) {
        this.throw(409, '该课程已经选择！')
      }
      if (clazz.capacity > 0) {
        let count = await selectionCollection.countDocuments({ cid })
        //let count = await db.selection.count('*', { cid })
        if (count >= clazz.capacity) {
          this.throw(409, '课程名额已满')
        }
      }

      let group = data.groups[clazz.gid]
      if (!group) {
        this.throw(404, '课程方向不存在')
      }
      if (group.maxSelect > 0) {
        let count = await selectionCollection.countDocuments({ cardnum: user.cardnum, gid: clazz.gid })
        //let count = await db.selection.count('*', { cardnum: user.cardnum, gid: clazz.gid })
        if (count >= group.maxSelect) {
          this.throw(409, `${group.name}内最多选择 ${group.maxSelect} 门课程，请先退选不需要的课程！`)
        }
      }

      let groupGroup = data.groupGroups[group.ggid]
      if (!groupGroup) {
        this.throw(404, '课程大类不存在')
      }

      if (groupGroup.maxSelect > 0) {
        let count = (await selectionCollection.distinct('gid', { cardnum: user.cardnum, ggid: group.ggid })).length
        //let count = await db.selection.count('gid', { cardnum: user.cardnum, ggid: group.ggid })
        if (count >= groupGroup.maxSelect) {
          this.throw(409, `${groupGroup.name}内最多选择 ${groupGroup.maxSelect} 个方向的课程，请先退选不需要的课程！`)
        }
      }

      let allClazz = await selectionCollection.find({cardnum: user.cardnum}).toArray()// 列出所有已选课程
      if(overlap(allClazz, cid)){
        this.throw(409, '选课时间存在冲突，请先退选时间冲突课程')
      }

      let now = Date.now()

      // await db.selection.insert({
      //   cardnum: user.cardnum,
      //   cid: cid,
      //   gid: clazz.gid,
      //   ggid: group.ggid,
      //   time: now
      // })

      await selectionCollection.insertOne({
        cardnum: user.cardnum,
        cid: cid,
        gid: clazz.gid,
        ggid: group.ggid,
        time: now,
        weekday: clazz.weekday,
        startTime: clazz.startTime,
        endTime: clazz.endTime,
        canDelete: true,
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

    let selectionCollection = await mongodb('selection')
    let { cid } = this.params
    cid = parseInt(cid)
    let user = await userInfo(this)

    await mutex.use(async () => {
      let sel = await selectionCollection.findOne({ cardnum: user.cardnum, cid })
      //let sel = await db.selection.find({ cardnum: user.cardnum, cid }, 1)
      if (!sel) {
        this.throw(404, '未选择该课程！')
      }

      await selectionCollection.deleteMany({ cardnum: user.cardnum, cid })
      // await db.selection.remove({ cardnum: user.cardnum, cid })
    })

    return '取消课程成功'
  }
}
