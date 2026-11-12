import { Slot } from '@/types'
import { AdminPricingSettings, getPricingSettings, savePricingSettings } from './helpers'

/** Keep the legacy hook API on the same booking store as the main flow. */
export { getBookings, setBookings } from './helpers'

export const getSlots = (facilityId: string, date: string): Slot[] => {
  const raw = localStorage.getItem('arena_x_slot_overrides')
  if (!raw) return []
  const all = JSON.parse(raw) as Record<string, Record<string, Slot[]>>
  return all[facilityId]?.[date] ?? []
}

export const setSlots = (facilityId: string, date: string, slots: Slot[]) => {
  const raw = localStorage.getItem('arena_x_slot_overrides')
  const all = raw ? (JSON.parse(raw) as Record<string, Record<string, Slot[]>>) : {}
  if (!all[facilityId]) all[facilityId] = {}
  all[facilityId][date] = slots
  localStorage.setItem('arena_x_slot_overrides', JSON.stringify(all))
}

export const getPricingOverrides = (): Partial<AdminPricingSettings['facilityOverrides']> =>
  getPricingSettings().facilityOverrides

export const setPricingOverrides = (
  overrides: Partial<AdminPricingSettings['facilityOverrides']>,
) => {
  const current = getPricingSettings()
  savePricingSettings({
    ...current,
    facilityOverrides: { ...current.facilityOverrides, ...overrides } as AdminPricingSettings['facilityOverrides'],
  })
}
