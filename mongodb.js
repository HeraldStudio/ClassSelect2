const MongoClient = require('mongodb').MongoClient;
const config = require('./db-secret.json')

const user = encodeURIComponent(config.user);
const password = encodeURIComponent(config.pwd);
//const authMechanism = 'DEFAULT';

// Connection URL
// const url = `mongodb://${user}:${password}@${config.host}:${config.port}/jys?authMechanism=${authMechanism}`
const url = `mongodb://${user}:${password}@${config.dbs['0'].host}:${config.dbs['0'].port},${config.dbs['1'].host}:${config.dbs['1'].port},${config.dbs['2'].host}:${config.dbs['2'].port}/?authSource=admin&replicaSet=${config.replicaSetName}`
// console.log(url)
let mongodb = null

const getCollection = async(col) => {
  if (mongodb) {
    return mongodb.collection(col)
  } else {
    mongodb = await MongoClient.connect(url, { useNewUrlParser: true , useUnifiedTopology: true })
    mongodb = mongodb.db("jys")
    return mongodb.collection(col)
  }
}

module.exports = getCollection