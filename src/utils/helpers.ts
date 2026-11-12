import { SITE } from '../config/site'
import { Slot, SavedBooking } from '../types'
import { SAMPLE_BOOKINGS } from '../data/mockData'

/** Format number as INR currency */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

/** Read the currently configured pricing rules, falling back to site defaults. */
export function getPricingSettings(): AdminPricingSettings {
  const defaults: AdminPricingSettings = {
    advancePercent: SITE.pricing.advancePercent,
    peakHoursStart: SITE.pricing.peakHoursStart,
    peakHoursEnd: SITE.pricing.peakHoursEnd,
    weekendMultiplier: SITE.pricing.weekendMultiplier,
    facilityOverrides: {},
  }
  try {
    const raw = localStorage.getItem('arena_x_pricing_settings')
    return raw ? { ...defaults, ...JSON.parse(raw) } : defaults
  } catch {
    return defaults
  }
}

/** Check if a time string (HH:MM) falls in the configured peak window. */
export function isPeakHour(time: string, settings = getPricingSettings()): boolean {
  const hour = parseInt(time.split(':')[0], 10)
  return hour >= settings.peakHoursStart && hour < settings.peakHoursEnd
}

/** Get hourly price based on peak/off-peak */
export function getFacilityPricing(facilityId: string, basePrice: number, peakPrice: number) {
  const override = getPricingSettings().facilityOverrides[facilityId]
  return {
    basePrice: override?.pricePerHour ?? basePrice,
    peakPrice: override?.peakPricePerHour ?? peakPrice,
  }
}

export function getHourlyRate(basePrice: number, peakPrice: number, time: string, date = ''): number {
  const settings = getPricingSettings()
  const day = date ? new Date(`${date}T12:00:00`).getDay() : -1
  const multiplier = day === 0 || day === 6 ? settings.weekendMultiplier : 1
  return Math.round((isPeakHour(time, settings) ? peakPrice : basePrice) * multiplier)
}

/** Pure pricing calculation for a consecutive booking. */
export function calculateBookingPrice(
  basePrice: number,
  peakPrice: number,
  startTime: string,
  hours: number,
  rules: Pick<AdminPricingSettings, 'advancePercent' | 'peakHoursStart' | 'peakHoursEnd' | 'weekendMultiplier'>,
  isWeekend: boolean,
) {
  const startHour = Number(startTime.split(':')[0])
  const hourlyRates = Array.from({ length: hours }, (_, index) => {
    const hour = startHour + index
    const peak = hour >= rules.peakHoursStart && hour < rules.peakHoursEnd
    const rate = peak ? peakPrice : basePrice
    return Math.round(rate * (isWeekend ? rules.weekendMultiplier : 1))
  })
  const total = hourlyRates.reduce((sum, rate) => sum + rate, 0)
  const advance = Math.round(total * (rules.advancePercent / 100))
  return {
    hourlyRate: hourlyRates[0] ?? basePrice,
    total,
    advance,
    balance: total - advance,
    isPeak: hourlyRates.some((rate, index) => {
      const hour = startHour + index
      return hour >= rules.peakHoursStart && hour < rules.peakHoursEnd
    }),
    hourlyRates,
  }
}

/** Calculate each booked hour using configured facility and weekend rates. */
export function calcBookingTotal(
  basePrice: number,
  peakPrice: number,
  startTime: string,
  hours: number,
  date?: string,
  facilityId?: string,
  databaseRules?: Pick<AdminPricingSettings, 'advancePercent' | 'peakHoursStart' | 'peakHoursEnd' | 'weekendMultiplier'>,
) {
  const settings = { ...getPricingSettings(), ...databaseRules }
  const facilityPrices = facilityId && !databaseRules
    ? getFacilityPricing(facilityId, basePrice, peakPrice)
    : { basePrice, peakPrice }
  const day = date ? new Date(`${date}T12:00:00`).getDay() : -1
  return calculateBookingPrice(
    facilityPrices.basePrice,
    facilityPrices.peakPrice,
    startTime,
    hours,
    settings,
    day === 0 || day === 6,
  )
}

/** Return how many consecutive hours can be booked before close or a blocked slot. */
export function getMaxBookableDuration(
  startTime: string,
  blockedTimes: string[],
  closingTime: string,
  maximum = Number.POSITIVE_INFINITY,
): number {
  const startHour = Number(startTime.split(':')[0])
  const closeHour = Number(closingTime.split(':')[0])
  let available = 0
  while (available < maximum && startHour + available < closeHour) {
    const hour = `${String(startHour + available).padStart(2, '0')}:00`
    if (blockedTimes.includes(hour)) break
    available += 1
  }
  return available
}

export function getOperatingHours(date: string) {
  const day = date ? new Date(`${date}T12:00:00`).getDay() : -1
  return day === 0 || day === 6 ? SITE.openingHours.weekend : SITE.openingHours.weekday
}

