const repl = require('repl')

// 注意其他模块导入时应该导入本模块本身，然后每次读取其 state 属性
// 而不是导入 state 属性，每次读取它本身，否则由于引用脱离，始终不会改变
exports.state = 0 // 0 未开始，1 进行中，2 已结束

exports.start = () => {
  let replServer = repl.start({
    prompt: '> ',
    eval: (cmd, context, filename, callback) => {
      if (cmd.trim().toLowerCase() === 'start') {
        exports.state = 1
        console.log('started')
      } else if (cmd.trim().toLowerCase() === 'stop') {
        exports.state = 2
        console.log('stopped')
      } else {
        console.log('invalid command')
      }
      callback(null)
    }
  })

  replServer.on('exit', () => {
    console.log('exit')
    process.exit()
  })
}
