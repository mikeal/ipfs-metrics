const s3 = require('./util/s3')
const lamb = require('./util/lamb')
const identifyRepo = require('./util/identifyRepo')
const gharchive = require('./util/gharchive')
const bent = require('bent')
const url = require('url')
const querystring = require('querystring')
const cbor = require('dag-cbor-sync')()
const CID = require('cids')
const jsonstream = require('jsonstream2')
const { createGunzip, createGzip } = require('zlib')

const getConfig = async hash => {
  let data = await s3.getObject(`blocks/${hash}`)
  let obj = cbor.deserialize(data)
  return obj
}

module.exports = lamb(async (req, res) => {
  const { query } = url.parse(req.url)
  const { config, file } = querystring.parse(query)

  let filter
  try {
    filter = await getConfig(config)
  } catch (e) {
    res.statusCode = '500'
    res.end(`Could not load config for ${config}.`)
    return
  }

  let block = await cbor.mkblock({filter: new CID(config), file})
  let cacheid = block.cid.toBaseEncodedString()

  const include = event => {
    let repo = identifyRepo(event)
    if (filter.orgs) {
      for (let org of filter.orgs) {
        if (repo.startsWith(`${org}/`)) return true
      }
    }
    return false
  }

  console.log({file, config, cacheid})
  if (await s3.hasObject(`cache/${cacheid}`)) {
    res.end(cacheid)
  } else {
    let writer = createGzip()
    writer.pipe(s3.upload(`cache/${cacheid}`))
    .on('finish', () => {
      res.end(cacheid)
    })
    let stream = await gharchive(`${file}`)
    if (stream === null) {
      return res.end('null')
    }
    stream
      .pipe(createGunzip())
      .pipe(jsonstream.parse())
      .on('data', event => {
        if (include(event)) {
          writer.write(JSON.stringify(event))
          writer.write('\n')
        }
      })
      .on('end', () => {
        writer.end()
      })
  }
})