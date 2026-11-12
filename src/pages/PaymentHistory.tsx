import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { CreditCard, RefreshCw } from 'lucide-react'
import { CustomerPayment, fetchCustomerPaymentHistory } from '../lib/database'
import { formatCurrency, formatDate } from '../utils/helpers'

function statusClass(status: string) {
  if (status === 'succeeded') return 'bg-lime-500/10 text-lime-300'
  if (status === 'failed' || status === 'refunded') return 'bg-red-500/10 text-red-300'
  return 'bg-yellow-500/10 text-yellow-300'
}

export default function PaymentHistory() {
  const [payments, setPayments] = useState<CustomerPayment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const refresh = async () => {
    setLoading(true)
    try {
      setPayments(await fetchCustomerPaymentHistory())
      setError('')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not load your payment history.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void refresh() }, [])

  return (
    <main className="min-h-screen bg-[#0d0d0d] px-4 pb-16 pt-24 text-white md:px-6">
      <div className="mx-auto max-w-5xl">
        <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-lime-400">Your account</p>
            <h1 className="mt-2 text-3xl font-black">Payment history</h1>
            <p className="mt-2 text-sm text-gray-400">Payments linked to your ARENA X bookings.</p>
          </div>
          <button onClick={() => void refresh()} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-700 px-4 py-2 text-sm text-gray-200 hover:border-lime-500 disabled:opacity-50">
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>

        {error && <div role="alert" className="mb-5 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">{error}</div>}

        <section className="overflow-hidden rounded-xl border border-gray-800 bg-[#141414]">
          {loading ? <p role="status" className="p-8 text-center text-sm text-gray-400">Loading your payments…</p>
            : payments.length === 0 ? <div className="px-6 py-14 text-center">
              <CreditCard className="mx-auto mb-4 text-gray-500" size={30} />
              <h2 className="font-bold">No payments yet</h2>
              <p className="mt-2 text-sm text-gray-400">Verified payments for your bookings will appear here.</p>
              <Link to="/booking" className="mt-5 inline-flex rounded-md bg-lime-500 px-5 py-2.5 text-sm font-bold text-black hover:bg-lime-400">Browse booking slots</Link>
            </div> : <>
              <div className="divide-y divide-gray-800 md:hidden">
                {payments.map(payment => <article key={payment.id} className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div><p className="font-mono text-sm font-bold text-lime-300">{payment.booking_reference}</p><p className="mt-1 text-xs text-gray-400">{payment.facility_name}</p></div>
                    <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs capitalize ${statusClass(payment.status)}`}>{payment.status}</span>
                  </div>
                  <div className="flex items-end justify-between gap-3 text-sm">
                    <div className="text-gray-400">{payment.booking_date ? formatDate(payment.booking_date) : 'Booking'}{payment.start_time ? ` · ${payment.start_time}` : ''}<p className="mt-1 text-xs capitalize">{payment.provider ?? 'Payment'}{payment.provider_reference ? ` · ${payment.provider_reference}` : ''}</p></div>
                    <strong>{formatCurrency(payment.amount)}</strong>
                  </div>
                </article>)}
              </div>
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full min-w-[740px] text-left text-sm">
                  <thead className="bg-[#101010] text-[11px] uppercase text-gray-400"><tr>{['Paid on','Booking','Facility / slot','Method / reference','Amount','Status'].map(label => <th key={label} className="px-4 py-3">{label}</th>)}</tr></thead>
                  <tbody className="divide-y divide-gray-800/70">{payments.map(payment => <tr key={payment.id}>
                    <td className="whitespace-nowrap px-4 py-4 text-xs text-gray-400">{formatDate(payment.created_at.slice(0, 10))}</td>
                    <td className="px-4 py-4 font-mono text-xs text-lime-300">{payment.booking_reference}</td>
                    <td className="px-4 py-4"><div>{payment.facility_name}</div><div className="mt-1 text-xs text-gray-500">{payment.booking_date ? formatDate(payment.booking_date) : ''} {payment.start_time}</div></td>
                    <td className="px-4 py-4 text-xs capitalize text-gray-300">{payment.provider ?? '—'}<div className="mt-1 text-gray-500">{payment.provider_reference ?? '—'}</div></td>
                    <td className="whitespace-nowrap px-4 py-4 font-semibold">{formatCurrency(payment.amount)}</td>
                    <td className="px-4 py-4"><span className={`rounded-full px-2.5 py-1 text-xs capitalize ${statusClass(payment.status)}`}>{payment.status}</span></td>
                  </tr>)}</tbody>
                </table>
              </div>
            </>}
        </section>
      </div>
    </main>
  )
}
