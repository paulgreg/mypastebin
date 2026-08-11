const encoder = new TextEncoder()
const decoder = new TextDecoder('utf-8')

const PBKDF2_ITERATIONS = 1_000_000

const AES_KEY_BIT_LENGTH = 256
const STRING_CONVERSION_CHUNK_SIZE = 8192

const bufferSourceToUint8Array = (input: BufferSource) => {
  if (input instanceof ArrayBuffer) {
    return new Uint8Array(input)
  }

  return new Uint8Array(input.buffer, input.byteOffset, input.byteLength)
}

export const arrayBufferToString = (buf: BufferSource) => {
  const bytes = bufferSourceToUint8Array(buf)
  let str = ''

  for (let i = 0; i < bytes.length; i += STRING_CONVERSION_CHUNK_SIZE) {
    const chunk = bytes.subarray(i, i + STRING_CONVERSION_CHUNK_SIZE)
    str += String.fromCharCode(...chunk)
  }

  return str
}

export const arrayBufferToBase64 = (buf: BufferSource) => {
  const str = arrayBufferToString(buf)
  return window.btoa(str)
}

export const stringToArrayBuffer = (str: string) => {
  const buf = new ArrayBuffer(str.length)
  const bufView = new Uint8Array(buf)
  for (let i = 0, strLen = str.length; i < strLen; i++) {
    bufView[i] = str.charCodeAt(i)
  }
  return buf
}

export const base64toArrayBuffer = (str: string) =>
  stringToArrayBuffer(window.atob(str))

export const getRandomValues = (size = 16) =>
  crypto.getRandomValues(new Uint8Array(size))

const getKeyFromPassword = (password: string, salt: BufferSource) =>
  window.crypto.subtle
    .importKey('raw', encoder.encode(password), { name: 'PBKDF2' }, false, [
      'deriveBits',
      'deriveKey',
    ])
    .then((rawKey) =>
      window.crypto.subtle.deriveKey(
        {
          name: 'PBKDF2',
          salt,
          iterations: PBKDF2_ITERATIONS,
          hash: 'SHA-256',
        },
        rawKey,
        { name: 'AES-GCM', length: AES_KEY_BIT_LENGTH },
        false, // not extractible
        ['encrypt', 'decrypt']
      )
    )

const encryptRaw = (
  key: CryptoKey,
  iv: BufferSource,
  inputToEncrypt: BufferSource
) =>
  crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv,
    },
    key,
    inputToEncrypt
  )

const decryptRaw = (
  key: CryptoKey,
  iv: BufferSource,
  encryptedData: BufferSource
) =>
  crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv,
    },
    key,
    encryptedData
  )

export const encrypt = (password: string, msg: string) => {
  const salt = getRandomValues()
  const iv = getRandomValues() // always generate a new initialization vector

  return getKeyFromPassword(password, salt)
    .then((key) => {
      const inputToEncrypt = encoder.encode(msg)
      return encryptRaw(key, iv, inputToEncrypt)
    })
    .then((encryptedBuffer) => {
      return {
        content: arrayBufferToBase64(encryptedBuffer),
        salt: arrayBufferToBase64(salt),
        iv: arrayBufferToBase64(iv),
      }
    })
}

export const encryptBuffer = (password: string, msg: ArrayBuffer) => {
  const salt = getRandomValues()
  const iv = getRandomValues()

  return getKeyFromPassword(password, salt)
    .then((key) => encryptRaw(key, iv, msg))
    .then((encryptedBuffer) => ({
      content: arrayBufferToBase64(encryptedBuffer),
      salt: arrayBufferToBase64(salt),
      iv: arrayBufferToBase64(iv),
    }))
}

export const decrypt = (
  password: string,
  saltInBase64: string,
  ivInBase64: string,
  encryptedDataInBase64: string
) => {
  const salt = base64toArrayBuffer(saltInBase64)
  const iv = base64toArrayBuffer(ivInBase64)

  return getKeyFromPassword(password, salt)
    .then((key) =>
      decryptRaw(key, iv, base64toArrayBuffer(encryptedDataInBase64))
    )
    .then((result) => decoder.decode(new Uint8Array(result)))
}

export const decryptBuffer = (
  password: string,
  saltInBase64: string,
  ivInBase64: string,
  encryptedData: ArrayBuffer
) => {
  const salt = base64toArrayBuffer(saltInBase64)
  const iv = base64toArrayBuffer(ivInBase64)

  return getKeyFromPassword(password, salt).then((key) =>
    decryptRaw(key, iv, encryptedData)
  )
}
