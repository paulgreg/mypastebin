import fs from 'node:fs'
import path from 'node:path'
import express from 'express'
import multer from 'multer'
import { ClientFilesType, DataType, ServerFileType } from '../PasteBinTypes'
import { v4 as uuidv4 } from 'uuid'
import { encodeFileName, ONE_MINUTE_MS, ONE_WEEK_MS } from './server.utils'
import { MAX_FILE_SIZE, ONE_MB } from '../constants'
import {
  TMP_DIR,
  deleteExpiredFiles,
  deleteExpiredPastes,
  deleteFile,
  deletePaste,
  getFileById,
  getFiles,
  getFilesTotalSize,
  getPasteById,
  getPastes,
  getPastesContentLength,
  insertFile,
  insertPaste,
  updateFileUntil,
  updatePasteUntil,
} from './db/database'

const CUMULATIVE_MAX_DATA_LENGTH = ONE_MB // cumulative limit for posted data
const CUMULATIVE_MAX_FILES_SIZE = 1000 * ONE_MB // culumative limit for posted files

const MAX_KEEP_TIME = ONE_WEEK_MS

const upload = multer({
  dest: TMP_DIR,
  limits: {
    fieldNameSize: 100,
    fieldSize: 100 * ONE_MB,
    fileSize: MAX_FILE_SIZE,
  },
})

const defaultPort = 6080

const app = express()
app.disable('x-powered-by')

const jsonParser = express.json({
  strict: true,
  limit: '100kb',
})

const encryptedFileJsonParser = express.json({
  strict: true,
  limit: '350mb',
})

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
// End CORS for DEV

const removeFileByPath = (filePath: string) => {
  if (fs.existsSync(filePath)) {
    console.log(new Date(), 'removing file', filePath)
    fs.unlinkSync(filePath)
    console.log(new Date(), 'file removed', filePath)
  } else {
    console.log(new Date(), 'file already gone', filePath)
  }
}

const createStoredFile = (file: {
  originalname: string
  mimetype: string
  path: string
  size: number
  keep: number
  iv?: string
  salt?: string
}) => ({
  id: uuidv4(),
  originalname: file.originalname,
  mimetype: file.mimetype,
  path: file.path,
  size: file.size,
  until: Date.now() + file.keep,
  iv: file.iv,
  salt: file.salt,
})

const cleanupOnStartup = () => {
  const now = Date.now()
  const deletedDataCount = deleteExpiredPastes(now)
  if (deletedDataCount > 0) {
    console.log(new Date(), 'startup data cleanup:', deletedDataCount)
  }

  const expiredFilePaths = deleteExpiredFiles(now)
  for (const filePath of expiredFilePaths) {
    try {
      removeFileByPath(filePath)
    } catch (e) {
      console.error('error while removing expired file at startup', filePath, e)
    }
  }

  const knownPaths = new Set(getFiles().map((file) => path.resolve(file.path)))
  for (const entry of fs.readdirSync(TMP_DIR, { withFileTypes: true })) {
    if (!entry.isFile()) continue
    const filePath = path.join(TMP_DIR, entry.name)
    const absolutePath = path.resolve(filePath)
    if (!knownPaths.has(absolutePath)) {
      try {
        console.log(new Date(), 'removing orphan file', filePath)
        fs.unlinkSync(filePath)
      } catch (e) {
        console.error('error while removing orphan file', filePath, e)
      }
    }
  }
}

const periodicFilterFiles = () => {
  const expiredFilePaths = deleteExpiredFiles(Date.now())
  if (expiredFilePaths.length > 0) {
    console.log(new Date(), 'periodicFilterFiles:', expiredFilePaths.length)
  }
  for (const filePath of expiredFilePaths) {
    try {
      removeFileByPath(filePath)
    } catch (e) {
      console.error('error while removing file', filePath, e)
    }
  }

  setTimeout(periodicFilterFiles, ONE_MINUTE_MS)
}

const periodicFilterData = () => {
  const deletedCount = deleteExpiredPastes(Date.now())
  if (deletedCount > 0) {
    console.log(new Date(), 'periodicFilterData:', deletedCount)
  }
  setTimeout(periodicFilterData, ONE_MINUTE_MS)
}

cleanupOnStartup()
periodicFilterData()
periodicFilterFiles()

app.listen(process.env.PORT ?? defaultPort, () => {
  console.log(`Paste app listening on port ${defaultPort}`)
})

const parseKeepTime = (value: unknown) => {
  if (typeof value !== 'string' || !/^-?\d+$/.test(value)) {
    return 0
  }
  return parseInt(value, 10)
}

// Text data
const checkDataLength = (newContentLength: number) => {
  const dataLength = getPastesContentLength()
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
    body.keep <= MAX_KEEP_TIME &&
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
    insertPaste(msg)
    res.sendStatus(200)
  } else {
    console.log('rejected msg:', JSON.stringify(body))
    res.sendStatus(400)
  }
})

app.get('/api/data', (_req, res) => {
  res.json(getPastes())
})

