import { useState, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Check, ArrowRight } from 'lucide-react'
import { SITE } from '../config/site'
import { Facility, Slot, BookingData } from '../types'
import { useFacilities } from '../hooks/useFacilities'
import { fetchUnavailableSlots } from '../lib/database'
import {
  formatCurrency,
  generateTimeSlots,
  calcBookingTotal,
  getMaxBookableDuration,
  getOperatingHours,
  getPricingSettings,
  todayString,
} from '../utils/helpers'

const STEPS = ['Select Facility', 'Date & Time', 'Duration', 'Summary']

function isFutureSlot(date: string, time: string) {
  const [year, month, day] = date.split('-').map(Number)
  const [hour, minute] = time.split(':').map(Number)
  return new Date(year, month - 1, day, hour, minute || 0).getTime() > Date.now()
}

export default function Booking() {
  const { facilities, loading: facilitiesLoading, error: facilitiesError } = useFacilities()
  const location = useLocation()
  const navigate = useNavigate()
  const passedFacilityId = (location.state as { facilityId?: string } | null)?.facilityId

  const [step, setStep] = useState(passedFacilityId ? 1 : 0)
  const [selectedFacility, setSelectedFacility] = useState<Facility | null>(
    null
  )
  const [date, setDate] = useState('')
  const [slots, setSlots] = useState<Slot[]>([])
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null)
  const [duration, setDuration] = useState(1)
  const [blockedTimes, setBlockedTimes] = useState<string[]>([])
  const [availabilityLoading, setAvailabilityLoading] = useState(false)
  const [availabilityError, setAvailabilityError] = useState('')
  const pricingSettings = getPricingSettings()
  const dbPricing = selectedFacility ? {
    advancePercent: selectedFacility.advancePercent ?? pricingSettings.advancePercent,
    peakHoursStart: selectedFacility.peakHoursStart ?? pricingSettings.peakHoursStart,
    peakHoursEnd: selectedFacility.peakHoursEnd ?? pricingSettings.peakHoursEnd,
    weekendMultiplier: selectedFacility.weekendMultiplier ?? pricingSettings.weekendMultiplier,
  } : undefined

  useEffect(() => {
    if (!selectedFacility && passedFacilityId) setSelectedFacility(facilities.find(f => f.id === passedFacilityId) ?? null)
  }, [facilities, passedFacilityId, selectedFacility])

  // Availability is server-owned. Fail closed when Supabase cannot be reached.
  useEffect(() => {
    if (!selectedFacility || !date) return
    let active = true
    setAvailabilityLoading(true); setAvailabilityError(''); setSlots([]); setBlockedTimes([])
    setSelectedSlot(null); setDuration(1)
    fetchUnavailableSlots(selectedFacility.id, date).then(busy => {
      if (!active) return
      setBlockedTimes(busy)
      const nowSlots = generateTimeSlots(busy, date).map(slot =>
        isFutureSlot(date, slot.time) ? slot : { ...slot, status: 'unavailable' as const })
      setSlots(nowSlots)
    }).catch(err => {
      if (!active) return
      setAvailabilityError(err instanceof Error ? err.message : 'Could not load slot availability.')
      setSlots(generateTimeSlots([], date).map(slot => ({ ...slot, status: 'unavailable' as const })))
    }).finally(() => { if (active) setAvailabilityLoading(false) })
    return () => { active = false }
  }, [selectedFacility, date])

  const pricing = selectedSlot && selectedFacility
    ? calcBookingTotal(selectedFacility.pricePerHour, selectedFacility.peakPricePerHour, selectedSlot.time, duration, date, selectedFacility.id, dbPricing)
    : null
  const maxDuration = selectedSlot
    ? getMaxBookableDuration(selectedSlot.time, blockedTimes, getOperatingHours(date).close)
    : 0

  const canProceed = () => {
    if (step === 0) return !!selectedFacility
    if (step === 1) return !!date && !availabilityLoading && !availabilityError && !!selectedSlot && isFutureSlot(date, selectedSlot.time)
    if (step === 2) return duration >= 1 && duration <= maxDuration
    return !!selectedFacility && !!date && !!selectedSlot && duration >= 1 && duration <= maxDuration
  }

  const handleNext = () => {
    if (step < 3) setStep(s => s + 1)
    else {
      // Proceed to checkout
      if (!selectedFacility || !date || !selectedSlot || !pricing) return
      const bookingData: BookingData = {
        facilityId: selectedFacility.id,
        facilityName: selectedFacility.name,
        date,
        startTime: selectedSlot.time,
        durationHours: duration,
        totalPrice: pricing.total,
        advance: pricing.advance,
        balance: pricing.balance,
        isPeak: pricing.isPeak,
        hourlyRate: pricing.hourlyRate,
        hourlyRates: pricing.hourlyRates,
      }
      navigate('/checkout', { state: { bookingData } })
    }
  }

  return (
    <div className="pt-16 min-h-screen">
      {/* Page header */}
      <div className="bg-[#0d0d0d] border-b border-gray-800 py-8 px-4 md:px-6">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-black text-white mb-6">Book a Turf</h1>
          {/* Step indicator */}
          <div className="flex items-center gap-0">
            {STEPS.map((label, i) => (
              <div key={label} className="flex items-center flex-1">
                <div className="flex flex-col items-center">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                      i < step
                        ? 'bg-lime-500 text-black'
                        : i === step
                        ? 'bg-lime-500 text-black ring-4 ring-lime-500/30'
                        : 'bg-gray-800 text-gray-500 border border-gray-700'
                    }`}
                  >
                    {i < step ? <Check size={14} /> : i + 1}
                  </div>
                  <span className={`text-xs mt-1 font-medium hidden md:block ${i <= step ? 'text-lime-400' : 'text-gray-500'}`}>
                    {label}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`flex-1 h-0.5 mx-2 mt-[-12px] md:mt-[-24px] ${i < step ? 'bg-lime-500' : 'bg-gray-800'}`} />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 md:px-6 py-10">
        {/* ── STEP 0: Select Facility ── */}
        {step === 0 && (
          <div>
            <h2 className="text-xl font-bold text-white mb-6">Select a Facility</h2>
            {facilitiesLoading ? <p className="text-gray-400">Loading facilities…</p> : facilitiesError ? <p role="alert" className="text-red-400">{facilitiesError}</p> : <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {facilities.map(fac => (
                <button
                  key={fac.id}
                  onClick={() => setSelectedFacility(fac)}
                  className={`text-left rounded-xl border p-4 transition-all ${
                    selectedFacility?.id === fac.id
                      ? 'border-lime-500 bg-lime-500/5 shadow-lg shadow-lime-500/10'
                      : 'border-gray-800 bg-card hover:border-gray-600'
                  }`}
                >
                  <div className="flex gap-3 items-start">
                    <img
                      src={fac.images[0]}
                      alt={fac.name}
                      className="w-20 h-16 object-cover rounded-lg shrink-0"
                      onError={e => { (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1529900748604-07564a03e7a6?w=200&q=70' }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-bold text-white text-sm leading-tight">{fac.name}</h3>
                        {selectedFacility?.id === fac.id && (
                          <Check size={16} className="text-lime-500 shrink-0" />
                        )}
                      </div>
                      <p className="text-xs text-gray-400 mt-1 line-clamp-2">{fac.description}</p>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-lime-500 font-bold text-sm">
                          from {formatCurrency(fac.pricePerHour)}/hr
                        </span>
                        <span className="text-xs bg-gray-700 text-gray-300 px-2 py-0.5 rounded-full capitalize">
                          {fac.category.replace('-', ' ')}
                        </span>
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>}
          </div>
        )}

        {/* ── STEP 1: Date & Slot ── */}
        {step === 1 && selectedFacility && (
          <div>
            <h2 className="text-xl font-bold text-white mb-6">Select Date &amp; Time</h2>
            {/* Date picker */}
            <div className="mb-6">
              <label htmlFor="booking-date" className="block text-sm font-semibold text-gray-300 mb-2">Booking Date</label>
              <input
                id="booking-date"
                type="date"
                value={date}
                min={todayString()}
                onChange={e => {
                  setDate(e.target.value)
                  setDuration(1)
                }}
                className="bg-gray-800 border border-gray-700 focus:border-lime-500 rounded-lg px-4 py-2.5 text-white text-sm w-full md:w-64 outline-none transition"
              />
            </div>

            {/* Slots */}
            {date && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="text-sm font-semibold text-gray-300">Available Time Slots</label>
                  <div className="flex gap-3 text-xs">
                    <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-gray-700 inline-block" /> Available</span>
                    <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-lime-500 inline-block" /> Selected</span>
                    <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-gray-900 border border-gray-700 inline-block" /> Booked</span>
                  </div>
                </div>
                <div className="grid grid-cols-4 md:grid-cols-6 gap-2">
                  {slots.map(slot => {
                    const hour = Number(slot.time.slice(0, 2))
                    const peak = hour >= (selectedFacility.peakHoursStart ?? 18) && hour < (selectedFacility.peakHoursEnd ?? 22)
                    const isSelected = selectedSlot?.time === slot.time
                    const unavailable = slot.status === 'booked' || slot.status === 'unavailable' || !isFutureSlot(date, slot.time)
                    return (
                      <button
                        key={slot.time}
                        disabled={unavailable || availabilityLoading || !!availabilityError}
                        onClick={() => {
                          if (unavailable || availabilityLoading || availabilityError) return
                          setSelectedSlot(slot)
                          setDuration(1)
                        }}
                        className={`relative py-2.5 px-1 rounded-lg text-xs font-semibold transition-all ${
                          unavailable
                            ? 'bg-gray-900 text-gray-600 border border-gray-800 cursor-not-allowed line-through'
                            : isSelected
                            ? 'bg-lime-500 text-black shadow-lg shadow-lime-500/30'
                            : peak
                            ? 'bg-orange-950/60 text-orange-300 border border-orange-800/40 hover:border-orange-500/60'
                            : 'bg-gray-800 text-gray-300 border border-gray-700 hover:border-lime-500 hover:text-lime-400'
                        }`}
                      >
                        {slot.label}
                        {peak && slot.status !== 'booked' && (
                          <span className="absolute -top-1 -right-1 w-2 h-2 bg-orange-500 rounded-full" title="Peak hour" />
                        )}
                      </button>
                    )
                  })}
                </div>
                {availabilityLoading && <p className="mt-3 text-sm text-gray-400">Checking live availability…</p>}
                {availabilityError && <p role="alert" className="mt-3 text-sm text-red-400">Availability could not be verified. Please retry in a moment.</p>}
                <div className="mt-3 text-xs text-gray-500 flex items-center gap-1">
                  <span className="w-2 h-2 bg-orange-500 rounded-full inline-block" /> Peak hours ({selectedFacility.peakHoursStart ?? pricingSettings.peakHoursStart}:00–{selectedFacility.peakHoursEnd ?? pricingSettings.peakHoursEnd}:00) have higher rates
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── STEP 2: Duration ── */}
        {step === 2 && selectedSlot && selectedFacility && (
          <div>
            <h2 className="text-xl font-bold text-white mb-6">Select Duration</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {Array.from({ length: maxDuration }, (_, index) => index + 1).map(h => {
                const { total } = calcBookingTotal(
                  selectedFacility.pricePerHour,
                  selectedFacility.peakPricePerHour,
                  selectedSlot.time,
                  h,
                  date,
                  selectedFacility.id,
                  dbPricing,
                )
                return (
                  <button
                    key={h}
                    onClick={() => setDuration(h)}
                    aria-pressed={duration === h}
                    className={`rounded-xl border p-6 text-center transition-all ${
                      duration === h
                        ? 'border-lime-500 bg-lime-500/5 shadow-lg shadow-lime-500/10'
                        : 'border-gray-800 bg-card hover:border-gray-600'
                    }`}
                  >
                    <div className="text-4xl font-black text-white mb-1">{h}</div>
                    <div className="text-gray-400 text-sm mb-3">{h === 1 ? 'Hour' : 'Hours'}</div>
                    <div className="text-lime-500 font-bold text-lg">{formatCurrency(total)}</div>
                    <div className="text-gray-500 text-xs mt-1">total</div>
                    {duration === h && (
                      <div className="mt-3">
                        <Check size={16} className="text-lime-500 mx-auto" />
                      </div>
                    )}
                  </button>
                )
              })}
            </div>

            <p className="mt-3 text-xs text-gray-500">
              Up to {maxDuration} consecutive hour{maxDuration === 1 ? '' : 's'} available from {selectedSlot.label}, subject to other bookings and closing time.
            </p>

            {/* Price breakdown */}
            {pricing && (
              <div className="mt-6 bg-[#0d0d0d] border border-gray-800 rounded-xl p-5">
                <h3 className="font-bold text-white mb-4">Booking Summary</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between text-gray-300">
                    <span>Hourly rates</span>
                    <span className="text-right">{pricing.hourlyRates.map(formatCurrency).join(' + ')}</span>
                  </div>
                  <div className="flex justify-between text-gray-300">
                    <span>Duration</span>
                    <span>{duration} hour{duration > 1 ? 's' : ''}</span>
                  </div>
                  <div className="border-t border-gray-800 pt-2 mt-2 flex justify-between font-bold text-white">
                    <span>Total Amount</span>
                    <span className="text-lime-500">{formatCurrency(pricing.total)}</span>
                  </div>
                  <div className="flex justify-between text-gray-400">
                    <span>Advance Required ({selectedFacility.advancePercent ?? pricingSettings.advancePercent}%)</span>
                    <span>{formatCurrency(pricing.advance)}</span>
                  </div>
                  <div className="flex justify-between text-gray-400">
                    <span>Balance at Venue</span>
                    <span>{formatCurrency(pricing.balance)}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── STEP 3: Summary ── */}
        {step === 3 && selectedFacility && selectedSlot && pricing && (
          <div>
            <h2 className="text-xl font-bold text-white mb-6">Confirm Your Booking</h2>
            <div className="bg-[#0d0d0d] border border-gray-800 rounded-xl overflow-hidden">
              {/* Facility banner */}
              <img
                src={selectedFacility.images[0]}
                alt={selectedFacility.name}
                className="w-full h-40 object-cover"
                onError={e => { (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1529900748604-07564a03e7a6?w=800&q=80' }}
              />
              <div className="p-6 space-y-3 text-sm">
                {[
                  ['Facility', selectedFacility.name],
                  ['Date', date],
                  ['Start Time', selectedSlot.label],
                  ['Duration', `${duration} hour${duration > 1 ? 's' : ''}`],
                  ['Hourly Rates', pricing.hourlyRates.map(formatCurrency).join(' + ')],
                  ['Total Amount', formatCurrency(pricing.total)],
                  [`Advance (${selectedFacility.advancePercent ?? pricingSettings.advancePercent}%)`, formatCurrency(pricing.advance)],
                  ['Balance Due at Venue', formatCurrency(pricing.balance)],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between">
                    <span className="text-gray-400">{label}</span>
                    <span className="text-white font-semibold text-right">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="flex gap-3 mt-8">
          {step > 0 && (
            <button
              onClick={() => setStep(s => s - 1)}
              className="px-6 py-3 rounded-md border border-gray-600 text-gray-300 hover:border-gray-500 font-semibold text-sm transition"
            >
              Back
            </button>
          )}
          <button
            onClick={handleNext}
            disabled={!canProceed()}
            className="ml-auto flex items-center gap-2 bg-lime-500 hover:bg-lime-400 disabled:bg-gray-700 disabled:text-gray-500 text-black disabled:cursor-not-allowed font-bold px-8 py-3 rounded-md transition text-sm"
          >
            {step === 3 ? 'Proceed to Checkout' : 'Next'}
            <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </div>
  )
}