/** Generate one-hour start times for the facility's operating hours. */
export function generateTimeSlots(bookedTimes: string[] = [], date = ''): Slot[] {
  const slots: Slot[] = []
  const hours = getOperatingHours(date)
  const start = Number(hours.open.split(':')[0])
  const end = Number(hours.close.split(':')[0])

  for (let h = start; h < end; h++) {
    const time = `${String(h).padStart(2, '0')}:00`
    const label = h < 12
      ? `${h} AM`
      : h === 12
      ? '12 PM'
      : `${h - 12} PM`

    const isBooked = bookedTimes.includes(time)
    
    slots.push({
      time,
      label,
      status: isBooked ? 'booked' : 'available',
    })
  }

  return slots
}

/** Generate a unique booking ID */
export function generateBookingId(): string {
  const prefix = 'AX'
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const random = Math.floor(100 + Math.random() * 900)
  return `${prefix}${dateStr}${random}`
}

/** Save booking to localStorage */
export function saveBooking(booking: SavedBooking): void {
  const existing = getBookings()
  existing.unshift(booking)
  setBookings(existing)
}

export function setBookings(bookings: SavedBooking[]): void {
  localStorage.setItem('arena_x_bookings', JSON.stringify(bookings))
}

/** Load all bookings from localStorage (seeded with SAMPLE_BOOKINGS on first run) */
export function getBookings(): SavedBooking[] {
  try {
    const raw = localStorage.getItem('arena_x_bookings')
    if (!raw) {
      localStorage.setItem('arena_x_bookings', JSON.stringify(SAMPLE_BOOKINGS))
      return SAMPLE_BOOKINGS
    }
    return JSON.parse(raw)
  } catch {
    return SAMPLE_BOOKINGS
  }
}

/** Update booking status */
export function updateBookingStatus(id: string, status: 'confirmed' | 'pending' | 'cancelled'): void {
  const bookings = getBookings()
  const updated = bookings.map(b => b.id === id ? { ...b, status } : b)
  localStorage.setItem('arena_x_bookings', JSON.stringify(updated))
}

/** Custom blocked slots storage */
export interface BlockedSlotRecord {
  facilityId: string
  date: string
  time: string
  reason?: string
}

export function getBlockedSlots(): BlockedSlotRecord[] {
  try {
    const raw = localStorage.getItem('arena_x_blocked_slots')
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function toggleBlockSlot(facilityId: string, date: string, time: string, reason = 'Maintenance'): void {
  const current = getBlockedSlots()
  const existingIdx = current.findIndex(b => b.facilityId === facilityId && b.date === date && b.time === time)
  let updated: BlockedSlotRecord[]
  if (existingIdx >= 0) {
    updated = current.filter((_, idx) => idx !== existingIdx)
  } else {
    updated = [...current, { facilityId, date, time, reason }]
  }
  localStorage.setItem('arena_x_blocked_slots', JSON.stringify(updated))
}

/** Check which times are booked or blocked for a facility on a date */
export function getBookedTimesForDate(facilityId: string, date: string): string[] {
  const bookings = getBookings()
  const bookingTimes = bookings
    .filter(b => b.facilityId === facilityId && b.date === date && b.status !== 'cancelled')
    .flatMap(b => {
      const times: string[] = []
      const startHour = parseInt(b.startTime.split(':')[0], 10)
      for (let i = 0; i < b.durationHours; i++) {
        times.push(`${String(startHour + i).padStart(2, '0')}:00`)
      }
      return times
    })

  const blocked = getBlockedSlots()
    .filter(b => b.facilityId === facilityId && b.date === date)
    .map(b => b.time)

  let slotOverrides: string[] = []
  try {
    const raw = localStorage.getItem('arena_x_slot_overrides')
    if (raw) {
      const all = JSON.parse(raw) as Record<string, Record<string, Slot[]>>
      slotOverrides = (all[facilityId]?.[date] ?? [])
        .filter(slot => slot.status === 'booked' || slot.status === 'unavailable')
        .map(slot => slot.time)
    }
  } catch {
    slotOverrides = []
  }

  return Array.from(new Set([...bookingTimes, ...blocked, ...slotOverrides]))
}

/** Pricing settings persistence */
export interface AdminPricingSettings {
  advancePercent: number
  peakHoursStart: number
  peakHoursEnd: number
  weekendMultiplier: number
  facilityOverrides: Record<string, { pricePerHour: number; peakPricePerHour: number }>
}

export function savePricingSettings(settings: AdminPricingSettings): void {
  localStorage.setItem('arena_x_pricing_settings', JSON.stringify(settings))
}

/** Format date for display */
export function formatDate(dateStr: string): string {
  if (!dateStr) return ''
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-IN', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

/** Get today's date string YYYY-MM-DD */
export function todayString(): string {
  const now = new Date()
  const localDate = new Date(now.getTime() - now.getTimezoneOffset() * 60_000)
  return localDate.toISOString().split('T')[0]
}
