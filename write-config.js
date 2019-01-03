const cbor = require('dag-cbor-sync')()
const s3 = require('./functions/util/s3')

const filter = {
  orgs: [
    'multiformats',
    'libp2p',
    'ipfs',
    'ipld',
    'ipfs-shipyard',
    'protocol',
    'protoschool',
    'peer-base',
    'orbitdb'
  ].sort()
}

const run = async () => {
  let block = await cbor.mkblock(filter)
  let uploader = s3.upload(`blocks/${block.cid.toBaseEncodedString()}`)
  uploader.end(block.data)
  console.log(block.cid.toBaseEncodedString())
}

run()