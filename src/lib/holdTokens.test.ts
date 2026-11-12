import { describe, expect, it } from 'vitest'
import { bookingHoldStorageKey, getOrCreateBookingHoldToken, rotateBookingHoldToken } from './holdTokens'

function memoryStorage(): Storage {
  const values = new Map<string, string>()
  return {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, String(value)) },
    removeItem: key => { values.delete(key) },
    clear: () => values.clear(),
    key: index => [...values.keys()][index] ?? null,
    get length() { return values.size },
  }
}

describe('checkout hold tokens', () => {
  it('reuses one token for the same user and exact slot after refresh', () => {
    const storage = memoryStorage()
    const key = bookingHoldStorageKey('customer-1', { facilityId: 'facility-1', date: '2026-12-01', startTime: '18:00', durationHours: 2 })
    expect(getOrCreateBookingHoldToken(storage, key, () => 'stable-token')).toBe('stable-token')
    expect(getOrCreateBookingHoldToken(storage, key, () => 'unexpected-new-token')).toBe('stable-token')
  })

  it('rotates a consumed token when an old hold expired or was released', () => {
    const storage = memoryStorage()
    const key = 'checkout-key'
    getOrCreateBookingHoldToken(storage, key, () => 'old-token')
    expect(rotateBookingHoldToken(storage, key, () => 'fresh-token')).toBe('fresh-token')
    expect(getOrCreateBookingHoldToken(storage, key, () => 'unexpected-token')).toBe('fresh-token')
  })
})
