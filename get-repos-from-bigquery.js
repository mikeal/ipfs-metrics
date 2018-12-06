const { BigQuery } = require('@google-cloud/bigquery')
const path = require('path')

const projectId = 'ipfs-metrics'

// Creates a client
const bigquery = new BigQuery({
  projectId,
  keyFilename: path.join(__dirname, 'credentials.json')
})

const sqlQuery = `
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
  query: sqlQuery,
  // Location must match that of the dataset(s) referenced in the query.
  location: 'US',
};

// Runs the query
const run = async () => {
  const [rows] = await bigquery.query(options)
  rows.forEach(row => console.log(row.repo_name))
}

run()
