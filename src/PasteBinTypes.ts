export enum ContentTypeEnum {
  data = 'data',
  file = 'file',
}

export type DataType = {
  id: string
  title?: string
  content: string
  until: number
  pre?: boolean
  iv?: string
  salt?: string
}

export type DatasType = Array<DataType>

export type ClientFileType = {
  id: string
  title?: string
  originalname: string
  mimetype: string
  size: number
  until: number
  iv?: string
  salt?: string
}
export type ClientFilesType = Array<ClientFileType>

export type ServerFileType = ClientFileType & {
  path: string
}

export type ServerFilesType = Array<ServerFileType>
