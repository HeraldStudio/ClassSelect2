const koa = require('koa')
const kf = require('kf-router')
const bp = require('koa-bodyparser')
const control = require('./control')
const logger = require('./logger')
const cors = require('kcors')

const app = new koa()

app.use(bp())
app.use(cors({ allowHeaders: 'content-type' }))
app.use(logger)
app.use(async (ctx, next) => {
  ctx.params = {
    ...ctx.request.body,
    ...ctx.query
  }
  try {
    await next()
  } catch (e) {
    ctx.body = e.message
    ctx.status = e.status || 200
  } finally {
    if (!ctx.noTransform) {
      ctx.body = {
        content: ctx.body,
        code: ctx.status || 200
      }
      ctx.status = 200
    }
  }
})
app.use(kf())
app.listen(8087)
control.start()
