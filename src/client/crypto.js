const encoder = new TextEncoder('utf-8')
const decoder = new TextDecoder('utf-8')

const arrayBufferToString = (buf) =>
  String.fromCharCode.apply(null, new Uint8Array(buf))

const arrayBufferToBase64 = (buf) => window.btoa(arrayBufferToString(buf))

const stringToArrayBuffer = (str) => {
  const buf = new ArrayBuffer(str.length)
  const bufView = new Uint8Array(buf)
  for (var i = 0, strLen = str.length; i < strLen; i++) {
    bufView[i] = str.charCodeAt(i)
  }
  return buf
}

const base64toArrayBuffer = (str) => stringToArrayBuffer(window.atob(str))

const getSalt = () => crypto.getRandomValues(new Uint8Array(8))

const getKeyFromPassword = (password, salt) =>
  window.crypto.subtle
    .importKey('raw', encoder.encode(password), { name: 'PBKDF2' }, false, [
      'deriveBits',
      'deriveKey',
    ])
    .then((rawKey) =>
      window.crypto.subtle.deriveKey(
        { name: 'PBKDF2', salt, iterations: 1000, hash: 'SHA-256' },
        rawKey,
        { name: 'AES-CBC', length: 256 },
        false, // not extractible
        ['encrypt', 'decrypt']
      )
    )

const getIV = () => crypto.getRandomValues(new Uint8Array(16))

const encrypt = (password, msg) => {
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

const decrypt = (password, saltInBase64, ivInBase64, encryptedDataInBase64) => {
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

if (typeof module !== 'undefined') {
  module.exports = {
    arrayBufferToString,
    arrayBufferToBase64,
    stringToArrayBuffer,
    base64toArrayBuffer,
    getIV,
    getSalt,
    encrypt,
    decrypt,
  }
}
