import { useEffect, useState } from 'react'
import { Calendar, Clock, Lock, Unlock, ShieldAlert, CheckCircle, Info } from 'lucide-react'
import { Facility } from '../../types'
import {
  todayString,
  generateTimeSlots,
  formatDate,
  getOperatingHours,
} from '../../utils/helpers'
import { createBlockedSlot, deleteBlockedSlot, fetchAdminBookings, fetchAdminFacilities, fetchBlockedSlots, BlockedSlotRow } from '../../lib/database'
import { SavedBooking } from '../../types'

export default function AdminSlots() {
  const [facilities, setFacilities] = useState<(Facility & { isActive?: boolean })[]>([])
  const [selectedFacilityId, setSelectedFacilityId] = useState('')
  const [selectedDate, setSelectedDate] = useState(todayString())
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const [activeBookings, setActiveBookings] = useState<SavedBooking[]>([])
  const [blockedSlots, setBlockedSlots] = useState<BlockedSlotRow[]>([])
  const [loadError, setLoadError] = useState('')

  useEffect(() => { fetchAdminFacilities().then(setFacilities).catch(e => setLoadError(e instanceof Error ? e.message : 'Could not load facilities.')) }, [])

  useEffect(() => { if (!selectedFacilityId && facilities.length) setSelectedFacilityId(facilities[0].id) }, [facilities, selectedFacilityId])
  useEffect(() => {
    if (!selectedFacilityId) return
    Promise.all([fetchAdminBookings(), fetchBlockedSlots(selectedFacilityId, selectedDate)])
      .then(([bookings, blocks]) => {
        setActiveBookings(bookings.filter(b => b.facilityId === selectedFacilityId && b.date === selectedDate && b.status !== 'cancelled'))
        setBlockedSlots(blocks); setLoadError('')
      }).catch(e => setLoadError(e instanceof Error ? e.message : 'Could not load slot availability.'))
  }, [selectedFacilityId, selectedDate, refreshTrigger])
  const selectedFacility = facilities.find((f) => f.id === selectedFacilityId) || facilities[0]
  if (!selectedFacility) return <div className="text-gray-400">Loading facility data…</div>

  const bookedTimeMap = new Map<string, string>()
  activeBookings.forEach((b) => {
    const startHour = parseInt(b.startTime.split(':')[0], 10)
    for (let i = 0; i < b.durationHours; i++) {
      const timeStr = `${String(startHour + i).padStart(2, '0')}:00`
      bookedTimeMap.set(timeStr, `${b.customer.name} (${b.id})`)
    }
  })

  // Get blocked slots
  const blockedTimes = new Set(
    blockedSlots.map((b) => String(b.start_time).slice(0, 5))
  )
  const blockedMap = new Map(blockedSlots.map(b => [String(b.start_time).slice(0, 5), b.id]))

  const rawSlots = generateTimeSlots([], selectedDate)
  const operatingHours = getOperatingHours(selectedDate)
  const facilityPricing = { basePrice: selectedFacility.pricePerHour, peakPrice: selectedFacility.peakPricePerHour }

  const handleToggleBlock = async (time: string) => {
    if (bookedTimeMap.has(time)) {
      alert('This slot already has an active customer booking. Cancel the booking first to block it.')
      return
    }
    try {
      const id = blockedMap.get(time)
      if (id) await deleteBlockedSlot(id)
      else await createBlockedSlot(selectedFacilityId, selectedDate, time)
      setRefreshTrigger((prev) => (prev + 1))
      setLoadError('')
    } catch (e) { setLoadError(e instanceof Error ? e.message : 'Could not update blocked slot.') }
  }

  const availableCount = rawSlots.filter(
    (s) => !bookedTimeMap.has(s.time) && !blockedTimes.has(s.time)
  ).length
  const bookedCount = bookedTimeMap.size
  const blockedCount = blockedTimes.size

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-white">Slot Management &amp; Availability</h1>
          <p className="text-gray-400 text-sm mt-1">
            Real-time daily calendar grid. Inspect bookings and block or release slots for maintenance.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="flex items-center gap-1.5 bg-gray-800 text-gray-300 px-3 py-1.5 rounded-lg border border-gray-700">
            <span className="w-2.5 h-2.5 rounded-full bg-lime-500" /> Available ({availableCount})
          </span>
          <span className="flex items-center gap-1.5 bg-gray-800 text-gray-300 px-3 py-1.5 rounded-lg border border-gray-700">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500" /> Booked ({bookedCount})
          </span>
          <span className="flex items-center gap-1.5 bg-gray-800 text-gray-300 px-3 py-1.5 rounded-lg border border-gray-700">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500" /> Blocked ({blockedCount})
          </span>
        </div>
      </div>

      {/* Control Bar: Select Facility & Date */}
      {loadError && <p role="alert" className="text-red-400">{loadError}</p>}
      <div className="bg-card rounded-xl border border-gray-800 p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
            Select Facility
          </label>
          <select
            value={selectedFacilityId}
            onChange={(e) => setSelectedFacilityId(e.target.value)}
            className="w-full bg-[#141414] border border-gray-700 focus:border-lime-500 rounded-lg px-3 py-2.5 text-sm text-white outline-none transition"
          >
            {facilities.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name} ({f.category.replace('-', ' ')})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
            Select Date
          </label>
          <div className="relative">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full bg-[#141414] border border-gray-700 focus:border-lime-500 rounded-lg px-3 py-2 text-sm text-white outline-none transition"
            />
          </div>
        </div>
      </div>

      {/* Facility Quick Info */}
      <div className="bg-lime-500/10 border border-lime-500/20 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 text-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-lime-500/20 flex items-center justify-center text-lime-400 font-bold">
            {selectedFacility.category.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <h3 className="font-bold text-white text-base">{selectedFacility.name}</h3>
            <p className="text-gray-400 text-xs">{formatDate(selectedDate)} · Operating Hours: {operatingHours.open} – {operatingHours.close}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-lime-400 bg-lime-500/10 px-3 py-1.5 rounded-lg border border-lime-500/20 self-start md:self-auto">
          <Info size={14} /> Click any available slot to block it, or click a blocked slot to release it.
        </div>
      </div>

      {/* Slot Grid */}
      <div className="bg-card rounded-xl border border-gray-800 p-6">
        <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <Clock size={18} className="text-lime-500" />
          Time Slot Availability Grid (1-Hour Intervals)
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {rawSlots.map((slot) => {
            const isBooked = bookedTimeMap.has(slot.time)
            const isBlocked = blockedTimes.has(slot.time)
            const slotHour = Number(slot.time.slice(0, 2))
            const isPeak = slotHour >= (selectedFacility.peakHoursStart ?? 18) && slotHour < (selectedFacility.peakHoursEnd ?? 22)
            const customerDetail = bookedTimeMap.get(slot.time)

            return (
              <div
                key={slot.time}
                className={`rounded-xl border p-3.5 flex flex-col justify-between transition-all ${
                  isBooked
                    ? 'bg-blue-950/20 border-blue-800/50'
                    : isBlocked
                    ? 'bg-red-950/20 border-red-800/50'
                    : isPeak
                    ? 'bg-orange-950/20 border-orange-800/40 hover:border-lime-500'
                    : 'bg-[#141414] border-gray-800 hover:border-lime-500'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-base font-black text-white">{slot.label}</span>
                    <span className="text-[10px] text-gray-500 ml-1 font-mono">({slot.time})</span>
                  </div>
                  {isBooked ? (
                    <span className="bg-blue-500/10 text-blue-400 text-[10px] font-bold px-2 py-0.5 rounded-full border border-blue-500/30">
                      Booked
                    </span>
                  ) : isBlocked ? (
                    <span className="bg-red-500/10 text-red-400 text-[10px] font-bold px-2 py-0.5 rounded-full border border-red-500/30">
                      Blocked
                    </span>
                  ) : (
                    <span className="bg-lime-500/10 text-lime-400 text-[10px] font-bold px-2 py-0.5 rounded-full border border-lime-500/30">
                      Available
                    </span>
                  )}
                </div>

                <div className="my-2 text-xs">
                  {isBooked ? (
                    <div className="text-blue-300 truncate font-medium">
                      👤 {customerDetail}
                    </div>
                  ) : isBlocked ? (
                    <div className="text-red-300 font-medium flex items-center gap-1">
                      <Lock size={12} /> Maintenance / Held
                    </div>
                  ) : (
                    <div className="text-gray-400 flex items-center gap-1">
                      {isPeak ? (
                        <span className="text-orange-400 font-medium">⚡ Peak Slot</span>
                      ) : (
                        <span>Standard Off-Peak</span>
                      )}
                    </div>
                  )}
                </div>

                <div className="pt-2 border-t border-gray-800/80 flex items-center justify-between">
                  <span className="text-[11px] text-gray-500">
                    {isPeak ? '₹' + facilityPricing.peakPrice : '₹' + facilityPricing.basePrice}/hr
                  </span>
                  {!isBooked && (
                    <button
                      onClick={() => handleToggleBlock(slot.time)}
                      className={`text-xs font-semibold px-2.5 py-1 rounded-md transition flex items-center gap-1 ${
                        isBlocked
                          ? 'bg-lime-500/10 hover:bg-lime-500/20 text-lime-400 border border-lime-500/30'
                          : 'bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30'
                      }`}
                    >
                      {isBlocked ? (
                        <>
                          <Unlock size={12} /> Unblock
                        </>
                      ) : (
                        <>
                          <Lock size={12} /> Block
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

