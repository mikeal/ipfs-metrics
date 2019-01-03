const argv = require('yargs').argv
const { BigQuery } = require('@google-cloud/bigquery')
const { Storage } = require('@google-cloud/storage')
const fs = require('fs')
const path = require('path')
const cbor = require('dag-cbor-sync')()

const term = argv._[0] || 'ipfs'

const projectId = 'ipfs-metrics'
const keyFilename = path.join(__dirname, 'credentials.json')

const bigquery = new BigQuery({ projectId, keyFilename })
const storage = new Storage({ projectId, keyFilename })

const bucket = storage.bucket('pl-metrics')

const queries = {}
queries.ipfs = `
SELECT DISTINCT repo_name FROM \`bigquery-public-data.github_repos.files\` WHERE id IN
(
  SELECT id FROM \`bigquery-public-data.github_repos.contents\`
  WHERE id IN
    ( SELECT id FROM \`bigquery-public-data.github_repos.files\` WHERE path LIKE "%package.json" )
  AND (
    content LIKE '%ipfs%' OR
    content LIKE '%IPFS%'
  )
)
`

const options = {
  query: queries[term],
  // Location must match that of the dataset(s) referenced in the query.
  location: 'US'
}

// zdpuAtpgxGTRJu5e313hASh8ikfipvDqAKWr2rhAtp7zHsYRQ
let reposCid = path.join(__dirname, 'repos.cid')
let cid = fs.readFileSync(reposCid).toString()

// Make sure we also include all related orgs
const orgs = [
  'multiformats',
  'libp2p',
  'ipfs',
  'ipld',
  'ipfs-shipyard',
  'protocol',
  'protoschool',
  'peer-base',
  'orbitdb'
]

const bget = async path => {
  return (await bucket.file(path).download())[0]
}

const save = async obj => {
  let block = await cbor.mkblock(obj)
  let cid = block.cid.toBaseEncodedString()
  if (!(await bucket.file(`/blocks/${cid}`).exists())[0]) {
    await bucket.file(`/blocks/${cid}`).save(block.data)
  }
  fs.writeFileSync(reposCid, cid)
  return cid
}

// Runs the query
const run = async term => {
  console.log('Getting known repos from IPFS', cid)
  let data = cbor.deserialize(await bget(`/blocks/${cid}`))
  data.orgs = orgs
  let repos = data.repos
  const [rows] = await bigquery.query(options)
  repos[term] = new Set(repos[term])
  console.log(`Query for ${term} found`, rows.length, 'entries')
  rows.forEach(row => repos[term].add(row.repo_name))
  repos[term] = Array.from(repos[term]).sort()
  cid = await save(data)
  console.log('New repo set CID is', cid)
}

run(term)
