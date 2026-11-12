import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Shield, AlertCircle } from 'lucide-react'
import { BookingData, CustomerInfo } from '../types'
import { formatCurrency, formatDate } from '../utils/helpers'
import { BookingHold, createBookingHold, releaseBookingHold } from '../lib/database'
import { useAuth } from '../contexts/AuthContext'
import { Link } from 'react-router-dom'
import { cancelRazorpayCheckout, createRazorpayOrder, getRazorpayPaymentStatus, loadRazorpayCheckout, RazorpayOrder, verifyRazorpayPayment } from '../lib/payments'

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
    return error.message
  }
  return fallback
}

export default function Checkout() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, loading: authLoading } = useAuth()
  const bookingData = (location.state as { bookingData: BookingData } | null)?.bookingData

  const [customer, setCustomer] = useState<CustomerInfo>({ name: '', phone: '', email: '' })
  const [whatsappOptIn, setWhatsappOptIn] = useState(false)
  const [paymentMode, setPaymentMode] = useState<'advance' | 'full'>('advance')
  const [agreed, setAgreed] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [errors, setErrors] = useState<Partial<CustomerInfo>>({})
  const [hold, setHold] = useState<BookingHold | null>(null)
  const [holdError, setHoldError] = useState('')
  const [submitError, setSubmitError] = useState('')
  const [paymentMessage, setPaymentMessage] = useState('')
  const [paymentAttemptId, setPaymentAttemptId] = useState('')
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    if (user?.email) setCustomer(current => current.email ? current : { ...current, email: user.email ?? '' })
  }, [user?.email])

  useEffect(() => {
    if (!bookingData || authLoading) return
    if (!user) { setHoldError('Sign in to temporarily reserve this slot during checkout.'); return }
    let active = true
    setHoldError('')
    createBookingHold({ facilityId: bookingData.facilityId, date: bookingData.date,
      startTime: bookingData.startTime, durationHours: bookingData.durationHours })
      .then(result => { if (active) setHold(result) })
      .catch(error => { if (active) setHoldError(getErrorMessage(error, 'Could not reserve this slot. Please return and choose another.')) })
    return () => { active = false }
  }, [bookingData, authLoading, user])

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  if (!bookingData) {
    return (
      <div className="pt-24 min-h-screen flex flex-col items-center justify-center gap-4 text-gray-400">
        <AlertCircle size={48} className="text-red-500" />
        <p className="font-semibold text-white">No booking data found.</p>
        <button onClick={() => navigate('/booking')} className="text-lime-500 hover:underline">
          Start a new booking
        </button>
      </div>
    )
  }

  const validate = () => {
    const errs: Partial<CustomerInfo> = {}
    if (!customer.name.trim()) errs.name = 'Full name is required'
    if (!customer.phone.trim() || !/^\+?[\d\s-]{8,}$/.test(customer.phone))
      errs.phone = 'Enter a valid phone number'
    else if (whatsappOptIn && (!/^\+/.test(customer.phone.trim()) || customer.phone.replace(/\D/g, '').length < 8 || customer.phone.replace(/\D/g, '').length > 15))
      errs.phone = 'Include the country code for WhatsApp, for example +91 98765 43210'
    if (!customer.email.trim() || !/^[^@]+@[^@]+\.[^@]+$/.test(customer.email))
      errs.email = 'Enter a valid email address'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const total = Number(hold?.total_amount ?? bookingData.totalPrice)
  const advance = Math.round(total * 50) / 100
  const balance = Math.max(0, total - advance)
  const amountToPay = paymentMode === 'advance' ? advance : total
  const balanceDue = paymentMode === 'advance' ? balance : 0
  const advancePercent = 50
  const secondsRemaining = hold ? Math.max(0, Math.ceil((new Date(hold.expires_at).getTime() - now) / 1000)) : 0
  const expired = Boolean(hold && secondsRemaining <= 0)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    if (!user) { navigate('/auth', { state: { returnTo: '/checkout', bookingData } }); return }
    if (!hold || expired) { setSubmitError('Your temporary hold is unavailable or expired. Return to the booking page and choose the slot again.'); return }
    setSubmitting(true)
    setSubmitError('')
    setPaymentMessage('')
    try {
      await loadRazorpayCheckout()
      const order: RazorpayOrder = await createRazorpayOrder({
        holdId: hold.id, paymentMode, customerName: customer.name.trim(), customerPhone: customer.phone.trim(), whatsappOptIn,
      })
      setPaymentAttemptId(order.attemptId)
      if (order.notificationWarning) setPaymentMessage(order.notificationWarning)
      if (!window.Razorpay) throw new Error('Razorpay Checkout did not load. Please retry.')
      const checkout = new window.Razorpay({
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        name: 'ARENA X',
        description: `${bookingData.facilityName} · ${bookingData.durationHours} hour booking`,
        order_id: order.orderId,
        prefill: { name: order.customerName, email: order.customerEmail, contact: order.customerPhone },
        notes: { facility: bookingData.facilityName, date: bookingData.date },
        theme: { color: '#84cc16' },
        modal: { ondismiss: () => {
          void cancelRazorpayCheckout(order.attemptId).catch(() => {})
          setSubmitError('Checkout was closed. Your slot hold remains active until its timer expires; you can retry payment.')
          setSubmitting(false)
        } },
        handler: async (response: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
          setSubmitting(true)
          try {
            const result = await verifyRazorpayPayment(order.attemptId, response)
            if (result.status !== 'paid') {
              setPaymentMessage(result.message || 'Payment is pending confirmation. Keep this page open and check status shortly.')
              setPaymentAttemptId(order.attemptId)
              return
            }
            const booking = result.booking
            const paidAmount = Number(booking?.advance_amount ?? result.payment_amount ?? order.amount / 100)
            const paidTotal = Number(booking?.total_amount ?? result.total_amount ?? total)
            const saved = {
              ...bookingData, id: booking?.booking_reference ?? result.booking_reference ?? booking?.id ?? bookingData.facilityId,
              totalPrice: paidTotal, advance: Number(booking?.advance_amount ?? result.advance_amount ?? paidAmount),
              balance: Number(booking?.balance_amount ?? result.balance_amount ?? Math.max(0, paidTotal - paidAmount)),
              customer, status: 'pending' as const, createdAt: booking?.created_at ?? result.created_at ?? new Date().toISOString(),
              paymentMode,
            }
            navigate('/booking-confirmation', { state: {
              booking: saved, amountDue: paidAmount, balanceDue: Math.max(0, paidTotal - paidAmount),
              paymentStatus: booking?.payment_status ?? result.payment_status ?? (paidAmount >= paidTotal ? 'paid' : 'partial'),
            } })
          } catch (error) {
            setSubmitError(getErrorMessage(error, 'Payment verification is pending. Your booking is not confirmed until verification completes.'))
            setPaymentMessage('If Razorpay showed a successful charge, check its status here before retrying payment.')
          }
          finally { setSubmitting(false) }
        },
      })
      checkout.on('payment.failed', (response: { error?: { description?: string } }) => {
        setSubmitError(response.error?.description || 'Payment failed. You can retry while the slot hold is active.')
        setSubmitting(false)
      })
      checkout.open()
    } catch (err) {
      setSubmitError(getErrorMessage(err, 'Could not start payment. Please retry.'))
    } finally { setSubmitting(false) }
  }

  const checkPaymentStatus = async () => {
    if (!paymentAttemptId) return
    setSubmitting(true); setSubmitError('')
    try {
      const result = await getRazorpayPaymentStatus(paymentAttemptId)
      if (result.status === 'paid' && result.booking) {
        const booking = result.booking
        const amountPaid = Number(result.paymentAmount ?? booking.advance_amount)
        const saved = { ...bookingData, id: booking.booking_reference, totalPrice: Number(booking.total_amount),
          advance: Number(booking.advance_amount), balance: Number(booking.balance_amount), customer,
          status: 'pending' as const, createdAt: booking.created_at, paymentMode: result.paymentMode ?? paymentMode }
        navigate('/booking-confirmation', { state: { booking: saved, amountDue: amountPaid,
          balanceDue: Math.max(0, Number(booking.total_amount) - amountPaid), paymentStatus: booking.payment_status } })
      } else if (result.status === 'refund_required') {
        setSubmitError('The slot hold expired before payment confirmation. The venue must refund this payment; contact support.')
      } else if (result.status === 'failed' || result.status === 'expired') {
        setSubmitError(result.message || 'Payment was not completed. Please retry before the hold expires.')
      } else setPaymentMessage('Payment is still pending with Razorpay. Please check again shortly.')
    } catch (error) { setSubmitError(getErrorMessage(error, 'Could not check payment status.')) }
    finally { setSubmitting(false) }
  }

  const cancelHold = async () => {
    if (paymentAttemptId) await cancelRazorpayCheckout(paymentAttemptId).catch(() => {})
    if (hold) await releaseBookingHold(hold.id).catch(() => {})
    navigate('/booking')
  }

  return (
    <div className="pt-16 min-h-screen">
      <div className="bg-[#0d0d0d] border-b border-gray-800 py-8 px-4 md:px-6">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-3xl font-black text-white">Checkout</h1>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 md:px-6 py-6 sm:py-10">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          {/* Form */}
          <form onSubmit={handleSubmit} className="lg:col-span-3 space-y-6">
            {/* Customer details */}
            <div className="bg-card rounded-xl border border-gray-800 p-4 sm:p-6">
              <h2 className="font-bold text-white mb-4">Your Details</h2>
              <div className="space-y-4">
                <div>
                  <label htmlFor="checkout-name" className="block text-sm text-gray-400 mb-1">Full Name *</label>
                  <input
                    id="checkout-name"
                    type="text"
                    value={customer.name}
                    onChange={e => setCustomer(c => ({ ...c, name: e.target.value }))}
                    placeholder="Rahul Sharma"
                    className={`w-full bg-gray-800 border ${errors.name ? 'border-red-500' : 'border-gray-700'} focus:border-lime-500 rounded-lg px-4 py-2.5 text-white text-sm outline-none transition`}
                  />
                  {errors.name && <p className="text-red-400 text-xs mt-1">{errors.name}</p>}
                </div>
                <div>
                  <label htmlFor="checkout-phone" className="block text-sm text-gray-400 mb-1">Mobile Number *</label>
                  <input
                    id="checkout-phone"
                    type="tel"
                    value={customer.phone}
                    onChange={e => setCustomer(c => ({ ...c, phone: e.target.value }))}
                    placeholder="+91 98765 43210"
                    className={`w-full bg-gray-800 border ${errors.phone ? 'border-red-500' : 'border-gray-700'} focus:border-lime-500 rounded-lg px-4 py-2.5 text-white text-sm outline-none transition`}
                  />
                  {errors.phone && <p className="text-red-400 text-xs mt-1">{errors.phone}</p>}
                </div>
                <div>
                  <label htmlFor="checkout-email" className="block text-sm text-gray-400 mb-1">Email Address *</label>
                  <input
                    id="checkout-email"
                    type="email"
                    value={customer.email || user?.email || ''}
                    onChange={e => setCustomer(c => ({ ...c, email: e.target.value }))}
                    placeholder="rahul@example.com"
                    className={`w-full bg-gray-800 border ${errors.email ? 'border-red-500' : 'border-gray-700'} focus:border-lime-500 rounded-lg px-4 py-2.5 text-white text-sm outline-none transition`}
                  />
                  {errors.email && <p className="text-red-400 text-xs mt-1">{errors.email}</p>}
                </div>
                <label className="flex items-start gap-3 cursor-pointer rounded-lg border border-gray-800 p-3">
                  <input type="checkbox" checked={whatsappOptIn} onChange={e => setWhatsappOptIn(e.target.checked)} className="mt-1 accent-lime-500" />
                  <span className="text-xs text-gray-400">Send me booking confirmation, cancellation, and reminder updates on WhatsApp. I can withdraw consent by contacting ARENA X.</span>
                </label>
              </div>
            </div>

            {!user && !authLoading && <p className="text-sm text-orange-300">Please <Link to="/auth" state={{ returnTo: '/checkout', bookingData }} className="underline">sign in</Link> to hold this slot.</p>}
            {authLoading && <p className="text-sm text-gray-400">Checking your account…</p>}
            {holdError && <p role="alert" className="text-sm text-red-400">{holdError}</p>}
            {hold && !expired && <p role="status" className="text-sm text-lime-300">Slot held for {Math.floor(secondsRemaining / 60)}:{String(secondsRemaining % 60).padStart(2, '0')}. Complete checkout before the hold expires.</p>}
            {expired && <p role="alert" className="text-sm text-red-400">Your slot hold expired. Go back and select a slot again.</p>}

            {/* Payment option */}
            <div className="bg-card rounded-xl border border-gray-800 p-4 sm:p-6">
              <h2 className="font-bold text-white mb-4">Payment Option</h2>
              <div className="space-y-3">
                {[
                  {
                    id: 'advance',
                    label: `${advancePercent}% Deposit Plan – ${formatCurrency(advance)}`,
                    sub: `Pay 50% now; remaining ${formatCurrency(balance)} due at the venue`,
                  },
                  {
                    id: 'full',
                    label: `Full Amount Plan – ${formatCurrency(total)}`,
                    sub: 'Pay the full booking amount securely now',
                  },
                ].map(opt => (
                  <label
                    key={opt.id}
                    className={`flex items-start gap-3 p-4 rounded-lg border cursor-pointer transition ${
                      paymentMode === opt.id
                        ? 'border-lime-500 bg-lime-500/5'
                        : 'border-gray-700 hover:border-gray-600'
                    }`}
                  >
                    <input
                      type="radio"
                      name="payment"
                      value={opt.id}
                      checked={paymentMode === opt.id}
                      onChange={() => setPaymentMode(opt.id as 'advance' | 'full')}
                      className="mt-0.5 accent-lime-500"
                    />
                    <div>
                      <div className="text-sm font-semibold text-white">{opt.label}</div>
                      <div className="text-xs text-gray-400 mt-0.5">{opt.sub}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Terms */}
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={agreed}
                onChange={e => setAgreed(e.target.checked)}
                className="mt-1 accent-lime-500"
              />
              <span className="text-sm text-gray-400">
                I agree to the{' '}
                <a href="/about" className="text-lime-400 hover:underline">Terms & Conditions</a>
                {' '}and{' '}
                <a href="/about" className="text-lime-400 hover:underline">Cancellation Policy</a>.
                I understand the booking is created only after Razorpay verifies my payment.
              </span>
            </label>

            <div className="flex gap-2 bg-gray-900 border border-gray-700 rounded-lg p-3 text-xs text-gray-300">
              <AlertCircle size={14} className="shrink-0 mt-0.5" />
              <span>
                <strong>Secure checkout:</strong> Razorpay processes your payment. ARENA X never receives or stores your card details.
              </span>
            </div>
            {paymentMessage && <p role="status" className="text-sm text-amber-300">{paymentMessage}</p>}
            {submitError && <p role="alert" className="text-sm text-red-400">{submitError}</p>}
            {paymentAttemptId && paymentMessage && <button type="button" onClick={() => void checkPaymentStatus()} disabled={submitting} className="text-sm text-lime-400 hover:underline disabled:opacity-50">Check payment status</button>}
            <button type="button" onClick={() => void cancelHold()} className="text-sm text-gray-400 hover:text-white">Cancel hold and choose another slot</button>

            <button
              type="submit"
              disabled={!agreed || submitting || !user || !hold || expired}
              className="w-full bg-lime-500 hover:bg-lime-400 disabled:bg-gray-700 disabled:text-gray-500 text-black font-bold py-4 rounded-xl transition text-base flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-black/40 border-t-black rounded-full animate-spin" />
                  Starting Secure Checkout…
                </>
              ) : (
                <>
                  <Shield size={18} />
                  Pay {formatCurrency(amountToPay)} with Razorpay
                </>
              )}
            </button>
          </form>

          {/* Booking Summary sidebar */}
          <div className="lg:col-span-2">
            <div className="bg-card rounded-xl border border-gray-800 p-4 sm:p-5 lg:sticky lg:top-24">
              <h3 className="font-bold text-white mb-4">Booking Summary</h3>
              <div className="space-y-2.5 text-sm">
                {[
                  ['Facility', bookingData.facilityName],
                  ['Date', formatDate(bookingData.date)],
                  ['Time', bookingData.startTime],
                  ['Duration', `${bookingData.durationHours}h`],
                  ['Starting rate', `${formatCurrency(bookingData.hourlyRate)}/hr`],
                  ...(bookingData.hourlyRates && bookingData.hourlyRates.length > 1
                    ? [['Hourly rates', bookingData.hourlyRates.map(formatCurrency).join(' + ')]]
                    : []),
                ].map(([label, val]) => (
                  <div key={label} className="flex justify-between gap-2">
                    <span className="text-gray-400">{label}</span>
                    <span className="text-white font-medium text-right text-xs">{val}</span>
                  </div>
                ))}
                <div className="border-t border-gray-800 pt-3 mt-3 space-y-2">
                  <div className="flex justify-between font-bold text-base">
                    <span className="text-gray-300">Total</span>
                    <span className="text-lime-500">{formatCurrency(total)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Pay now</span>
                    <span className="text-white font-semibold">{formatCurrency(amountToPay)}</span>
                  </div>
                  {balanceDue > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Balance at Venue</span>
                      <span className="text-gray-300">{formatCurrency(balanceDue)}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

