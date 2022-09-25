const path = require('path')
const express = require('express')

const defaultPort = 6080

const app = express()

app.use(
  express.json({
    strict: true,
    limit: '100kb',
  })
)

const MINUTE_MS = 1000 * 60
const HOUR_MS = MINUTE_MS * 60
const ONE_DAY_MS = HOUR_MS * 24

const MAX_DATA_LENGTH = 1_000_000 // cumulative limit for posted data

let data = []

if (process.env.NODE_ENV !== 'production') {
  console.log('Serving static files')
  app.use(express.static(path.join(__dirname, '../client')))
}

app.listen(process.env.PORT || defaultPort, () => {
  console.log(`Paste app listening on port ${defaultPort}`)
})

const checkDataLength = (newContent) => {
  const dataLength = data.reduce(
    (acc, current) => acc + current.content.length,
    0
  )
  const newDataLength = dataLength + newContent.length
  console.log(
    'new data length',
    newDataLength,
    'passed ?',
    newDataLength < MAX_DATA_LENGTH
  )
  return newDataLength < MAX_DATA_LENGTH
}

app.post('/api/paste', (req, res) => {
  const body = req.body

  if (
    typeof body.content === 'string' &&
    body.content.length > 0 &&
    checkDataLength(body.content) &&
    typeof body.keep === 'number' &&
    body.keep <= ONE_DAY_MS
  ) {
    const msg = {
      content: body.content,
      until: Date.now() + body.keep,
    }
    console.log('pushing', msg)
    data.push(msg)
    res.sendStatus(200)
  } else {
    console.log('rejected msg:', JSON.stringify(body))
    res.sendStatus(400)
  }
})

const periodicFilterData = () => {
  const nbBefore = data.length
  data = data.filter((item) => item.until > Date.now())
  if (data.length !== nbBefore) {
    console.log(
      new Date(),
      'periodicFilterData, before:',
      nbBefore,
      ', after:',
      data.length
    )
  }
  setTimeout(periodicFilterData, MINUTE_MS)
}
periodicFilterData()

app.get('/api/data', (req, res) => {
  res.json(data)
})
