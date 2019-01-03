const bent = require('bent')
const { createGunzip } = require('zlib')
const s3 = require('./functions/util/s3')
const config = 'zdpuAojEQpK1XsiHT4svqJ52JbVYckrL1Q7vFkRR7KiYQZA35'
const querystring = require('querystring')
const sleep = require('sleep-promise')

const baseurl = 'https://ipfs-metrics-staging.now.sh'
const get = bent(baseurl, 'json')

const file = '2016-01-05-0.json.gz'

let ts = new Date('2016-01-01')
let files = []

const oneminute = 1000 * 60
const onehour = oneminute * 60
const oneday = onehour * 24

const getFile = bent('http://data.gharchive.org/', {
  'User-Agent': 'ipfs-metrics-' + Math.random()
})

// let pushfile = async () => {
//   let stream = await getFile(file)
//   let uploader = require('./functions/util/s3').upload(`gharchive/${file}`)
//   stream.pipe(uploader)
// }
// pushfile()
// return



// console.log(files)
// while (files.length) {
//   let _files = files.slice(0, 10)
//   files = files.slice(10)
//   let p = []
//   for (let file of files) {
//     p.push(dofile(file))
//   }
//   await Promise.all(p)
// }
// return

const oneweek = oneday * 7

const run = async () => {
  let start = new Date('2017-11-29')
  let end = new Date(start.getTime() + oneweek)
  // let results = await get(`/map-reduce-file?file=2016-10-21-18.json.gz&reduce=unique&map=people&config=zdpuAojEQpK1XsiHT4svqJ52JbVYckrL1Q7vFkRR7KiYQZA35`)
  // let results = await get(`/map-reduce-range?${querystring.stringify(opts)}`)
  // let results = await get(`/map-reduce-file?${querystring.stringify(opts)}`)

  let opts, results

  while (end < new Date(Date.now() - oneweek)) {
    try {
      opts = {
        // file: '2016-01-05-19.json.gz',
        start: start.toISOString(),
        end: end.toISOString(),
        map: 'people',
        reduce: 'unique',
        config
      }
      console.log(start, end)
      results = await get(`/map-reduce-range?${querystring.stringify(opts)}`)
      console.log(results, start, end)
      start = end
      end = new Date(end.getTime() + oneweek)
    } catch (e) {
      if (e.res) {
        let parts = []
        e.res.on('data', chunk => parts.push(chunk))
        e.res.on('end', () => {
          console.error(`HTTP Error: ${e.res.statusCode}`)
          console.error(Buffer.concat(parts).toString())
        })
      } else {
        throw e
      }
      await sleep(oneminute)
    }
  }
}

run().catch(e => {
  if (e.res) {
    let parts = []
    e.res.on('data', chunk => parts.push(chunk))
    e.res.on('end', () => {
      console.error(`HTTP Error: ${e.res.statusCode}`)
      console.error(Buffer.concat(parts).toString())
    })
  } else {
    throw e
  }
})
