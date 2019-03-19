const fs = require('fs');
const xlsx = require('node-xlsx');
 
const list = xlsx.parse("/Users/wolf_tungsten/Documents/金钥匙选课/2019春/困难生申请信息.xls");
users = {}
list[0].data.forEach(k => {
    users[k[0]] = {schoolnum:k[1], name:k[2]}
});
fs.writeFileSync('all.json',JSON.stringify(users))