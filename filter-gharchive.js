const { Storage } = require('@google-cloud/storage')
const { createGunzip, createGzip } = require('zlib')
const { PassThrough } = require('stream')
const fs = require('fs')
const path = require('path')
const IPFS = require('ipfs')
const jsonstream = require('jsonstream2')
const ipfs = new IPFS()

let reposCid = path.join(__dirname, 'repos.cid')
let cid = fs.readFileSync(reposCid).toString()

const projectId = 'ipfs-metrics'

// Creates a client
const storage = new Storage({
  projectId,
  keyFilename: path.join(__dirname, 'credentials.json')
})

const bucket = storage.bucket('pl-metrics')

const createReader = filename => {
  let file = fs.createReadStream(path.join(__dirname, 'gharchive', filename))
  let unzip = file.pipe(createGunzip())
  let reader = unzip.pipe(jsonstream.parse())
  return reader.pipe(PassThrough({objectMode: true}))
}

const countSlash = s => (s.match(/\//g) || []).length

const identifyRepo = event => {
  if (event.repo) {
    repo = event.repo.name
  } else if (event.repository) {
    repo = `${event.repository.owner}/${event.repository.name}`
  } else {
    if (event.type === 'CreateEvent') {
      repo = event.url.slice('https://github.com/'.length)
      let _owner = repo.slice(0, repo.indexOf('/'))
      repo = repo.slice(0, repo.indexOf('/', _owner.length + 1))
    }
  }
  if (!repo) throw new Error('No repo info.')
  if (countSlash(repo) !== 1) {
    console.error(event)
    throw new Error(`Invalid repo "${repo}"`)
  }
  if (!repo.split('/')[1].length) {
    console.error(event)
    throw new Error(`Invalid repo "${repo}"`)
  }
  return repo
}

const run = async () => {
  console.log('Getting known repos from IPFS', cid)
  let data = (await ipfs.dag.get(cid)).value

  let allrepos = new Set()
  for (let repos of Object.values(data.repos)) {
    allrepos.add(repos)
  }

  let existingFiles = await bucket.getFiles({prefix: cid})
  existingFiles = new Set([].concat(...existingFiles).map(f => {
    return f.name.slice(cid.length + 1)
  }))
  console.log(existingFiles)

  let files = fs.readdirSync(path.join(__dirname, 'gharchive'))
  for (let filename of files) {
    if (existingFiles.has(filename)) {
      console.log('Skipping', filename)
      continue
    }
    console.log('Processing', filename)
    let compressor = createGzip()
    let reader = createReader(filename)
    for await (let event of reader) {
      let repo = identifyRepo(event)
      let send = false
      if (allrepos.has(repo)) {
        send = true
      } else {
        for (let org of data.orgs) {
          if (repo.startsWith(org + '/')) {
            send = true
            break
          }
        }
      }
      if (send) {
        compressor.write(JSON.stringify(event))
        compressor.write('\n')
      }
    }
    /* this isn't that fastest way to do this, we could have been streaming
       the whole time, but we want to limit the possibility of half-written
       files since we use the existence of the file to ignore already
       processed files.
    */

    console.log('Uploading', `/${cid}/${filename}`)
    let writer = bucket.file(`/${cid}/${filename}`).createWriteStream()
    compressor.pipe(writer)
    compressor.end()

    await new Promise((resolve, reject) => {
      writer.on('error', reject)
      writer.on('finish', resolve)
    })
  }
  await ipfs.stop()
}

ipfs.on('ready', () => {
  run()
})