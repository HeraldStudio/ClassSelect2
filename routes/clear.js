const mongodb = require('../mongodb')
const data = require('../data.json')

exports.route = {
  async get() {
    try {
      let userCollection = await mongodb('user')
      let selectionCollection = await mongodb('selection')
      await userCollection.remove({})
      await selectionCollection.remove({})
    } catch (err) {
      console.log(err)
    }
    return 'ok'
  }
}
