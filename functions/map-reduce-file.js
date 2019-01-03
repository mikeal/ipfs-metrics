const bent = require('bent')
const s3 = require('./util/s3')
const lamb = require('./util/lamb')
const jsonstream = require('jsonstream2')
const { createGunzip } = require('zlib')
const url = require('url')
const querystring = require('querystring')
const cbor = require('dag-cbor-sync')()

const maps = {
  people: event => {
    return event.actor.login
  },
  type: event => {
    return event.type
  },
  peopleAndType: event => {
    return `${event.actor.login}:${event.type}`
  }
}
const reduces = {
  unique: (x, y) => {
    if (!x) x = new Set()
    x.add(y)
    return x
  },
  count: (x, y) => {
    if (!x) x = {}
    if (!x[y]) x[y] = 0
    x[y] += 1
    return x
  }
}

module.exports = lamb(async (req, res) => {
  const { query } = url.parse(req.url)
  const { config, file, map, reduce } = querystring.parse(query)

  if ([config, file, map].includes(undefined)) {
    res.statusCode = 500
    res.end('Missing required argument')
    return
  }

  const mapFunction = maps[map]
  if (!mapFunction) {
    res.statusCode = 500
    res.end(`No map function named ${map}`)
    return
  }
  let reduceFunction
  if (reduce) {
    reduceFunction = reduces[reduce]
    if (!reduceFunction) {
      res.statusCode = 500
      res.end(`No reduce function named ${reduce}`)
      return
    }
  }

  // TODO: cacheing

  let getFile = bent(`https://${req.headers.host}/filter`, 'buffer')
  let qs = `?file=${file}&config=${config}`
  let cid = (await getFile(qs)).toString()
  if (cid === 'null') {
    return res.end('null')
  }
  let x = reduceFunction ? null : []
  s3.getStream(`cache/${cid}`)
  .pipe(createGunzip())
  .pipe(jsonstream.parse())
  .on('data', event => {
    let val = mapFunction(event)
    if (val && reduceFunction) {
      x = reduceFunction(x, val)
    } else if (val) {
      x.push(val)
    }
  })
  .on('end', () => {
    if (x instanceof Set) {
      x = Array.from(x)
    } if (x === null) {
      x = []
    }
    res.end(JSON.stringify(x))
  })
})
