const { Storage } = require('@google-cloud/storage')
const path = require('path')

const projectId = 'ipfs-metrics'
const keyFilename = path.join(__dirname, 'credentials.json')

const storage = new Storage({ projectId, keyFilename })

const bucket = storage.bucket('pl-metrics')

const cid = 'zdpuAyPpBG4QAX2iLzLNSAuuRomdSPNJaoKUmSF531sks8Qgb'

module.exports = async (req, res) => {
  (await bucket.file(`/blocks/${cid}`).download())[0]
  res.end("Hello, Another World!");
}
