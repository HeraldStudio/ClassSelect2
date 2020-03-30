const fs = require('fs');
const xlsx = require('node-xlsx');
 
const list = xlsx.parse("/Users/zhaozhengji/Downloads/选课系统/黑名单.xlsx");
users = {}
list[0].data.forEach((k,index) => {
   if(index !== 0 && k.length !== 0){
      users[k[2]] = true
   }
   
});
console.log(users)

fs.writeFileSync('black.json',JSON.stringify(users))