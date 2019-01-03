
module.exports = handler => {
  return (req, res) => {
    handler(req, res)
    .then(() => {
      console.log(`Completed ${req.url}`)
    })
    .catch(e => {
      console.log(`Error in ${req.url}\n${e.stack}`)
      res.statusCode = 500
      res.end(e.stack)
    })
  }
}