import { requireSupabase } from './supabase'
import { Facility } from '../types'
import { SavedBooking } from '../types'
import { bookingHoldStorageKey, getOrCreateBookingHoldToken, rotateBookingHoldToken } from './holdTokens'

type FacilityRow = {
  id: string; name: string; category: Facility['category']; description: string
  location: string; images: string[]; amenities: string[]; rating: number
  review_count: number; sports: string[]; facility_pricing?: { base_price: number; peak_price: number; weekend_multiplier: number; advance_percent: number; peak_start: number; peak_end: number } | { base_price: number; peak_price: number; weekend_multiplier: number; advance_percent: number; peak_start: number; peak_end: number }[]
}

export async function fetchFacilities(): Promise<Facility[]> {
  const { data, error } = await requireSupabase().from('facilities')
    .select('id,name,category,description,location,images,amenities,rating,review_count,sports,facility_pricing(base_price,peak_price,weekend_multiplier,advance_percent,peak_start,peak_end)')
    .eq('is_active', true).order('name')
  if (error) throw error
  return ((data ?? []) as FacilityRow[]).map(row => {
    const pricing = Array.isArray(row.facility_pricing) ? row.facility_pricing[0] : row.facility_pricing
    return {
      id: row.id, name: row.name, category: row.category, description: row.description,
      location: row.location, images: row.images ?? [], amenities: row.amenities ?? [],
      rating: Number(row.rating ?? 0), reviewCount: row.review_count ?? 0,
      sports: row.sports ?? [], pricePerHour: Number(pricing?.base_price ?? 0),
      peakPricePerHour: Number(pricing?.peak_price ?? pricing?.base_price ?? 0),
      weekendMultiplier: Number(pricing?.weekend_multiplier ?? 1),
      advancePercent: Number(pricing?.advance_percent ?? 30),
      peakHoursStart: Number(pricing?.peak_start ?? 18),
      peakHoursEnd: Number(pricing?.peak_end ?? 22),
    }
  })
}

export type BookingHold = {
  id: string; expires_at: string; hourly_rates: number[]; total_amount: number
  advance_amount: number; balance_amount: number
}

export async function createBookingHold(input: {
  facilityId: string; date: string; startTime: string; durationHours: number
}): Promise<BookingHold> {
  const client = requireSupabase()
  const { data: { user }, error: userError } = await client.auth.getUser()
  if (userError) throw userError
  if (!user) throw new Error('Sign in before reserving a slot.')

  const storageKey = bookingHoldStorageKey(user.id, input)
  const safeStorage = {
    getItem: (key: string) => { try { return window.sessionStorage.getItem(key) } catch { return null } },
    setItem: (key: string, value: string) => { try { window.sessionStorage.setItem(key, value) } catch { /* Session storage may be unavailable. */ } },
  }
  let requestToken = getOrCreateBookingHoldToken(safeStorage, storageKey)
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const { data, error } = await client.rpc('create_booking_hold', {
      p_facility_id: input.facilityId, p_booking_date: input.date,
      p_start_time: input.startTime, p_duration_hours: input.durationHours,
      p_request_token: requestToken,
    })
    if (!error) {
      return data as BookingHold
    }

    // The original hold may have expired or been released. Rotate the token once;
    // an active hold still returns idempotently with the existing token.
    if (attempt === 0 && /request token is already used/i.test(error.message)) {
      requestToken = rotateBookingHoldToken(safeStorage, storageKey)
      continue
    }
    throw error
  }
  throw new Error('Could not restore the booking hold. Please retry.')
}

export async function finalizeBookingHold(input: {
  holdId: string; customerName: string; phone: string; paymentMode: 'advance' | 'full'
}) {
  const { data, error } = await requireSupabase().rpc('finalize_booking_hold', {
    p_hold_id: input.holdId, p_customer_name: input.customerName,
    p_customer_phone: input.phone, p_payment_mode: input.paymentMode,
  })
  if (error) throw error
  return data as { id: string; booking_reference: string; created_at: string; status: 'pending';
    payment_status: 'unpaid'; total_amount: number; advance_amount: number; balance_amount: number }
}

export async function releaseBookingHold(holdId: string) {
  const { error } = await requireSupabase().rpc('release_booking_hold', { p_hold_id: holdId })
  if (error) throw error
}

