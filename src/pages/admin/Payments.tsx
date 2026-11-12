import { useEffect, useMemo, useState } from 'react'
import { CheckCircle, Download, IndianRupee, Search } from 'lucide-react'
import { AdminPayment, fetchAdminBookings, fetchAdminPayments, recordAdminPayment } from '../../lib/database'
import { SavedBooking } from '../../types'
import { formatCurrency, formatDate } from '../../utils/helpers'

const field = 'w-full rounded-lg border border-gray-700 bg-[#141414] px-3 py-2 text-sm text-white outline-none focus:border-lime-500'
const csvCell = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`

export default function AdminPayments() {
  const [payments, setPayments] = useState<AdminPayment[]>([])
  const [bookings, setBookings] = useState<SavedBooking[]>([])
  const [query, setQuery] = useState('')
  const [selectedBooking, setSelectedBooking] = useState('')
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState('Cash')
  const [reference, setReference] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const refresh = async () => {
    const [p, b] = await Promise.all([fetchAdminPayments(), fetchAdminBookings()])
    setPayments(p); setBookings(b)
  }
  useEffect(() => { void refresh().catch(e => setError(e instanceof Error ? e.message : 'Could not load payment history.')).finally(() => setLoading(false)) }, [])

  const outstandingBookings = useMemo(() => bookings.filter(b => b.status !== 'cancelled' && b.totalPrice > (b.amountPaid ?? 0)), [bookings])
  const selected = outstandingBookings.find(b => b.id === selectedBooking)
  const outstanding = selected ? Math.max(0, selected.totalPrice - (selected.amountPaid ?? 0)) : 0
  const collected = payments.filter(p => p.status === 'succeeded').reduce((sum, p) => sum + Number(p.amount), 0)
  const pending = outstandingBookings.reduce((sum, b) => sum + b.totalPrice - (b.amountPaid ?? 0), 0)
  const filtered = payments.filter(p => `${p.booking_reference} ${p.customer_name} ${p.customer_phone} ${p.customer_email ?? ''} ${p.facility_name} ${p.provider_reference ?? ''}`.toLowerCase().includes(query.toLowerCase()))

  const recordPayment = async (event: React.FormEvent) => {
    event.preventDefault(); setSaving(true); setError(''); setSuccess('')
    try {
      if (!selectedBooking) throw new Error('Select a booking first.')
      await recordAdminPayment(selectedBooking, Number(amount), method, reference)
      setSuccess('Payment recorded and balance updated.')
      setAmount(''); setReference(''); await refresh()
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not record payment.') }
    finally { setSaving(false) }
  }

  const exportCSV = () => {
    const rows = [['Payment ID','Booking Reference','Customer','Phone','Email','Facility','Amount','Currency','Method','Reference','Status','Created At'], ...filtered.map(p => [p.id,p.booking_reference,p.customer_name,p.customer_phone,p.customer_email,p.facility_name,p.amount,p.currency,p.provider,p.provider_reference,p.status,p.created_at])]
    const blob = new Blob([rows.map(row => row.map(csvCell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' })
    const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `arena-x-payments-${new Date().toISOString().slice(0,10)}.csv`; link.click(); URL.revokeObjectURL(link.href)
  }

  return <div className="space-y-6">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><h1 className="text-2xl md:text-3xl font-black text-white">Payments</h1><p className="mt-1 text-sm text-gray-400">Collected payments and outstanding booking balances from Supabase.</p></div><button onClick={exportCSV} className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-700 bg-card px-4 py-2 text-sm font-semibold text-gray-200 hover:bg-gray-800"><Download size={16}/> Export Report</button></div>
    {error && <p role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{error}</p>}{success && <p role="status" className="rounded-lg border border-lime-500/30 bg-lime-500/10 p-3 text-sm text-lime-300">{success}</p>}
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2"><div className="rounded-xl border border-gray-800 bg-card p-5"><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-400"><IndianRupee size={15} className="text-lime-400"/> Payments collected</div><p className="mt-2 text-3xl font-black text-lime-300">{formatCurrency(collected)}</p><p className="mt-2 text-xs text-gray-500">Only succeeded payment records are counted.</p></div><div className="rounded-xl border border-gray-800 bg-card p-5"><div className="text-xs font-semibold uppercase tracking-wide text-gray-400">Outstanding balances</div><p className="mt-2 text-3xl font-black text-orange-300">{formatCurrency(pending)}</p><p className="mt-2 text-xs text-gray-500">Across {outstandingBookings.length} unpaid or partially paid bookings.</p></div></div>
    <form onSubmit={recordPayment} className="grid grid-cols-1 gap-3 rounded-xl border border-gray-800 bg-card p-5 md:grid-cols-2 xl:grid-cols-5 xl:items-end"><div className="md:col-span-2 xl:col-span-2"><label className="mb-1 block text-xs font-semibold text-gray-400">Record venue payment</label><select required className={field} value={selectedBooking} onChange={e => setSelectedBooking(e.target.value)}><option value="">Select a booking with a balance</option>{outstandingBookings.map(b => <option key={b.id} value={b.id}>{b.bookingReference ?? b.id} · {b.customer.name} · balance {formatCurrency(b.totalPrice - (b.amountPaid ?? 0))}</option>)}</select>{selected && <p className="mt-1 text-xs text-orange-300">Outstanding: {formatCurrency(outstanding)}</p>}</div><div><label className="mb-1 block text-xs font-semibold text-gray-400">Amount (₹)</label><input required type="number" min="0.01" max={outstanding || undefined} step="0.01" className={field} value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00"/></div><div><label className="mb-1 block text-xs font-semibold text-gray-400">Method</label><select className={field} value={method} onChange={e => setMethod(e.target.value)}>{['Cash','UPI','Card','Bank Transfer'].map(m => <option key={m}>{m}</option>)}</select></div><div className="flex gap-2"><input className={field} value={reference} onChange={e => setReference(e.target.value)} placeholder="Reference (optional)"/><button disabled={saving || !selectedBooking} className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-lime-500 px-4 py-2 text-sm font-bold text-black disabled:opacity-50"><CheckCircle size={15}/>{saving ? 'Saving…' : 'Record'}</button></div></form>
    <section className="overflow-hidden rounded-xl border border-gray-800 bg-card"><div className="flex flex-col gap-3 border-b border-gray-800 p-4 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-bold text-white">Payment History</h2><p className="mt-1 text-xs text-gray-400">{filtered.length} records</p></div><div className="relative w-full sm:max-w-sm"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"/><input className={`${field} pl-9`} value={query} onChange={e => setQuery(e.target.value)} placeholder="Search by booking, customer, or reference"/></div></div><div className="overflow-x-auto"><table className="w-full min-w-[880px] text-left text-sm"><thead className="bg-[#141414] text-[11px] uppercase text-gray-400"><tr>{['Date','Booking','Customer','Facility','Amount','Method / Reference','Status'].map(h => <th key={h} className="px-4 py-3">{h}</th>)}</tr></thead><tbody className="divide-y divide-gray-800/70">{filtered.map(p => <tr key={p.id}><td className="whitespace-nowrap px-4 py-3 text-xs text-gray-400">{formatDate(p.created_at.slice(0,10))}</td><td className="px-4 py-3 font-mono text-xs text-lime-300">{p.booking_reference}</td><td className="px-4 py-3"><div className="text-white">{p.customer_name}</div><div className="text-xs text-gray-500">{p.customer_phone}</div><div className="text-xs text-gray-500">{p.customer_email}</div></td><td className="px-4 py-3 text-xs text-gray-300">{p.facility_name}</td><td className="px-4 py-3 font-semibold text-white">{formatCurrency(Number(p.amount))}</td><td className="px-4 py-3 text-xs text-gray-400">{p.provider ?? '—'}<div className="text-gray-500">{p.provider_reference ?? ''}</div></td><td className="px-4 py-3"><span className={`rounded-full px-2 py-1 text-xs capitalize ${p.status === 'succeeded' ? 'bg-lime-500/10 text-lime-300' : p.status === 'failed' ? 'bg-red-500/10 text-red-300' : 'bg-yellow-500/10 text-yellow-300'}`}>{p.status}</span></td></tr>)}{!loading && !filtered.length && <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-gray-500">No payment records yet. Payments recorded here will appear in this report.</td></tr>}{loading && <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-gray-500">Loading payments from Supabase…</td></tr>}</tbody></table></div></section>
  </div>
}
