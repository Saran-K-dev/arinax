import test from 'node:test'
import assert from 'node:assert/strict'
import { hmacSha256, verifyHmacSha256 } from '../server/signatures.mjs'

test('accepts a valid Razorpay style SHA-256 signature', () => {
  const signature = hmacSha256('test-secret', 'order_123|pay_456')
  assert.equal(verifyHmacSha256('test-secret', 'order_123|pay_456', signature), true)
})

test('rejects changed messages, secrets, malformed and truncated signatures', () => {
  const signature = hmacSha256('test-secret', 'order_123|pay_456')
  assert.equal(verifyHmacSha256('test-secret', 'order_123|pay_457', signature), false)
  assert.equal(verifyHmacSha256('wrong-secret', 'order_123|pay_456', signature), false)
  assert.equal(verifyHmacSha256('test-secret', 'order_123|pay_456', 'xyz'), false)
  assert.equal(verifyHmacSha256('test-secret', 'order_123|pay_456', signature.slice(0, 40)), false)
})

test('verifies webhook signatures against the exact raw request bytes', () => {
  const raw = Buffer.from('{"event":"payment.captured"}')
  const signature = hmacSha256('webhook-secret', raw)
  assert.equal(verifyHmacSha256('webhook-secret', raw, signature), true)
  assert.equal(verifyHmacSha256('webhook-secret', Buffer.from('{ "event":"payment.captured"}'), signature), false)
})
