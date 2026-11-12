import { useLocation, useNavigate, Link } from 'react-router-dom'
import { CheckCircle, Copy, Printer, Home, ArrowRight } from 'lucide-react'
import { SavedBooking } from '../types'
import { formatCurrency, formatDate } from '../utils/helpers'
import { useState } from 'react'

export default function Confirmation() {
  const { state } = useLocation()
  const navigate = useNavigate()
  const [copied, setCopied] = useState(false)

  const booking: SavedBooking | null = (state as any)?.booking ?? null
  const amountDue: number = (state as any)?.amountDue ?? (state as any)?.amountPaid ?? 0
  const balanceDue: number = (state as any)?.balanceDue ?? 0
  const bookingStatus: string = (state as any)?.booking?.status ?? 'pending'
  const paymentStatus: string = (state as any)?.paymentStatus ?? 'unpaid'

  if (!booking) {
    return (
      <div className="pt-24 min-h-screen flex flex-col items-center justify-center gap-4">
        <p className="text-white font-semibold">No booking data found.</p>
        <Link to="/" className="text-lime-500 hover:underline">Go Home</Link>
      </div>
    )
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(booking.id)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="pt-16 min-h-screen">
      <div className="max-w-2xl mx-auto px-4 md:px-6 py-16 text-center">
        {/* Success icon */}
        <div className="flex justify-center mb-6">
          <div className="w-24 h-24 rounded-full bg-lime-500/10 border-4 border-lime-500/30 flex items-center justify-center animate-pulse">
            <CheckCircle size={48} className="text-lime-500" />
          </div>
        </div>

        <h1 className="text-3xl md:text-4xl font-black text-white mb-2">Payment Verified</h1>
        <p className="text-gray-400 mb-8">
          Your payment was verified and your reservation is pending administrator confirmation.
        </p>

        {/* Booking reference */}
        <div className="bg-lime-500/10 border border-lime-500/30 rounded-xl p-4 mb-6 flex items-center justify-center gap-3">
          <div>
            <p className="text-xs text-lime-400 uppercase tracking-widest mb-1">Booking Reference</p>
            <p className="text-2xl font-black text-lime-500 tracking-wider">{booking.id}</p>
          </div>
          <button
            onClick={handleCopy}
            className="text-lime-500 hover:text-lime-400 ml-2"
            title="Copy reference"
          >
            <Copy size={18} />
          </button>
          {copied && <span className="text-xs text-lime-400">Copied!</span>}
        </div>

        {/* Details card */}
        <div className="bg-card rounded-xl border border-gray-800 p-6 text-left mb-6">
          <h2 className="font-bold text-white mb-4">Booking Details</h2>
          <div className="space-y-3 text-sm">
            {[
              ['Facility', booking.facilityName],
              ['Date', formatDate(booking.date)],
              ['Time', `${booking.startTime} (${booking.durationHours}h)`],
              ['Customer', booking.customer.name],
              ['Mobile', booking.customer.phone],
              ['Email', booking.customer.email],
            ].map(([label, val]) => (
              <div key={label} className="flex justify-between gap-4">
                <span className="text-gray-400 shrink-0">{label}</span>
                <span className="text-white font-medium text-right">{val}</span>
              </div>
            ))}

            <div className="border-t border-gray-800 pt-3 mt-3 space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-400">Total Amount</span>
                <span className="text-white font-bold">{formatCurrency(booking.totalPrice)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Paid Online</span>
                <span className="text-lime-400 font-bold">{formatCurrency(amountDue)}</span>
              </div>
              {balanceDue > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-400">Balance at Venue</span>
                  <span className="text-white font-semibold">{formatCurrency(balanceDue)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-400">Booking Status</span>
                <span className="text-yellow-400 font-semibold flex items-center gap-1">
                  <CheckCircle size={14} /> {bookingStatus === 'pending' ? 'Awaiting confirmation' : bookingStatus}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Payment Status</span>
                <span className="text-yellow-400 font-semibold">{paymentStatus}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Important note */}
        <p className="text-xs text-gray-500 mb-8">
          Keep your booking reference for your visit. Any remaining balance is due at the venue.
        </p>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={() => window.print()}
            className="flex items-center justify-center gap-2 border border-gray-600 hover:border-lime-500 text-gray-300 hover:text-lime-400 font-semibold px-6 py-3 rounded-md transition text-sm"
          >
            <Printer size={16} /> Print Booking
          </button>
          <Link
            to="/booking"
            className="flex items-center justify-center gap-2 border border-lime-500/40 hover:border-lime-500 text-lime-400 hover:text-lime-300 font-semibold px-6 py-3 rounded-md transition text-sm"
          >
            Book Another Slot <ArrowRight size={16} />
          </Link>
          <Link
            to="/"
            className="flex items-center justify-center gap-2 bg-lime-500 hover:bg-lime-400 text-black font-bold px-6 py-3 rounded-md transition text-sm"
          >
            <Home size={16} /> Back to Homepage
          </Link>
        </div>
      </div>
    </div>
  )
}
