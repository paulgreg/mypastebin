export type PastedData = {
  id: string
  content: string
  until: number
  pre?: string
  iv?: string
  salt?: string
}

export type PastedDatas = Array<PastedData>

export type PastedFile = {
  id: string
  path: string
  originalname: string
  mimetype: string
  size: number
  until: number
}

export type PastedFiles = Array<PastedFile>
