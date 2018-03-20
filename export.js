const db = require('./db')
const data = require('./data.json')

exports.route = {
  async get() {
    this.response.headers = {
      'Content-Type': 'text/csv'
    }
    this.noTransform = true
    return '课程号,课程,学号,一卡通号,姓名,手机,选课时间\n\n' +
      (await Promise.all(data.classes.map(async (c, cid) => {
        let { name: className } = c
        return (await Promise.all((await db.selection.find({ cid: c.cid })).map(async s => {
          let { cardnum, phone } = await db.user.find({ cardnum: s.cardnum }, 1)
          let { schoolnum, name } = data.users[cardnum]
          let time = new Date(s.time).toLocaleString()
          return [cid, className, schoolnum, cardnum, name, phone, time].join(',')
        }))).join('\n')
      }))).join('\n')
  }
}
