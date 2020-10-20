//const db = require('../db')
const mongodb = require('../mongodb')
const data = require('../data.json')

exports.route = {
  async get() {
    this.response.headers = {
      'Content-Type': 'text/csv'
    }
    this.noTransform = true
    return '课程号,课程,学号,一卡通号,姓名,手机,选课时间\n\n' +
      (await Promise.all(data.classes.map(async (c, cid) => {
        let { name: className } = c
        let userCollection = await mongodb('user')
        let selectionCollection = await mongodb('selection')
        // return (await Promise.all((await db.selection.find({ cid: c.cid })).map(async s => {
        //   let { cardnum, phone } = await db.user.find({ cardnum: s.cardnum }, 1)
        //   let { schoolnum, name } = data.users[cardnum]
        //   let time = new Date(s.time).toLocaleString()
        //   return [cid, className, schoolnum, cardnum, name, phone, time].join(',')
        // }))).join('\n')
        return (await Promise.all((await selectionCollection.find({ cid: c.cid }).toArray()).map(async s => {
          console.log(await userCollection.findOne({ cardnum: s.cardnum }))
          let { cardnum, phone, qq } = await userCollection.findOne({ cardnum: s.cardnum })
          let { schoolnum, name } = data.users[cardnum]
          let time = new Date(s.time).toLocaleString()
          let result = [cid, className, schoolnum, cardnum, name, phone, time, qq].join("','")
          return `'${result}'`
        }))).join('\n')
      }))).join('\n')
  }
}
