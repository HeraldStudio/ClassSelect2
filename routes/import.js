const mongodb = require('../mongodb')
const data = require('../data.json')
const moment = require('moment')

/**
 * 
 * 
 * 
 * 导入已选的课程数据结构的示例
 * 
 * {
 *   "selectOneList" : [
 *    { "className" : "吉他初级班", "groupsName":"兴趣培养类", "cardnum":"213171610"}
 *    ]
 * }
 * 
 * 
 */


admin = {
  'zzj': 'zzj34jys##QI'
}

exports.route = {
  async post() {
    // 手工导入已经选好的课

    if(!this.headers['user-agent'].startsWith('Postman')){
      // 只能在 postman 上进行
      this.throw(404, '非法调用')
    }
    if(!this.headers['who']){
      this.throw(404, '身份未知')
    }
    if(!(this.headers['pwd'] && admin[this.headers['who']] && this.headers['pwd'] === admin[this.headers['who']])){
      this.throw(404, '氧化钙，密码错误')
    }

    let list = this.params.selectOneList
    let selectionCollection = await mongodb('selection')

    list.forEach(async selection => {
      let gid, cid
      data.groups.forEach((group,index)=>{
        if (group.name === selection.groupsName) gid = index
      })
      data.classes.forEach((clazz,index)=>{
        if (clazz.name === selection.className) cid = index
      })

      await selectionCollection.insertOne({
        cardnum: selection.cardnum,
        cid,
        gid,
        ggid: 0,
        time: +moment(),
        weekday: data.classes[cid].weekday,
        startTime: data.classes[cid].startTime,
        endTime: data.classes[cid].endTime,
        canDelete: false,
      })
      
    })


    return 'ok'
  }
}