export async function fetchUnavailableSlots(facilityId: string, date: string): Promise<string[]> {
  const { data, error } = await requireSupabase().rpc('get_unavailable_slots', {
    p_facility_id: facilityId, p_date: date,
  })
  if (error) throw error
  return (data ?? []).map((row: { start_time: string }) => row.start_time.slice(0, 5))
}

export async function fetchAdminBookings(): Promise<SavedBooking[]> {
  const { data, error } = await requireSupabase().rpc('admin_list_bookings')
  if (error) throw error
  return (data ?? []).map((row: any) => {
    return ({
    id: row.id, bookingReference: row.booking_reference, facilityId: row.facility_id, facilityName: row.facility_name ?? 'Facility',
    date: row.booking_date, startTime: String(row.start_time).slice(0, 5), durationHours: row.duration_hours,
    hourlyRate: Number(row.duration_hours ? Number(row.total_amount) / Number(row.duration_hours) : 0),
    totalPrice: Number(row.total_amount), advance: Number(row.advance_amount), balance: Number(row.balance_amount),
    amountPaid: Number(row.amount_paid ?? 0), paymentStatus: row.payment_status,
    isPeak: false, paymentMode: row.payment_mode, status: row.status, createdAt: row.created_at,
    customer: { name: row.customer_name || '', phone: row.customer_phone || '', email: row.customer_email || '' },
  })})
}

export type AdminFacilityInput = {
  id: string | null; name: string; category: Facility['category']; description: string; location: string;
  images: string[]; amenities: string[]; sports: string[]; isActive: boolean;
  basePrice: number; peakPrice: number; weekendMultiplier: number; advancePercent: number;
  peakStart: number; peakEnd: number;
}

export async function saveAdminFacility(facility: AdminFacilityInput): Promise<string> {
  const { data, error } = await requireSupabase().rpc('admin_save_facility', {
    p_id: facility.id, p_name: facility.name, p_category: facility.category,
    p_description: facility.description, p_location: facility.location,
    p_images: facility.images, p_amenities: facility.amenities, p_sports: facility.sports,
    p_is_active: facility.isActive, p_base_price: facility.basePrice, p_peak_price: facility.peakPrice,
    p_weekend_multiplier: facility.weekendMultiplier, p_advance_percent: facility.advancePercent,
    p_peak_start: facility.peakStart, p_peak_end: facility.peakEnd,
  })
  if (error) throw error
  return data as string
}

export async function fetchAdminFacilities(): Promise<Facility[]> {
  const { data, error } = await requireSupabase().from('facilities')
    .select('id,name,category,description,location,images,amenities,rating,review_count,sports,is_active,facility_pricing(base_price,peak_price,weekend_multiplier,advance_percent,peak_start,peak_end)')
    .order('name')
  if (error) throw error
  return ((data ?? []) as (FacilityRow & { is_active: boolean })[]).map(row => {
    const pricing = Array.isArray(row.facility_pricing) ? row.facility_pricing[0] : row.facility_pricing
    return {
      id: row.id, name: row.name, category: row.category, description: row.description, location: row.location,
      images: row.images ?? [], amenities: row.amenities ?? [], rating: Number(row.rating ?? 0),
      reviewCount: row.review_count ?? 0, sports: row.sports ?? [], pricePerHour: Number(pricing?.base_price ?? 0),
      peakPricePerHour: Number(pricing?.peak_price ?? pricing?.base_price ?? 0),
      weekendMultiplier: Number(pricing?.weekend_multiplier ?? 1), advancePercent: Number(pricing?.advance_percent ?? 30),
      peakHoursStart: Number(pricing?.peak_start ?? 18), peakHoursEnd: Number(pricing?.peak_end ?? 22),
      isActive: row.is_active,
    } as Facility & { isActive: boolean }
  })
}

export type AdminPayment = {
  id: string; booking_id: string; booking_reference: string; customer_name: string; customer_phone: string;
  customer_email: string | null; facility_name: string; amount: number; currency: string;
  provider: string | null; provider_reference: string | null; status: string; created_at: string
}

export async function fetchAdminPayments(): Promise<AdminPayment[]> {
  const { data, error } = await requireSupabase().rpc('admin_list_payments')
  if (error) throw error
  return (data ?? []) as AdminPayment[]
}

