import { createHmac, timingSafeEqual } from 'node:crypto'

export function hmacSha256(secret, message) {
  return createHmac('sha256', secret).update(message).digest('hex')
}

export function safeEqualHex(provided, expected) {
  if (typeof provided !== 'string' || !/^[a-f0-9]{64}$/i.test(provided)) return false
  const a = Buffer.from(provided, 'hex')
  const b = Buffer.from(expected, 'hex')
  return a.length === b.length && timingSafeEqual(a, b)
}

export function verifyHmacSha256(secret, message, provided) {
  return safeEqualHex(provided, hmacSha256(secret, message))
}
