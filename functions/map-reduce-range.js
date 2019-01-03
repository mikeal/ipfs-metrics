const bent = require('bent')
const s3 = require('./util/s3')
const lamb = require('./util/lamb')
const jsonstream = require('jsonstream2')
const { createGunzip } = require('zlib')
const url = require('url')
const querystring = require('querystring')
const cbor = require('dag-cbor-sync')()
const PromisePool = require('es6-promise-pool')

const reduces = {
  unique: (x, y) => {
    if (!x) x = new Set()
    y.forEach(val => x.add(val))
    return x
  },
  count: (x, y) => {
    if (!x) x = {}
    for (let [key, value] of Object.entries(y)) {
      if (!x[key]) x[key] = 0
      x[key] += value
    }
    return x
  }
}

const onehour = 1000 * 60 * 60
const oneday = onehour * 24

module.exports = lamb(async (req, res) => {
  const { query } = url.parse(req.url)
  const { config, start, end, map, reduce} = querystring.parse(query)

  if ([config, start, end, map].includes(undefined)) {
    res.statusCode = 500
    res.end('Missing required argument')
    return
  }

  if (!reduces[reduce]) {
    res.statusCode = 500
    res.end('Unknown reduce.')
    return
  }

  const reduceFunction = reduces[reduce]

  let ts = new Date(start)
  let endTime = new Date((new Date(end)).getTime() - 1)

  let files = []

  while (ts < endTime) {
    let year = ts.getUTCFullYear()
    let month = (ts.getUTCMonth() + 1).toString().padStart(2, '0')
    let day = ts.getUTCDate().toString().toString().padStart(2, '0')
    let hour = ts.getUTCHours()
    files.push(`${year}-${month}-${day}-${hour}.json.gz`)
    ts = new Date(ts.getTime() + onehour)
  }

  const mapReduceFileURL = `https://${req.headers.host}/map-reduce-file`
  const mapReduceFile = bent(mapReduceFileURL, 'json')

  let results = reduceFunction ? null : []

  const doFile = async file => {
    let opts = {
      config,
      map,
      reduce,
      file
    }
    let r = await mapReduceFile(`?${querystring.stringify(opts)}`)
    if (r === null) {
      return // This file is missing from gharchive
    }
    if (reduceFunction) {
      results = reduceFunction(results, r)
    } else {
      results = results.concat(r)
    }
  }

  var pool = new PromisePool(() => {
    if (files.length === 0) return null
    return doFile(files.shift())
  }, 100)

  await pool.start()

  if (results instanceof Set) {
    results = Array.from(results)
  }

  res.end(JSON.stringify(results))
})
