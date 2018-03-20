/**
  # 日志中间件

  代替 koa 的日志中间件，为了解析 return.js 中间件返回的 JSON 状态码，并且为了好看。
 */
const logfile = require('fs').createWriteStream(`logs/${Date.now()}.log`, {flags: 'w'})

module.exports = async (ctx, next) => {
  let begin = new Date()
  try {
    await next()
  } catch (e) {
    console.trace(e)
    ctx.status = Number(e.status) || 400
    ctx.body = e.message
  } finally {
    let end = new Date()
    let duration = end - begin
    let time = end.getHours()
      + ':' + ('0' + end.getMinutes()).split('').slice(-2).join('')
      + ':' + ('0' + end.getSeconds()).split('').slice(-2).join('')

    logfile.write(
      time +
      ' | ' + ctx.body.code +
      ' ' + ctx.method +
      ' ' + ctx.path +
      ' ' + JSON.stringify(ctx.request.body) +
      ' ' + duration + 'ms'
      + '\n'
    )
  }
}
