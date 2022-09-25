const fs = require('fs')
const path = require('path')
const express = require('express')
const multer = require('multer')

const ONE_MO = 1048576

const CUMULATIVE_MAX_DATA_LENGTH = 1_000_000 // cumulative limit for posted data
const CUMULATIVE_MAX_FILES_SIZE = 100 * ONE_MO // culumative limit for posted files

const upload = multer({
  dest: '/tmp/',
  limits: {
    fieldNameSize: 100,
    fieldSize: 10 * ONE_MO,
  },
})

const defaultPort = 6080

const app = express()

const jsonParser = express.json({
  strict: true,
  limit: '100kb',
})

const MINUTE_MS = 1000 * 60
const HOUR_MS = MINUTE_MS * 60
const ONE_DAY_MS = HOUR_MS * 24

let data = []
let files = []

if (process.env.NODE_ENV !== 'production') {
  console.log('Serving static files')
  app.use(express.static(path.join(__dirname, '../client')))
}

app.listen(process.env.PORT || defaultPort, () => {
  console.log(`Paste app listening on port ${defaultPort}`)
})

// Text data

const checkDataLength = (newContent) => {
  const dataLength = data.reduce(
    (acc, current) => acc + current.content.length,
    0
  )
  const newDataLength = dataLength + newContent.length
  console.log(
    'new data length',
    newDataLength,
    'limit NOT reached ?',
    newDataLength < CUMULATIVE_MAX_DATA_LENGTH
  )
  return newDataLength < CUMULATIVE_MAX_DATA_LENGTH
}

app.post('/api/data', jsonParser, (req, res) => {
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
    console.log('pushing new message', msg.length)
    data.push(msg)
    res.sendStatus(200)
  } else {
    console.log('rejected msg:', JSON.stringify(body))
    res.sendStatus(400)
  }
})

app.get('/api/data', (req, res) => {
  res.json(data)
})

const checkFilesLength = (newFileSize) => {
  const fileLength = files.reduce((acc, current) => acc + current.size, 0)
  const newFilesLength = fileLength + newFileSize
  console.log(
    'new file length',
    newFilesLength,
    'limit NOT reached ?',
    newFilesLength < CUMULATIVE_MAX_FILES_SIZE
  )
  return newFilesLength < CUMULATIVE_MAX_FILES_SIZE
}

// Files

const generateRandomId = () => Math.random().toString(36).substring(2)

app.post('/api/file', upload.single('file'), (req, res) => {
  const file = req.file
  const keep = parseInt(req.body?.keep, 10)
  if (
    file &&
    file.originalname &&
    file.mimetype &&
    file.path &&
    file.size &&
    checkFilesLength(file.size) &&
    keep > 0 &&
    keep <= ONE_DAY_MS
  ) {
    const { originalname, mimetype, path, size } = file

    const newFile = {
      id: generateRandomId(),
      originalname,
      mimetype,
      path,
      size,
      until: Date.now() + keep,
    }
    console.log('push new file', JSON.stringify(newFile))
    files.push(newFile)
    res.sendStatus(200)
  } else {
    console.log('rejected file:', JSON.stringify(file))
    removeFile(file)
    res.sendStatus(400)
  }
})

app.get('/api/files', (req, res) => {
  const availableFiles = files.map(
    ({ id, originalname, mimetype, size, until }) => ({
      id,
      originalname,
      mimetype,
      size,
      until,
    })
  )
  res.json(availableFiles)
})

app.get('/api/files/:id', (req, res) => {
  console.log(new Date(), 'requesting', req.params.id)
  const file = files.find(({ id }) => id === req.params.id)
  if (file && file.until > Date.now()) {
    res.setHeader('content-type', file.mimetype)
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${file.originalname}"`
    )
    res.sendFile(file.path)
  } else {
    res.sendStatus(400)
  }
})

// Periodic cleanup

const periodicFilterData = () => {
  const nbBefore = data.length
  data = data.filter((item) => item.until > Date.now())
  const nbAfter = data.length
  if (nbAfter !== nbBefore) {
    console.log(new Date(), 'periodicFilterData: ', nbBefore, ' -> ', nbAfter)
  }
  setTimeout(periodicFilterData, MINUTE_MS)
}
periodicFilterData()

const removeFile = (file) => {
  try {
    if (fs.existsSync(file.path)) {
      console.log(new Date(), 'removing file', file)
      fs.unlinkSync(file.path)
      console.log(new Date(), 'file removed', file)
    } else {
      console.error(new Date(), 'file not here', file)
    }
  } catch (e) {
    console.error('error while removing file', file, e)
  }
}

const periodicFilterFiles = () => {
  const nbBefore = files.length
  const removedFiles = []
  files
    .filter((file) => file.until < Date.now())
    .forEach((file) => {
      removedFiles.push(file.path)
      removeFile(file)
    })

  files = files.filter((file) => !removedFiles.includes(file.path))
  const nbAfter = files.length
  if (nbAfter !== nbBefore) {
    console.log(new Date(), 'periodicFilterFiles:', nbBefore, ' -> ', nbAfter)
  }
  setTimeout(periodicFilterFiles, MINUTE_MS)
}
periodicFilterFiles()