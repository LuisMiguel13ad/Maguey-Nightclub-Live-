import '@testing-library/jest-dom'
import { webcrypto } from 'node:crypto'

// jsdom doesn't provide crypto.subtle — polyfill from Node.js webcrypto
if (!globalThis.crypto?.subtle) {
  Object.defineProperty(globalThis, 'crypto', {
    value: webcrypto,
  })
}
