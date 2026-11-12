import { afterEach, describe, expect, it, vi } from 'vitest'
import { SITE } from '../config/site'
import {
  calculateBookingPrice,
  calcBookingTotal,
  generateTimeSlots,
  getMaxBookableDuration,
} from './helpers'

const defaultRules = {
  advancePercent: 30,
  peakHoursStart: 18,
  peakHoursEnd: 22,
  weekendMultiplier: 1.2,
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('booking availability', () => {
  it('limits duration to consecutive free hours before closing', () => {
    expect(getMaxBookableDuration('20:00', [], '23:00')).toBe(3)
    expect(getMaxBookableDuration('20:00', ['21:00'], '23:00')).toBe(1)
    expect(getMaxBookableDuration('22:00', [], '23:00')).toBe(1)
  })

  it('uses the configured weekend opening time when generating slots', () => {
    const saturdaySlots = generateTimeSlots([], '2026-11-14')
    const weekdaySlots = generateTimeSlots([], '2026-11-13')

    expect(saturdaySlots[0].time).toBe(SITE.openingHours.weekend.open)
    expect(weekdaySlots[0].time).toBe(SITE.openingHours.weekday.open)
    expect(saturdaySlots[saturdaySlots.length - 1]?.time).toBe('22:00')
  })
})

describe('booking pricing', () => {
  it('prices each hour separately when a booking crosses into peak time', () => {
    const result = calculateBookingPrice(2000, 3000, '17:00', 2, defaultRules, false)

    expect(result.hourlyRates).toEqual([2000, 3000])
    expect(result.total).toBe(5000)
    expect(result.advance).toBe(1500)
    expect(result.balance).toBe(3500)
    expect(result.isPeak).toBe(true)
  })

  it('applies saved admin overrides, advance percent, and weekend multiplier', () => {
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(() => JSON.stringify({
        advancePercent: 50,
        peakHoursStart: 18,
        peakHoursEnd: 22,
        weekendMultiplier: 1.2,
        facilityOverrides: { '1': { pricePerHour: 2500, peakPricePerHour: 4000 } },
      })),
    })

    const result = calcBookingTotal(2000, 3000, '17:00', 2, '2026-11-14', '1')

    expect(result.hourlyRates).toEqual([3000, 4800])
    expect(result.total).toBe(7800)
    expect(result.advance).toBe(3900)
    expect(result.balance).toBe(3900)
  })
})
