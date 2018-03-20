const control = require('./control')
const db = require('./db')
const data = require('./data.json')
const crypto = require('crypto')

exports.route = {
  async post() {
    if (control.state === 2) {
      this.throw(404, '选课已结束，具体开课信息请留意东南大学学生事务服务中心微信推送！')
    }
    if (control.state === 0) {
      this.throw(404, '选课尚未开放')
    }
    let { cardnum, schoolnum, phone = '' } = this.params
    if (data.blacklists[cardnum]) {
      this.throw(401, '由于上学期出勤率不达标，你已进入黑名单，本学期不允许参加金钥匙计划。如有疑问，请咨询学生资助中心。')
    }
    let user = data.users[cardnum]
    if (user.schoolnum !== schoolnum) {
      this.throw(401, '用户信息不匹配，请重试')
    }
    if (!user) {
      this.throw(401, '用户不存在或不在经济困难生名单内，请重试')
    }
    let dbuser = await db.user.find({ cardnum }, 1)
    if (phone) {
      if (!/^1\d{10}$/.test(phone)) {
        this.throw(401, '请设置正确的11位手机号码')
      }
    } else if (dbuser && dbuser.phone) {
      phone = dbuser.phone
    } else {
      this.throw(401, '首次登录，请填写手机号码')
    }

    let token = new Buffer(crypto.randomBytes(16)).toString('hex')
    if (dbuser) {
      await db.user.update({ cardnum }, { token, phone })
    } else {
      await db.user.insert({ cardnum, token, phone })
    }

    return {
      token, username: user.name
    }
  },

  async put() {
    let { cardnum, schoolnum, name } = this.params
    data.users[cardnum] = { schoolnum, name }
    return 'OK'
  }
}
