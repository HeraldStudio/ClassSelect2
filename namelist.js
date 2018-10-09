const fs = require('fs');
const xlsx = require('node-xlsx');
 
const list = xlsx.parse("/Users/wolf_tungsten/Documents/金钥匙选课/2018/name.xls");
users = {}
list[0].data.forEach(k => {
    users[k[1]] = {
        name:k[3],
        schoolnum:k[2]
    }
});
fs.writeFileSync('users.json',JSON.stringify(users))