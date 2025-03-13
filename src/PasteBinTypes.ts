export enum ContentTypeEnum {
  data = 'data',
  file = 'file',
}

export type DataType = {
  id: string
  content: string
  until: number
  pre?: string
  iv?: string
  salt?: string
}

export type DatasType = Array<DataType>

export type ClientFileType = {
  id: string
  originalname: string
  mimetype: string
  size: number
  until: number
}
export type ClientFilesType = Array<ClientFileType>

export type ServerFileType = ClientFileType & {
  path: string
}

export type ServerFilesType = Array<ServerFileType>
