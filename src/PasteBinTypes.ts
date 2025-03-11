export type DataType = {
  id: string
  content: string
  until: number
  pre?: string
  iv?: string
  salt?: string
}

export type DatasType = Array<DataType>

export type FileType = {
  id: string
  path: string
  originalname: string
  mimetype: string
  size: number
  until: number
}

export type FilesType = Array<FileType>
