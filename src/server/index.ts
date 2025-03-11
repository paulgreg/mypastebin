import fs from 'fs'
import path from 'path'
import express from 'express'
import multer from 'multer'
import { DataType, DatasType, FileType, FilesType } from '../PasteBinTypes'
import { v4 as uuidv4 } from 'uuid'

const ONE_MB = 1_048_576

const CUMULATIVE_MAX_DATA_LENGTH = ONE_MB // cumulative limit for posted data
const CUMULATIVE_MAX_FILES_SIZE = 1000 * ONE_MB // culumative limit for posted files

const upload = multer({
  dest: '/tmp/',
  limits: {
    fieldNameSize: 100,
    fieldSize: 100 * ONE_MB,
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
const ONE_WEEK_MS = ONE_DAY_MS * 7

let data: DatasType = []
let files: FilesType = []

// handling CORS for DEV
if (process.env.NODE_ENV !== 'production') {
  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', 'http://localhost:5173')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

    if (req.method === 'OPTIONS') {
      res.sendStatus(204)
    } else {
      next()
    }
  })
}

app.listen(process.env.PORT ?? defaultPort, () => {
  console.log(`Paste app listening on port ${defaultPort}`)
})

// Periodic cleanup

const periodicFilterData = () => {
  const nbBefore = data.length
  data = data.filter((item) => item.until >= Date.now())
  const nbAfter = data.length
  if (nbAfter !== nbBefore) {
    console.log(new Date(), 'periodicFilterData: ', nbBefore, ' -> ', nbAfter)
  }
  setTimeout(periodicFilterData, MINUTE_MS)
}
periodicFilterData()

const removeFile = (file: FileType | Express.Multer.File) => {
  if (fs.existsSync(file.path)) {
    console.log(new Date(), 'removing file', file)
    fs.unlinkSync(file.path)
    files = files.filter((currentFile) => currentFile.path !== file.path)
    console.log(new Date(), 'file removed', file.path)
  } else {
    console.error(new Date(), 'file not here', file)
    throw new Error('file not found')
  }
}

const periodicFilterFiles = () => {
  const nbBefore = files.length
  files
    .filter((file) => file.until < Date.now())
    .forEach((file) => {
      try {
        removeFile(file)
      } catch (e) {
        console.error('error while removing file', file, e)
      }
    })

  const nbAfter = files.length
  if (nbAfter !== nbBefore) {
    console.log(new Date(), 'periodicFilterFiles:', nbBefore, ' -> ', nbAfter)
  }
  setTimeout(periodicFilterFiles, MINUTE_MS)
}
periodicFilterFiles()

// Text data

const checkDataLength = (newContentLength: number) => {
  const dataLength = data.reduce(
    (acc, current) => acc + current.content.length,
    0
  )
  const newDataLength = dataLength + newContentLength
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
    checkDataLength(body.content?.length) &&
    typeof body.keep === 'number' &&
    body.keep <= ONE_WEEK_MS &&
    typeof body.pre === 'boolean' &&
    ((!body.salt && !body.iv) ||
      (typeof body.salt === 'string' && typeof body.iv === 'string'))
  ) {
    const msg: DataType = {
      id: uuidv4(),
      content: body.content,
      until: Date.now() + body.keep,
      pre: body.pre,
      iv: body.iv,
      salt: body.salt,
    }
    console.log('pushing new message', msg.content.length, msg.until)
    data.push(msg)
    res.sendStatus(200)
  } else {
    console.log('rejected msg:', JSON.stringify(body))
    res.sendStatus(400)
  }
})

app.get('/api/data', (_req, res) => {
  res.json(data)
})

app.get('/api/data/keep/:id/', (req, res) => {
  console.log(new Date(), 'keep', req.params.id)
  const item = data.find(({ id }) => id === req.params.id)
  if (item) {
    data = data.map((item) =>
      item.id === req.params.id
        ? {
            ...item,
            until: item.until + ONE_DAY_MS,
          }
        : item
    )
    res.sendStatus(200)
  } else {
    res.sendStatus(400)
  }
})

app.delete('/api/data/:id', (req, res) => {
  console.log(new Date(), 'deleting data', req.params.id)
  const item = data.find(({ id }) => id === req.params.id)
  if (item) {
    data = data.filter(({ id }) => id !== req.params.id)
    res.sendStatus(200)
  } else {
    res.sendStatus(400)
  }
})

// Files
const checkFilesLength = (newFileSize: number) => {
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

app.post('/api/files', upload.single('file'), (req, res) => {
  const file = req.file
  const keep = parseInt(req.body?.keep, 10)
  if (
    file?.originalname &&
    file.mimetype &&
    file.path &&
    file.size &&
    checkFilesLength(file.size) &&
    keep > 0 &&
    keep <= ONE_WEEK_MS
  ) {
    const { originalname, mimetype, path, size } = file

    const newFile: FileType = {
      id: uuidv4(),
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
    if (file) removeFile(file)
    res.sendStatus(400)
  }
})

app.get('/api/files', (_req, res) => {
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

app.delete('/api/files/:id', (req, res) => {
  console.log(new Date(), 'deleting file', req.params.id)
  const file = files.find(({ id }) => id === req.params.id)
  if (file) {
    try {
      removeFile(file)
      res.sendStatus(200)
    } catch (e) {
      console.error('error while removing file', file, e)
      res.sendStatus(400)
    }
  } else {
    res.sendStatus(400)
  }
})
