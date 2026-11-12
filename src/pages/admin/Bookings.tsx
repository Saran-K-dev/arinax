import { useState, useEffect } from 'react'
import {
  Search,
  Filter,
  CheckCircle,
  Clock,
  XCircle,
  Phone,
  Mail,
  Download,
  Calendar as CalendarIcon,
} from 'lucide-react'
import { SavedBooking } from '../../types'
import { formatCurrency, formatDate, todayString } from '../../utils/helpers'
import { fetchAdminBookings, fetchAdminFacilities, setBookingStatus } from '../../lib/database'

export default function AdminBookings() {
  const [bookings, setBookings] = useState<SavedBooking[]>([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'confirmed' | 'pending' | 'cancelled'>('all')
  const [facilityFilter, setFacilityFilter] = useState<string>('all')
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'upcoming' | 'history'>('all')
  const [loadError, setLoadError] = useState('')
  const [facilities, setFacilities] = useState<{ id: string; name: string }[]>([])

  const refresh = async () => { try { setBookings(await fetchAdminBookings()); setLoadError('') } catch (e) { setLoadError(e instanceof Error ? e.message : 'Could not load bookings.') } }

  useEffect(() => {
    refresh()
    fetchAdminFacilities().then(setFacilities).catch(e => setLoadError(e instanceof Error ? e.message : 'Could not load facilities.'))
  }, [])

  const handleStatusChange = async (id: string, newStatus: 'confirmed' | 'pending' | 'cancelled') => {
    try { await setBookingStatus(id, newStatus); await refresh() } catch (e) { setLoadError(e instanceof Error ? e.message : 'Could not update booking.') }
  }

  const filtered = bookings.filter(b => {
    const matchesSearch =
      b.id.toLowerCase().includes(search.toLowerCase()) ||
      b.customer.name.toLowerCase().includes(search.toLowerCase()) ||
      b.customer.phone.includes(search) ||
      b.customer.email.toLowerCase().includes(search.toLowerCase()) ||
      b.facilityName.toLowerCase().includes(search.toLowerCase())

    const matchesStatus = statusFilter === 'all' || b.status === statusFilter
    const matchesFacility = facilityFilter === 'all' || b.facilityId === facilityFilter
    const today = todayString()
    const matchesDate = dateFilter === 'all' || (dateFilter === 'today' && b.date === today) ||
      (dateFilter === 'upcoming' && b.date >= today && b.status !== 'cancelled') ||
      (dateFilter === 'history' && b.date < today)

    return matchesSearch && matchesStatus && matchesFacility && matchesDate
  })

  const exportCSV = () => {
    const values = [['Booking Reference','Customer','Phone','Email','Facility','Date','Time','Duration Hours','Total Amount','Advance Plan','Actual Paid','Outstanding','Booking Status','Payment Status'],
      ...filtered.map(b => [b.bookingReference ?? b.id, b.customer.name, b.customer.phone, b.customer.email, b.facilityName, b.date, b.startTime, b.durationHours, b.totalPrice, b.advance, b.amountPaid ?? 0, Math.max(0, b.totalPrice - (b.amountPaid ?? 0)), b.status, b.paymentStatus ?? 'unpaid'])]
    const content = values.map(row => row.map(value => `"${String(value ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n')
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a'); link.href = url; link.download = `arena-x-bookings-${new Date().toISOString().slice(0,10)}.csv`; link.click(); URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-white">Bookings Management</h1>
          <p className="text-gray-400 text-sm mt-1">
            Search, filter, and manage customer turf reservations.
          </p>
        </div>
        <button
          onClick={exportCSV}
          className="bg-card hover:bg-gray-800 border border-gray-700 text-gray-200 text-sm font-semibold px-4 py-2 rounded-lg flex items-center gap-2 transition"
        >
          <Download size={16} /> Export to CSV
        </button>
      </div>

      {/* Filters Toolbar */}
      <div className="bg-card rounded-xl border border-gray-800 p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          {/* Search Box */}
          <div className="relative md:col-span-2">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by ID, customer name, phone, or email..."
              className="w-full bg-[#141414] border border-gray-700 focus:border-lime-500 rounded-lg pl-9 pr-4 py-2 text-sm text-white placeholder-gray-500 outline-none transition"
            />
          </div>

          {/* Facility Filter */}
          <div>
            <select
              value={facilityFilter}
              onChange={e => setFacilityFilter(e.target.value)}
              className="w-full bg-[#141414] border border-gray-700 focus:border-lime-500 rounded-lg px-3 py-2 text-sm text-white outline-none transition"
            >
              <option value="all">All Facilities</option>
              {facilities.map(f => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as any)}
              className="w-full bg-[#141414] border border-gray-700 focus:border-lime-500 rounded-lg px-3 py-2 text-sm text-white outline-none transition"
            >
              <option value="all">All Statuses</option>
              <option value="confirmed">Confirmed</option>
              <option value="pending">Pending</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
          <div>
            <select value={dateFilter} onChange={e => setDateFilter(e.target.value as typeof dateFilter)} className="w-full bg-[#141414] border border-gray-700 focus:border-lime-500 rounded-lg px-3 py-2 text-sm text-white outline-none transition">
              <option value="all">All Dates</option><option value="today">Today</option><option value="upcoming">Upcoming</option><option value="history">History</option>
            </select>
          </div>
        </div>

        {/* Quick count chips */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-gray-800/80 text-xs">
          <span className="text-gray-400">Total matching:</span>
          <span className="font-bold text-white bg-gray-800 px-2.5 py-0.5 rounded-full">
            {filtered.length} bookings
          </span>
          <span className="text-gray-400 ml-3">Confirmed:</span>
          <span className="font-semibold text-lime-400 bg-lime-500/10 px-2 py-0.5 rounded-full">
            {filtered.filter(b => b.status === 'confirmed').length}
          </span>
          <span className="text-gray-400">Pending:</span>
          <span className="font-semibold text-yellow-400 bg-yellow-500/10 px-2 py-0.5 rounded-full">
            {filtered.filter(b => b.status === 'pending').length}
          </span>
          <span className="text-gray-400">Cancelled:</span>
          <span className="font-semibold text-red-400 bg-red-500/10 px-2 py-0.5 rounded-full">
            {filtered.filter(b => b.status === 'cancelled').length}
          </span>
        </div>
      </div>

      {/* Bookings Table */}
      {loadError && <p role="alert" className="text-red-400">{loadError}</p>}
      <div className="bg-card rounded-xl border border-gray-800 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#141414] text-xs font-semibold text-gray-400 uppercase tracking-wider border-b border-gray-800">
              <tr>
                <th className="py-3.5 px-4">Booking Reference</th>
                <th className="py-3.5 px-4">Customer</th>
                <th className="py-3.5 px-4">Facility &amp; Sport</th>
                <th className="py-3.5 px-4">Date &amp; Slot</th>
                <th className="py-3.5 px-4">Payment Summary</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/60">
              {filtered.map(booking => (
                <tr key={booking.id} className="hover:bg-white/[0.02] transition">
                  {/* ID */}
                  <td className="py-4 px-4 font-mono text-xs font-bold text-lime-400">
                    {booking.bookingReference ?? booking.id}
                  </td>

                  {/* Customer */}
                  <td className="py-4 px-4">
                    <div className="font-semibold text-white">{booking.customer.name}</div>
                    <div className="text-xs text-gray-400 flex items-center gap-1.5 mt-0.5">
                      <Phone size={11} className="text-gray-500" /> {booking.customer.phone}
                    </div>
                    <div className="text-xs text-gray-400 flex items-center gap-1.5">
                      <Mail size={11} className="text-gray-500" /> {booking.customer.email}
                    </div>
                  </td>

                  {/* Facility */}
                  <td className="py-4 px-4">
                    <div className="font-medium text-white text-xs">{booking.facilityName}</div>
                  </td>

                  {/* Date & Slot */}
                  <td className="py-4 px-4 text-xs">
                    <div className="text-gray-300 font-medium flex items-center gap-1">
                      <CalendarIcon size={12} className="text-lime-500" /> {formatDate(booking.date)}
                    </div>
                    <div className="text-lime-400 font-bold mt-0.5">
                      {booking.startTime} ({booking.durationHours} hr{booking.durationHours > 1 ? 's' : ''})
                    </div>
                  </td>

                  {/* Pricing / Payment */}
                  <td className="py-4 px-4 text-xs">
                    <div className="font-bold text-white text-sm">
                      {formatCurrency(booking.totalPrice)}
                    </div>
                    <div className="text-lime-400 mt-0.5">
                      Advance: {formatCurrency(booking.advance)}
                    </div>
                    {booking.balance > 0 && (
                      <div className="text-orange-400">
                        Bal: {formatCurrency(booking.balance)} (at venue)
                      </div>
                    )}
                    <div className="mt-1 text-gray-400">Paid: {formatCurrency(booking.amountPaid ?? 0)}</div>
                    <div className="text-gray-500 capitalize">Payment: {booking.paymentStatus ?? 'unpaid'}</div>
                  </td>

                  {/* Status */}
                  <td className="py-4 px-4">
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold capitalize ${
                        booking.status === 'confirmed'
                          ? 'bg-lime-500/10 text-lime-400 border border-lime-500/30'
                          : booking.status === 'pending'
                          ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/30'
                          : 'bg-red-500/10 text-red-400 border border-red-500/30'
                      }`}
                    >
                      {booking.status === 'confirmed' && <CheckCircle size={12} />}
                      {booking.status === 'pending' && <Clock size={12} />}
                      {booking.status === 'cancelled' && <XCircle size={12} />}
                      {booking.status}
                    </span>
                  </td>

                  {/* Interactive Actions Dropdown/Buttons */}
                  <td className="py-4 px-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {booking.status !== 'confirmed' && (
                        <button
                          onClick={() => handleStatusChange(booking.id, 'confirmed')}
                          title="Confirm Booking"
                          className="px-2 py-1 bg-lime-500/10 hover:bg-lime-500/20 text-lime-400 text-xs font-medium rounded border border-lime-500/30 transition"
                        >
                          Confirm
                        </button>
                      )}
                      {booking.status !== 'cancelled' && (
                        <button
                          onClick={() => handleStatusChange(booking.id, 'cancelled')}
                          title="Cancel Booking"
                          className="px-2 py-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-medium rounded border border-red-500/30 transition"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}

              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-gray-400">
                    <p className="text-base font-semibold text-white">No bookings match your filters</p>
                    <p className="text-xs mt-1">Try resetting the search criteria or filters.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
