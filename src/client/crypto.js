const encoder = new TextEncoder('utf-8')
const decoder = new TextDecoder('utf-8')

const PBKDF2_ITERATIONS = 1_000_000

const AES_KEY_BIT_LENGTH = 256

export const arrayBufferToString = (buf) =>
  String.fromCharCode.apply(null, new Uint8Array(buf))

export const arrayBufferToBase64 = (buf) =>
  window.btoa(arrayBufferToString(buf))

export const stringToArrayBuffer = (str) => {
  const buf = new ArrayBuffer(str.length)
  const bufView = new Uint8Array(buf)
  for (var i = 0, strLen = str.length; i < strLen; i++) {
    bufView[i] = str.charCodeAt(i)
  }
  return buf
}

export const base64toArrayBuffer = (str) =>
  stringToArrayBuffer(window.atob(str))

export const getSalt = () => crypto.getRandomValues(new Uint8Array(8))

const getKeyFromPassword = (password, salt) =>
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
        { name: 'AES-CBC', length: AES_KEY_BIT_LENGTH },
        false, // not extractible
        ['encrypt', 'decrypt']
      )
    )

export const getIV = () => crypto.getRandomValues(new Uint8Array(16))

export const encrypt = (password, msg) => {
  const salt = getSalt()
  const iv = getIV()

  return getKeyFromPassword(password, salt)
    .then((key) => {
      const inputToEncrypt = encoder.encode(msg)
      return crypto.subtle.encrypt(
        {
          name: 'AES-CBC',
          iv, // AES-CBC requires a 128-bit initialization vector (iv).
        },
        key,
        inputToEncrypt
      )
    })
    .then((encryptedBuffer) => {
      return {
        content: arrayBufferToBase64(encryptedBuffer),
        salt: arrayBufferToBase64(salt),
        iv: arrayBufferToBase64(iv),
      }
    })
}

export const decrypt = (
  password,
  saltInBase64,
  ivInBase64,
  encryptedDataInBase64
) => {
  const salt = base64toArrayBuffer(saltInBase64)
  const iv = base64toArrayBuffer(ivInBase64)

  return getKeyFromPassword(password, salt).then((key) =>
    crypto.subtle
      .decrypt(
        { name: 'AES-CBC', iv },
        key,
        base64toArrayBuffer(encryptedDataInBase64)
      )
      .then((result) => decoder.decode(new Uint8Array(result)))
  )
}
