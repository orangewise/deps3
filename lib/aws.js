process.env.AWS_PROFILE = process.env.AWS_PROFILE || 'apichef'
const bucket = process.env.AWS_DEPS3_BUCKET || 'apichef-npm-deps'
const target = process.env.DEPS3_TARGET || 'node_modules'
const AWS = require('aws-sdk')
const proxy = require('proxy-agent')

if (process.env.http_proxy) {
  AWS.config.update({
    httpOptions: { agent: proxy(process.env.http_proxy) }
  })
}

AWS.bucket = bucket
AWS.target = target
module.exports = AWS
