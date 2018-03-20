const db = require('sqlongo')('database')

db.user = {
  token: 'text primary key',
  cardnum: 'text not null',
  phone: 'text not null'
}

db.selection = {
  cardnum: 'text not null',
  cid: 'int not null',
  gid: 'int not null',
  ggid: 'int not null',
  time: 'int not null'
}

module.exports = db
