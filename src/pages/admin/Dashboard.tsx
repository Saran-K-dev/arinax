import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  Calendar,
  DollarSign,
  AlertCircle,
  Clock,
  ArrowUpRight,
  PlusCircle,
  Sliders,
  ShieldAlert,
  FileText,
  CheckCircle2,
} from 'lucide-react'
import { SavedBooking } from '../../types'
import { formatCurrency, formatDate, todayString } from '../../utils/helpers'
import { fetchAdminBookings, fetchAdminPayments, AdminPayment } from '../../lib/database'

export default function AdminDashboard() {
  const [bookings, setBookings] = useState<SavedBooking[]>([])
  const [payments, setPayments] = useState<AdminPayment[]>([])
  const [loadError, setLoadError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([fetchAdminBookings(), fetchAdminPayments()])
      .then(([bookingRows, paymentRows]) => { setBookings(bookingRows); setPayments(paymentRows); setLoadError('') })
      .catch(e => setLoadError(e instanceof Error ? e.message : 'Could not load admin statistics from Supabase.'))
      .finally(() => setLoading(false))
  }, [])

  const today = todayString()
  const todayBookings = bookings.filter(b => b.date === today)
  const monthKey = today.slice(0, 7)
  const monthlyRevenueReceived = payments.filter(p => p.status === 'succeeded' && p.created_at.startsWith(monthKey))
    .reduce((sum, payment) => sum + Number(payment.amount), 0)
  const pendingPayments = bookings.filter(b => b.status !== 'cancelled' && b.totalPrice > (b.amountPaid ?? 0))
  const pendingBalanceTotal = pendingPayments.reduce((sum, b) => sum + Math.max(0, b.totalPrice - (b.amountPaid ?? 0)), 0)
  const upcomingBookings = bookings.filter(b => b.date >= today && b.status !== 'cancelled')
    .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime))

  const weeklyBookings = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(`${today}T12:00:00`)
    date.setDate(date.getDate() - 6 + index)
    const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    return {
      date: dateKey,
      day: date.toLocaleDateString('en-IN', { weekday: 'short' }),
      count: bookings.filter(b => b.date === dateKey && b.status !== 'cancelled').length,
    }
  })
  const weeklyMaximum = Math.max(1, ...weeklyBookings.map(day => day.count))
  const weeklyTotal = weeklyBookings.reduce((sum, day) => sum + day.count, 0)

  return (
    <div className="space-y-8">
      {loadError && <p role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{loadError}</p>}
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-white">Dashboard Overview</h1>
          <p className="text-gray-400 text-sm mt-1">
            Real-time facility performance, bookings, and revenue tracking.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg px-4 py-2 text-sm text-gray-300 flex items-center gap-2">
            <Calendar size={15} className="text-lime-500" />
            <span>{formatDate(today)}</span>
          </div>
          <Link
            to="/booking"
            className="bg-lime-500 hover:bg-lime-400 text-black text-sm font-bold px-4 py-2 rounded-lg flex items-center gap-1.5 transition"
          >
            <PlusCircle size={16} /> New Booking
          </Link>
        </div>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Bookings */}
        <div className="bg-card rounded-xl border border-gray-800 p-5 relative overflow-hidden">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Total Bookings</p>
              <h3 className="text-3xl font-black text-white mt-2">{bookings.length}</h3>
            </div>
            <div className="w-10 h-10 rounded-lg bg-lime-500/10 flex items-center justify-center text-lime-400">
              <Calendar size={20} />
            </div>
          </div>
            <div className="mt-4 text-xs text-gray-500">Reservations loaded from Supabase</div>
        </div>

        {/* Today's Bookings */}
        <div className="bg-card rounded-xl border border-gray-800 p-5 relative overflow-hidden">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Today's Bookings</p>
              <h3 className="text-3xl font-black text-white mt-2">{todayBookings.length}</h3>
            </div>
            <div className="w-10 h-10 rounded-lg bg-lime-500/10 flex items-center justify-center text-lime-400">
              <Clock size={20} />
            </div>
          </div>
          <div className="mt-4 text-xs text-gray-500">Bookings dated today</div>
        </div>

        {/* Monthly Revenue */}
        <div className="bg-card rounded-xl border border-gray-800 p-5 relative overflow-hidden">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Revenue Received This Month</p>
              <h3 className="text-3xl font-black text-lime-400 mt-2">
                {formatCurrency(monthlyRevenueReceived)}
              </h3>
            </div>
            <div className="w-10 h-10 rounded-lg bg-lime-500/10 flex items-center justify-center text-lime-400">
              <DollarSign size={20} />
            </div>
          </div>
          <div className="mt-4 text-xs text-gray-500">Successful payment records received this month</div>
        </div>

        {/* Pending Payments */}
        <div className="bg-card rounded-xl border border-gray-800 p-5 relative overflow-hidden">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Pending Balances</p>
              <h3 className="text-3xl font-black text-orange-400 mt-2">
                {formatCurrency(pendingBalanceTotal)}
              </h3>
            </div>
            <div className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center text-orange-400">
              <AlertCircle size={20} />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-1 text-xs text-gray-400">
            <span className="text-orange-400 font-semibold">{pendingPayments.length} bookings</span>
            <span>due at venue</span>
          </div>
        </div>
      </div>

      {/* Middle Section: Recent Bookings & Analytics / Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Bookings Table (2 cols) */}
        <div className="lg:col-span-2 bg-card rounded-xl border border-gray-800 p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-lg font-bold text-white">Recent Bookings</h2>
              <p className="text-xs text-gray-400 mt-0.5">Latest player reservations and slot requests</p>
            </div>
            <Link
              to="/admin/bookings"
              className="text-xs font-semibold text-lime-400 hover:text-lime-300 flex items-center gap-1 transition"
            >
              View All ({bookings.length}) <ArrowUpRight size={14} />
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-800 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  <th className="pb-3">Booking ID</th>
                  <th className="pb-3">Customer</th>
                  <th className="pb-3">Facility</th>
                  <th className="pb-3">Date & Time</th>
                  <th className="pb-3">Amount</th>
                  <th className="pb-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60">
                {bookings.slice(0, 6).map(booking => (
                  <tr key={booking.id} className="hover:bg-white/[0.02] transition">
                    <td className="py-3.5 font-mono text-xs font-semibold text-lime-400">
                      {booking.bookingReference ?? booking.id}
                    </td>
                    <td className="py-3.5">
                      <div className="font-medium text-white">{booking.customer.name}</div>
                      <div className="text-xs text-gray-500">{booking.customer.phone}</div>
                    </td>
                    <td className="py-3.5 text-gray-300 text-xs font-medium">
                      {booking.facilityName}
                    </td>
                    <td className="py-3.5 text-xs text-gray-400">
                      <div>{booking.date}</div>
                      <div className="text-lime-500 font-medium">{booking.startTime} ({booking.durationHours}h)</div>
                    </td>
                    <td className="py-3.5 text-xs font-semibold text-white">
                      {formatCurrency(booking.totalPrice)}
                    </td>
                    <td className="py-3.5 text-right">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize ${
                          booking.status === 'confirmed'
                            ? 'bg-lime-500/10 text-lime-400 border border-lime-500/30'
                            : booking.status === 'pending'
                            ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/30'
                            : 'bg-red-500/10 text-red-400 border border-red-500/30'
                        }`}
                      >
                        {booking.status}
                      </span>
                    </td>
                  </tr>
                ))}
                {loading && <tr><td colSpan={6} className="py-6 text-center text-gray-500">Loading bookings…</td></tr>}
                {!loading && bookings.length === 0 && <tr><td colSpan={6} className="py-6 text-center text-gray-500">No bookings in Supabase yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Column: Chart & Quick Actions */}
        <div className="space-y-6">
          {/* Weekly Bookings Chart Card */}
          <div className="bg-card rounded-xl border border-gray-800 p-6">
            <h3 className="font-bold text-white text-base mb-1">Weekly Booking Traffic</h3>
            <p className="text-xs text-gray-400 mb-6">Bookings by date for the last 7 days</p>

            <div className="flex items-end justify-between gap-2 h-40 pt-4 px-2 border-b border-gray-800 pb-2">
              {weeklyBookings.map(day => (
                <div key={day.date} className="flex-1 flex flex-col items-center gap-2 group" title={`${day.count} bookings`}>
                  <div className="w-full bg-gray-800 rounded-t-sm h-32 flex items-end relative overflow-hidden">
                    <div
                      className="w-full bg-lime-500 group-hover:bg-lime-400 rounded-t-sm transition-all duration-300"
                      style={{ height: day.count === 0 ? '0%' : `${Math.max(6, (day.count / weeklyMaximum) * 100)}%` }}
                    />
                  </div>
                  <span className="text-[11px] text-gray-400 font-medium">{day.day}</span>
                </div>
              ))}
            </div>

            <div className="mt-4 flex items-center justify-between text-xs text-gray-400">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 bg-lime-500 rounded-sm" /> Bookings
              </span>
              <span className="font-semibold text-white">{weeklyTotal} total</span>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-card rounded-xl border border-gray-800 p-6">
            <h3 className="font-bold text-white text-base mb-4">Quick Actions</h3>
            <div className="grid grid-cols-2 gap-3">
              <Link
                to="/admin/slots"
                className="flex flex-col items-start p-3 rounded-lg bg-gray-800/60 border border-gray-700/60 hover:border-lime-500/50 hover:bg-gray-800 transition group"
              >
                <ShieldAlert size={18} className="text-lime-400 mb-2 group-hover:scale-110 transition" />
                <span className="text-xs font-bold text-white">Block Slots</span>
                <span className="text-[11px] text-gray-400">Maintenance & events</span>
              </Link>

              <Link
                to="/admin/pricing"
                className="flex flex-col items-start p-3 rounded-lg bg-gray-800/60 border border-gray-700/60 hover:border-lime-500/50 hover:bg-gray-800 transition group"
              >
                <Sliders size={18} className="text-lime-400 mb-2 group-hover:scale-110 transition" />
                <span className="text-xs font-bold text-white">Manage Pricing</span>
                <span className="text-[11px] text-gray-400">Peak & weekend rates</span>
              </Link>

              <Link
                to="/admin/bookings"
                className="flex flex-col items-start p-3 rounded-lg bg-gray-800/60 border border-gray-700/60 hover:border-lime-500/50 hover:bg-gray-800 transition group"
              >
                <FileText size={18} className="text-lime-400 mb-2 group-hover:scale-110 transition" />
                <span className="text-xs font-bold text-white">View Bookings</span>
                <span className="text-[11px] text-gray-400">Export & update status</span>
              </Link>

              <Link
                to="/sports"
                className="flex flex-col items-start p-3 rounded-lg bg-gray-800/60 border border-gray-700/60 hover:border-lime-500/50 hover:bg-gray-800 transition group"
              >
                <CheckCircle2 size={18} className="text-lime-400 mb-2 group-hover:scale-110 transition" />
                <span className="text-xs font-bold text-white">Live Facilities</span>
                <span className="text-[11px] text-gray-400">Inspect customer view</span>
              </Link>

              <Link to="/admin/facilities" className="flex flex-col items-start p-3 rounded-lg bg-gray-800/60 border border-gray-700/60 hover:border-lime-500/50 hover:bg-gray-800 transition group">
                <CheckCircle2 size={18} className="text-lime-400 mb-2 group-hover:scale-110 transition" />
                <span className="text-xs font-bold text-white">Manage Facilities</span>
                <span className="text-[11px] text-gray-400">Details and visibility</span>
              </Link>

              <Link to="/admin/payments" className="flex flex-col items-start p-3 rounded-lg bg-gray-800/60 border border-gray-700/60 hover:border-lime-500/50 hover:bg-gray-800 transition group">
                <DollarSign size={18} className="text-lime-400 mb-2 group-hover:scale-110 transition" />
                <span className="text-xs font-bold text-white">Payment History</span>
                <span className="text-[11px] text-gray-400">Collected and outstanding</span>
              </Link>
            </div>
          </div>
        </div>
      </div>

      <section className="overflow-hidden rounded-xl border border-gray-800 bg-card">
        <div className="flex items-center justify-between border-b border-gray-800 p-5"><div><h2 className="font-bold text-white">Upcoming Bookings</h2><p className="mt-1 text-xs text-gray-400">Today and future confirmed or pending reservations</p></div><Link to="/admin/bookings" className="text-xs font-semibold text-lime-400 hover:text-lime-300">Booking history →</Link></div>
        <div className="overflow-x-auto"><table className="w-full min-w-[700px] text-left text-sm"><thead className="bg-[#141414] text-[11px] uppercase text-gray-400"><tr>{['Date & time','Reference','Customer','Facility','Booking status','Balance due'].map(h=><th key={h} className="px-4 py-3">{h}</th>)}</tr></thead><tbody className="divide-y divide-gray-800/70">{upcomingBookings.slice(0,8).map(b=><tr key={b.id}><td className="px-4 py-3 text-xs text-gray-300">{formatDate(b.date)} · {b.startTime}</td><td className="px-4 py-3 font-mono text-xs text-lime-300">{b.bookingReference ?? b.id}</td><td className="px-4 py-3"><div className="text-white">{b.customer.name}</div><div className="text-xs text-gray-500">{b.customer.phone}</div></td><td className="px-4 py-3 text-xs text-gray-300">{b.facilityName}</td><td className="px-4 py-3 capitalize text-gray-300">{b.status}</td><td className="px-4 py-3 font-semibold text-orange-300">{formatCurrency(Math.max(0,b.totalPrice-(b.amountPaid??0)))}</td></tr>)}{!loading && !upcomingBookings.length && <tr><td colSpan={6} className="p-6 text-center text-sm text-gray-500">No upcoming bookings.</td></tr>}</tbody></table></div>
      </section>
    </div>
  )
}

