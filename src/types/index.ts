export type SportCategory = 'cricket' | 'box-cricket' | 'football' | 'badminton' | 'multi-sport'

export interface Sport {
  id: SportCategory
  name: string
  icon: string
  description: string
}

export interface Facility {
  id: string
  name: string
  category: SportCategory
  description: string
  pricePerHour: number
  peakPricePerHour: number
  images: string[]
  amenities: string[]
  rating: number
  reviewCount: number
  location: string
  sports: string[]
  weekendMultiplier?: number
  advancePercent?: number
  peakHoursStart?: number
  peakHoursEnd?: number
  isActive?: boolean
}

export type SlotStatus = 'available' | 'booked' | 'selected' | 'unavailable'

export interface Slot {
  time: string
  status: SlotStatus
  label: string
}

export interface BookingData {
  facilityId: string
  facilityName: string
  date: string
  startTime: string
  durationHours: number
  totalPrice: number
  advance: number
  balance: number
  isPeak: boolean
  hourlyRate: number
  hourlyRates?: number[]
}

export interface CustomerInfo {
  name: string
  phone: string
  email: string
}

export interface SavedBooking extends BookingData {
  id: string
  bookingReference?: string
  amountPaid?: number
  paymentStatus?: 'unpaid' | 'pending' | 'partial' | 'paid' | 'failed' | 'refunded'
  customer: CustomerInfo
  status: 'confirmed' | 'pending' | 'cancelled'
  createdAt: string
  paymentMode: 'advance' | 'full'
}

export interface PricingOverride {
  facilityId: string
  pricePerHour: number
  peakPricePerHour: number
  weekendMultiplier: number
  advancePercent: number
}
