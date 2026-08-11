import fs from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import type { DataType, ServerFileType } from '../../PasteBinTypes'

export const DATA_DIR = './data'
export const TMP_DIR = `${DATA_DIR}/tmp-storage`
export const DB_PATH = `${DATA_DIR}/mypastebin.db`

fs.mkdirSync(TMP_DIR, { recursive: true })

const db = new DatabaseSync(DB_PATH)

db.exec(`
  CREATE TABLE IF NOT EXISTS pastes (
    id TEXT PRIMARY KEY,
    content TEXT NOT NULL,
    until INTEGER NOT NULL,
    pre INTEGER,
    iv TEXT,
    salt TEXT
  );

  CREATE TABLE IF NOT EXISTS files (
    id TEXT PRIMARY KEY,
    originalname TEXT NOT NULL,
    mimetype TEXT NOT NULL,
    path TEXT NOT NULL,
    size INTEGER NOT NULL,
    until INTEGER NOT NULL,
    iv TEXT,
    salt TEXT
  );
`)

const insertPasteStmt = db.prepare(
  'INSERT INTO pastes (id, content, until, pre, iv, salt) VALUES (?, ?, ?, ?, ?, ?)'
)
const getPastesStmt = db.prepare('SELECT id, content, until, pre, iv, salt FROM pastes')
const getPasteByIdStmt = db.prepare(
  'SELECT id, content, until, pre, iv, salt FROM pastes WHERE id = ?'
)
const deletePasteStmt = db.prepare('DELETE FROM pastes WHERE id = ?')
const deleteExpiredPastesStmt = db.prepare('DELETE FROM pastes WHERE until < ?')
const getPastesContentLengthStmt = db.prepare(
  'SELECT COALESCE(SUM(LENGTH(content)), 0) AS total FROM pastes'
)
const updatePasteUntilStmt = db.prepare('UPDATE pastes SET until = ? WHERE id = ?')

const insertFileStmt = db.prepare(
  'INSERT INTO files (id, originalname, mimetype, path, size, until, iv, salt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
)
const getFilesStmt = db.prepare(
  'SELECT id, originalname, mimetype, path, size, until, iv, salt FROM files'
)
const getFileByIdStmt = db.prepare(
  'SELECT id, originalname, mimetype, path, size, until, iv, salt FROM files WHERE id = ?'
)
const deleteFileByIdStmt = db.prepare('DELETE FROM files WHERE id = ?')
const getExpiredFilePathsStmt = db.prepare('SELECT path FROM files WHERE until < ?')
const deleteExpiredFilesStmt = db.prepare('DELETE FROM files WHERE until < ?')
const getFilesTotalSizeStmt = db.prepare(
  'SELECT COALESCE(SUM(size), 0) AS total FROM files'
)
const updateFileUntilStmt = db.prepare('UPDATE files SET until = ? WHERE id = ?')

const toDataType = (row: {
  id: string
  content: string
  until: number
  pre: number | null
  iv: string | null
  salt: string | null
}): DataType => ({
  id: row.id,
  content: row.content,
  until: row.until,
  pre: row.pre === null ? undefined : Boolean(row.pre),
  iv: row.iv ?? undefined,
  salt: row.salt ?? undefined,
})

const toServerFileType = (row: {
  id: string
  originalname: string
  mimetype: string
  path: string
  size: number
  until: number
  iv: string | null
  salt: string | null
}): ServerFileType => ({
  id: row.id,
  originalname: row.originalname,
  mimetype: row.mimetype,
  path: row.path,
  size: row.size,
  until: row.until,
  iv: row.iv ?? undefined,
  salt: row.salt ?? undefined,
})

export const insertPaste = (paste: DataType) => {
  insertPasteStmt.run(
    paste.id,
    paste.content,
    paste.until,
    paste.pre === undefined ? null : Number(paste.pre),
    paste.iv ?? null,
    paste.salt ?? null
  )
}

export const getPastes = (): Array<DataType> =>
  (getPastesStmt.all() as Array<{
    id: string
    content: string
    until: number
    pre: number | null
    iv: string | null
    salt: string | null
  }>).map(toDataType)

export const getPasteById = (id: string): DataType | undefined => {
  const row = getPasteByIdStmt.get(id) as
    | {
        id: string
        content: string
        until: number
        pre: number | null
        iv: string | null
        salt: string | null
      }
    | undefined
  return row ? toDataType(row) : undefined
}

export const deletePaste = (id: string): boolean => {
  const result = deletePasteStmt.run(id) as { changes: number }
  return result.changes > 0
}

export const deleteExpiredPastes = (now: number): number => {
  const result = deleteExpiredPastesStmt.run(now) as { changes: number }
  return result.changes
}

export const getPastesContentLength = (): number => {
  const row = getPastesContentLengthStmt.get() as { total: number }
  return row.total
}

export const updatePasteUntil = (id: string, until: number): boolean => {
  const result = updatePasteUntilStmt.run(until, id) as { changes: number }
  return result.changes > 0
}

export const insertFile = (file: ServerFileType) => {
  insertFileStmt.run(
    file.id,
    file.originalname,
    file.mimetype,
    file.path,
    file.size,
    file.until,
    file.iv ?? null,
    file.salt ?? null
  )
}

export const getFiles = (): Array<ServerFileType> =>
  (getFilesStmt.all() as Array<{
    id: string
    originalname: string
    mimetype: string
    path: string
    size: number
    until: number
    iv: string | null
    salt: string | null
  }>).map(toServerFileType)

export const getFileById = (id: string): ServerFileType | undefined => {
  const row = getFileByIdStmt.get(id) as
    | {
        id: string
        originalname: string
        mimetype: string
        path: string
        size: number
        until: number
        iv: string | null
        salt: string | null
      }
    | undefined
  return row ? toServerFileType(row) : undefined
}

export const deleteFile = (id: string): string | undefined => {
  const file = getFileById(id)
  if (!file) return undefined
  deleteFileByIdStmt.run(id)
  return file.path
}

export const deleteExpiredFiles = (now: number): Array<string> => {
  const rows = getExpiredFilePathsStmt.all(now) as Array<{ path: string }>
  deleteExpiredFilesStmt.run(now)
  return rows.map(({ path }) => path)
}

export const getFilesTotalSize = (): number => {
  const row = getFilesTotalSizeStmt.get() as { total: number }
  return row.total
}

export const updateFileUntil = (id: string, until: number): boolean => {
  const result = updateFileUntilStmt.run(until, id) as { changes: number }
  return result.changes > 0
}
