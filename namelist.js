const fs = require('fs');
const xlsx = require('node-xlsx');
 
const list = xlsx.parse("/Users/wolf_tungsten/Documents/金钥匙选课/2018/黑名单.xlsx");
users = {}
list[0].data.forEach(k => {
    users[k[2]] = true
});
fs.writeFileSync('black.json',JSON.stringify(users))