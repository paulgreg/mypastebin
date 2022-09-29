const { TextEncoder, TextDecoder } = require('util')
const crypto = require('crypto')

global.TextEncoder = TextEncoder
global.TextDecoder = TextDecoder

Object.defineProperty(global.self, 'crypto', {
  value: crypto.webcrypto,
})
