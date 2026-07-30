import {
  stringToArrayBuffer,
  arrayBufferToString,
  base64toArrayBuffer,
  arrayBufferToBase64,
  encrypt,
  decrypt,
  encryptBuffer,
  decryptBuffer,
  getRandomValues,
} from './crypto'

describe('crypto', () => {
  describe('arraybuffer to/from string or base64 conversions', () => {
    const originalMsg = 'original message!'
    const originMsgUInt8Array = new Uint8Array([
      111, 114, 105, 103, 105, 110, 97, 108, 32, 109, 101, 115, 115, 97, 103,
      101, 33,
    ])
    test('should convert from and to a string', () => {
      const arrayBuffer = stringToArrayBuffer(originalMsg)
      expect(new Uint8Array(arrayBuffer)).toEqual(originMsgUInt8Array)
      expect(arrayBufferToString(arrayBuffer)).toEqual(originalMsg)
    })
    test('should convert from and to a base64 string', () => {
      const originalBase64Msg = window.btoa(originalMsg)
      const arrayBuffer = base64toArrayBuffer(originalBase64Msg)
      expect(new Uint8Array(arrayBuffer)).toEqual(originMsgUInt8Array)
      expect(arrayBufferToBase64(arrayBuffer)).toEqual(originalBase64Msg)
    })
  })

  describe('getRandomValues', () => {
    test('should return an array of 16', () =>
      expect(getRandomValues()).toHaveLength(16))
  })

  describe('encryption/decryption', () => {
    const originalMessage = 'Hello World !'
    const password = 'password12345'

    test('should encrypt then decrypt to same message with same password', () =>
      encrypt(password, originalMessage)
        .then((msg) => {
          const { content, salt, iv } = msg
          expect(content).toHaveLength(40)
          expect(salt).toHaveLength(24)
          expect(iv).toHaveLength(24)
          expect(content).not.toEqual(originalMessage)
          return msg
        })
        .then((msg) => decrypt(password, msg.salt, msg.iv, msg.content))
        .then((decryptedMessage) => {
          expect(decryptedMessage).toEqual(originalMessage)
        }))

    test('should return an error if incorrect password', () => {
      expect.assertions(1)
      return encrypt(password, originalMessage)
        .then((msg) => decrypt('otherPassword', msg.salt, msg.iv, msg.content))
        .catch((e) => {
          expect(e).toBeDefined()
        })
    })

    test('should encrypt and decrypt binary content with same password', () => {
      const originalBuffer = new Uint8Array([0, 255, 123, 56, 8, 19, 200]).buffer
      return encryptBuffer(password, originalBuffer)
        .then((msg) =>
          decryptBuffer(
            password,
            msg.salt,
            msg.iv,
            base64toArrayBuffer(msg.content)
          )
        )
        .then((decryptedBuffer) => {
          expect(new Uint8Array(decryptedBuffer)).toEqual(
            new Uint8Array(originalBuffer)
          )
        })
    })

    test('should return an error for binary content if incorrect password', () => {
      expect.assertions(1)
      const originalBuffer = new Uint8Array([1, 2, 3]).buffer
      return encryptBuffer(password, originalBuffer)
        .then((msg) =>
          decryptBuffer(
            'otherPassword',
            msg.salt,
            msg.iv,
            base64toArrayBuffer(msg.content)
          )
        )
        .catch((e) => {
          expect(e).toBeDefined()
        })
    })
  })
})