app.delete('/api/data/:id', (req, res) => {
  console.log(new Date(), 'deleting data', req.params.id)
  if (deletePaste(req.params.id)) {
    res.sendStatus(200)
  } else {
    res.sendStatus(400)
  }
})

// Files
const checkFilesLength = (newFileSize: number) => {
  const fileLength = getFilesTotalSize()
  const newFilesLength = fileLength + newFileSize
  console.log(
    'new file length',
    newFilesLength,
    'limit NOT reached ?',
    newFilesLength < CUMULATIVE_MAX_FILES_SIZE
  )
  return newFilesLength < CUMULATIVE_MAX_FILES_SIZE
}

app.post('/api/file', upload.single('file'), (req, res) => {
  const file = req.file
  const keep = parseInt(req.body?.keep, 10)
  if (
    file?.originalname &&
    file.mimetype &&
    file.path &&
    file.size &&
    file.size <= MAX_FILE_SIZE &&
    checkFilesLength(file.size) &&
    keep > 0 &&
    keep <= MAX_KEEP_TIME
  ) {
    const { originalname, mimetype, path, size } = file
    const newFile: ServerFileType = createStoredFile({
      originalname: Buffer.from(originalname, 'latin1').toString('utf8'),
      mimetype,
      path,
      size,
      keep,
    })
    console.log('push new file', JSON.stringify(newFile))
    insertFile(newFile)
    res.sendStatus(200)
  } else {
    console.log('rejected file:', JSON.stringify(file))
    if (file) removeFileByPath(file.path)
    res.sendStatus(400)
  }
})

app.post('/api/file/encrypted', encryptedFileJsonParser, (req, res) => {
  const body = req.body
  const keep = body?.keep

  if (
    typeof body?.originalname === 'string' &&
    typeof body?.mimetype === 'string' &&
    typeof body?.content === 'string' &&
    typeof body?.iv === 'string' &&
    typeof body?.salt === 'string' &&
    typeof keep === 'number' &&
    keep > 0 &&
    keep <= MAX_KEEP_TIME
  ) {
    try {
      const buffer = Buffer.from(body.content, 'base64')
      if (
        buffer.length > 0 &&
        buffer.length <= MAX_FILE_SIZE &&
        checkFilesLength(buffer.length)
      ) {
        const storedPath = path.join(TMP_DIR, uuidv4())
        fs.writeFileSync(storedPath, buffer)

        const newFile: ServerFileType = createStoredFile({
          originalname: body.originalname,
          mimetype: body.mimetype,
          path: storedPath,
          size: buffer.length,
          keep,
          iv: body.iv,
          salt: body.salt,
        })
        console.log('push new encrypted file', JSON.stringify(newFile))
        insertFile(newFile)
        res.sendStatus(200)
      } else {
        console.log('rejected encrypted file: invalid size', buffer.length)
        res.sendStatus(400)
      }
    } catch (e) {
      console.error('error while posting encrypted file', e)
      res.sendStatus(400)
    }
  } else {
    console.log('rejected encrypted file body:', JSON.stringify(body))
    res.sendStatus(400)
  }
})

app.get('/api/files', (_req, res) => {
  const availableFiles: ClientFilesType = getFiles().map(
    ({ id, originalname, mimetype, size, until, iv, salt }) => ({
      id,
      originalname,
      mimetype,
      size,
      until,
      iv,
      salt,
    })
  )
  res.json(availableFiles)
})

app.get('/api/file/:id', (req, res) => {
  console.log(new Date(), 'requesting', req.params.id)
  const file = getFileById(req.params.id)
  if (file && file.until > Date.now()) {
    res.setHeader('content-type', file.mimetype)
    res.setHeader(
      'content-disposition',
      `inline; filename="${encodeFileName(file.originalname)}"`
    )
    res.sendFile(path.resolve(file.path))
  } else {
    res.sendStatus(400)
  }
})

app.delete('/api/file/:id', (req, res) => {
  console.log(new Date(), 'deleting file', req.params.id)
  const deletedFilePath = deleteFile(req.params.id)
  if (deletedFilePath) {
    try {
      removeFileByPath(deletedFilePath)
      res.sendStatus(200)
    } catch (e) {
      console.error('error while removing file', deletedFilePath, e)
      res.sendStatus(400)
    }
  } else {
    res.sendStatus(400)
  }
})

app.get('/api/data/keep/:id/', (req, res) => {
  console.log(new Date(), 'keep data', req.params.id)
  const dataItem = getPasteById(req.params.id)
  if (dataItem) {
    const time = parseKeepTime(req.query.time)
    const until = Math.min(dataItem.until + time, Date.now() + MAX_KEEP_TIME)
    updatePasteUntil(req.params.id, until)
  }
  res.sendStatus(200)
})

app.get('/api/file/keep/:id/', (req, res) => {
  console.log(new Date(), 'keep file', req.params.id)
  const fileItem = getFileById(req.params.id)
  if (fileItem) {
    const time = parseKeepTime(req.query.time)
    const until = Math.min(fileItem.until + time, Date.now() + MAX_KEEP_TIME)
    updateFileUntil(req.params.id, until)
  }
  res.sendStatus(200)
})