export type CustomerPayment = {
  id: string; booking_id: string; booking_reference: string; booking_date: string; start_time: string
  facility_name: string; amount: number; currency: string; provider: string | null
  provider_reference: string | null; status: string; created_at: string
}

export async function fetchCustomerPaymentHistory(): Promise<CustomerPayment[]> {
  const client = requireSupabase()
  const { data: { user }, error: authError } = await client.auth.getUser()
  if (authError) throw authError
  if (!user) throw new Error('Sign in to view payment history.')

  // These are customer-scoped reads. RLS independently enforces ownership.
  const { data: payments, error: paymentError } = await client.from('payments')
    .select('id,booking_id,amount,currency,provider,provider_reference,status,created_at')
    .eq('customer_id', user.id).order('created_at', { ascending: false })
  if (paymentError) throw paymentError
  if (!payments?.length) return []

  const bookingIds = [...new Set(payments.map(payment => payment.booking_id))]
  const { data: bookings, error: bookingError } = await client.from('bookings')
    .select('id,booking_reference,booking_date,start_time,facility_id')
    .in('id', bookingIds)
  if (bookingError) throw bookingError

  const facilityIds = [...new Set((bookings ?? []).map(booking => booking.facility_id))]
  const { data: facilities, error: facilityError } = facilityIds.length
    ? await client.from('facilities').select('id,name').in('id', facilityIds)
    : { data: [], error: null }
  if (facilityError) throw facilityError

  const bookingById = new Map((bookings ?? []).map(booking => [booking.id, booking]))
  const facilityById = new Map((facilities ?? []).map(facility => [facility.id, facility.name]))
  return payments.map(payment => {
    const booking = bookingById.get(payment.booking_id)
    return {
      ...payment,
      booking_reference: booking?.booking_reference ?? '—',
      booking_date: booking?.booking_date ?? '',
      start_time: String(booking?.start_time ?? '').slice(0, 5),
      facility_name: booking ? facilityById.get(booking.facility_id) ?? 'Facility' : 'Booking unavailable',
      amount: Number(payment.amount),
    }
  })
}

export async function recordAdminPayment(bookingId: string, amount: number, method: string, reference = '') {
  const { data, error } = await requireSupabase().rpc('admin_record_payment', {
    p_booking_id: bookingId, p_amount: amount, p_method: method, p_reference: reference || null,
  })
  if (error) throw error
  return data as string
}

export async function setBookingStatus(id: string, status: 'confirmed' | 'pending' | 'cancelled') {
  const { error } = await requireSupabase().from('bookings').update({ status }).eq('id', id)
  if (error) throw error
}

export type BlockedSlotRow = { id: string; facility_id: string; slot_date: string; start_time: string; duration_hours: number; reason: string }
export async function fetchBlockedSlots(facilityId: string, date: string): Promise<BlockedSlotRow[]> {
  const { data, error } = await requireSupabase().from('blocked_slots').select('id,facility_id,slot_date,start_time,duration_hours,reason').eq('facility_id', facilityId).eq('slot_date', date)
  if (error) throw error
  return (data ?? []) as BlockedSlotRow[]
}
export async function createBlockedSlot(facilityId: string, date: string, time: string) {
  const { error } = await requireSupabase().from('blocked_slots').insert({ facility_id: facilityId, slot_date: date, start_time: time, reason: 'Admin blocked / Maintenance' })
  if (error) throw error
}
export async function deleteBlockedSlot(id: string) {
  const { error } = await requireSupabase().from('blocked_slots').delete().eq('id', id)
  if (error) throw error
}

export type PricingRow = { facility_id: string; base_price: number; peak_price: number; weekend_multiplier: number; advance_percent: number; peak_start: number; peak_end: number }
export async function fetchPricing(): Promise<PricingRow[]> {
  const { data, error } = await requireSupabase().from('facility_pricing').select('facility_id,base_price,peak_price,weekend_multiplier,advance_percent,peak_start,peak_end')
  if (error) throw error
  return (data ?? []) as PricingRow[]
}
export async function savePricing(rows: PricingRow[]) {
  const { error } = await requireSupabase().from('facility_pricing').upsert(rows, { onConflict: 'facility_id' })
  if (error) throw error
}
