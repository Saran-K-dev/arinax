export function bookingHoldStorageKey(userId: string, input: {
  facilityId: string; date: string; startTime: string; durationHours: number
}) {
  return `arena-x:booking-hold:${userId}:${input.facilityId}:${input.date}:${input.startTime}:${input.durationHours}`
}

export function getOrCreateBookingHoldToken(
  storage: Pick<Storage, 'getItem' | 'setItem'>,
  key: string,
  createToken: () => string = () => crypto.randomUUID(),
) {
  const saved = storage.getItem(key)
  if (saved) return saved
  const token = createToken()
  storage.setItem(key, token)
  return token
}

export function rotateBookingHoldToken(storage: Pick<Storage, 'setItem'>, key: string, createToken: () => string = () => crypto.randomUUID()) {
  const token = createToken()
  storage.setItem(key, token)
  return token
}
