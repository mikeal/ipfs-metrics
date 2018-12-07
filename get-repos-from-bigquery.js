const argv = require('yargs').argv
const { BigQuery } = require('@google-cloud/bigquery')
const fs = require('fs')
const path = require('path')

const term = argv._[0] || 'ipfs'

const projectId = 'ipfs-metrics'

// Creates a client
const bigquery = new BigQuery({
  projectId,
  keyFilename: path.join(__dirname, 'credentials.json')
})

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

let repos
let f = path.join(__dirname, term) + '.json'

try {
  repos = new Set(JSON.parse(fs.readFileSync(f).toString()))
} catch (e) {
  console.log(`No existing data, will create ${term}.json`)
  repos = new Set()
}

// Runs the query
const run = async () => {
  const [rows] = await bigquery.query(options)
  rows.forEach(row => repos.add(row.repo_name))
  fs.writeFileSync(f, JSON.stringify(Array.from(repos)))
}

run()
