const AWS = require('aws-sdk')
const awsConfig = require('aws-config')
const UploadStream = require('s3-stream-upload')
const downloader = require('s3-download-stream')

const { promisify } = require('util')

var s3 = new AWS.S3(awsConfig(
  { sslEnabled: true,
    accessKeyId: process.env.X_AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.X_AWS_SECRET_ACCESS_KEY
  }
))

const Bucket ='ipfs-metrics'

const upload = key => UploadStream(s3, { Bucket, Key: key })

const waitForStream = stream => {
  return new Promise((resolve, reject) => {
    stream.on('error', reject)
    stream.on('finish', resolve)
  })
}

const hasObject = key => {
  return new Promise((resolve, reject) => {
    s3.headObject({Bucket, Key: key}, (err, bool) => {
      if (err) return resolve(false)
      resolve(bool)
    })
  })
}
const getStream = key => {
  var config = {
    client: s3,
    concurrency: 6,
    params: {
      Key: key,
      Bucket
    }
  }
  return downloader(config)
}

const getObject = key => {
  return new Promise((resolve, reject) => {
    let stream = getStream(key)
    let parts = []
    stream.on('data', chunk => parts.push(chunk))
    stream.on('error', reject)
    stream.on('end', () => {
      resolve(Buffer.concat(parts))
    })
  })
}


module.exports = {
  getObject,
  getStream,
  hasObject,
  upload,
  waitForStream
}