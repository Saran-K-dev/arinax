import { useEffect, useState } from 'react'
import { Pencil, Plus, Save, X } from 'lucide-react'
import { Facility, SportCategory } from '../../types'
import { fetchAdminFacilities, saveAdminFacility } from '../../lib/database'
import { formatCurrency } from '../../utils/helpers'

type FacilityForm = {
  id: string | null; name: string; category: SportCategory; description: string; location: string;
  images: string; amenities: string; sports: string; isActive: boolean; basePrice: number;
  peakPrice: number; weekendMultiplier: number; advancePercent: number; peakStart: number; peakEnd: number
}

const blank: FacilityForm = {
  id: null, name: '', category: 'football', description: '', location: '', images: '', amenities: '', sports: '',
  isActive: true, basePrice: 0, peakPrice: 0, weekendMultiplier: 1, advancePercent: 30, peakStart: 18, peakEnd: 22,
}
const csv = (value: string) => value.split(',').map(part => part.trim()).filter(Boolean)
const inputClass = 'mt-1 w-full rounded-lg border border-gray-700 bg-[#141414] px-3 py-2 text-sm text-white outline-none focus:border-lime-500'
const labelClass = 'block text-xs font-semibold text-gray-400'

export default function AdminFacilities() {
  const [facilities, setFacilities] = useState<(Facility & { isActive?: boolean })[]>([])
  const [form, setForm] = useState<FacilityForm>(blank)
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const refresh = async () => setFacilities(await fetchAdminFacilities())
  useEffect(() => { void refresh().catch(e => setError(e instanceof Error ? e.message : 'Could not load facilities.')) }, [])

  const editFacility = (facility: Facility & { isActive?: boolean }) => {
    setForm({ id: facility.id, name: facility.name, category: facility.category, description: facility.description,
      location: facility.location, images: facility.images.join(', '), amenities: facility.amenities.join(', '),
      sports: facility.sports.join(', '), isActive: facility.isActive ?? true, basePrice: facility.pricePerHour,
      peakPrice: facility.peakPricePerHour, weekendMultiplier: facility.weekendMultiplier ?? 1,
      advancePercent: facility.advancePercent ?? 30, peakStart: facility.peakHoursStart ?? 18, peakEnd: facility.peakHoursEnd ?? 22 })
    setEditing(true); setError(''); setSuccess('')
  }

  const save = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setError(''); setSuccess('')
    try {
      await saveAdminFacility({ ...form, images: csv(form.images), amenities: csv(form.amenities), sports: csv(form.sports) })
      await refresh()
      setSuccess(form.id ? 'Facility and pricing updated in Supabase.' : 'Facility added to Supabase.')
      setForm(blank); setEditing(false)
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not save facility.') }
    finally { setBusy(false) }
  }

  return <div className="space-y-6">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div><h1 className="text-2xl md:text-3xl font-black text-white">Facilities</h1><p className="mt-1 text-sm text-gray-400">Manage venue details, visibility, and starting prices.</p></div>
      {!editing && <button onClick={() => { setForm(blank); setEditing(true); setError(''); setSuccess('') }} className="inline-flex items-center justify-center gap-2 rounded-lg bg-lime-500 px-4 py-2.5 text-sm font-bold text-black hover:bg-lime-400"><Plus size={16}/> Add Facility</button>}
    </div>
    {error && <p role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{error}</p>}
    {success && <p role="status" className="rounded-lg border border-lime-500/30 bg-lime-500/10 p-3 text-sm text-lime-300">{success}</p>}

    {editing && <form onSubmit={save} className="rounded-xl border border-gray-800 bg-card p-5 md:p-6 space-y-5">
      <div className="flex items-center justify-between"><h2 className="text-lg font-bold text-white">{form.id ? 'Edit Facility' : 'New Facility'}</h2><button type="button" onClick={() => setEditing(false)} aria-label="Close form" className="rounded p-1 text-gray-400 hover:text-white"><X size={18}/></button></div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <label className={labelClass}>Facility name<input required minLength={2} className={inputClass} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}/></label>
        <label className={labelClass}>Category<select className={inputClass} value={form.category} onChange={e => setForm({ ...form, category: e.target.value as SportCategory })}>{[['cricket','Cricket'],['box-cricket','Box Cricket'],['football','Football'],['badminton','Badminton'],['multi-sport','Multi-Sport']].map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
        <label className={labelClass}>Location<input required className={inputClass} value={form.location} onChange={e => setForm({ ...form, location: e.target.value })}/></label>
        <label className={`${labelClass} sm:col-span-2 lg:col-span-3`}>Description<textarea rows={2} className={inputClass} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}/></label>
        <label className={labelClass}>Image URLs (comma separated)<input className={inputClass} value={form.images} onChange={e => setForm({ ...form, images: e.target.value })}/></label>
        <label className={labelClass}>Amenities (comma separated)<input className={inputClass} value={form.amenities} onChange={e => setForm({ ...form, amenities: e.target.value })}/></label>
        <label className={labelClass}>Sports offered (comma separated)<input className={inputClass} value={form.sports} onChange={e => setForm({ ...form, sports: e.target.value })}/></label>
        <label className={labelClass}>Off-peak hourly rate<input required type="number" min="0" step="0.01" className={inputClass} value={form.basePrice} onChange={e => setForm({ ...form, basePrice: Number(e.target.value) })}/></label>
        <label className={labelClass}>Peak hourly rate<input required type="number" min="0" step="0.01" className={inputClass} value={form.peakPrice} onChange={e => setForm({ ...form, peakPrice: Number(e.target.value) })}/></label>
        <label className={labelClass}>Weekend multiplier<input required type="number" min="0.01" step="0.05" className={inputClass} value={form.weekendMultiplier} onChange={e => setForm({ ...form, weekendMultiplier: Number(e.target.value) })}/></label>
        <label className={labelClass}>Advance percentage<input required type="number" min="0" max="100" step="1" className={inputClass} value={form.advancePercent} onChange={e => setForm({ ...form, advancePercent: Number(e.target.value) })}/></label>
        <label className={labelClass}>Peak starts (hour, 0–23)<input required type="number" min="0" max="23" className={inputClass} value={form.peakStart} onChange={e => setForm({ ...form, peakStart: Number(e.target.value) })}/></label>
        <label className={labelClass}>Peak ends (hour, 1–24)<input required type="number" min="1" max="24" className={inputClass} value={form.peakEnd} onChange={e => setForm({ ...form, peakEnd: Number(e.target.value) })}/></label>
        <label className="flex items-center gap-2 self-end pb-2 text-sm text-gray-300"><input type="checkbox" checked={form.isActive} onChange={e => setForm({ ...form, isActive: e.target.checked })} className="accent-lime-500"/> Visible to customers</label>
      </div>
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><button type="button" onClick={() => setEditing(false)} className="rounded-lg border border-gray-700 px-4 py-2 text-sm text-gray-300">Cancel</button><button disabled={busy} className="inline-flex items-center justify-center gap-2 rounded-lg bg-lime-500 px-5 py-2 font-bold text-black disabled:opacity-50"><Save size={16}/>{busy ? 'Saving…' : 'Save Facility'}</button></div>
    </form>}

    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {facilities.map(f => <article key={f.id} className="overflow-hidden rounded-xl border border-gray-800 bg-card">
        <div className="relative h-40 bg-[#141414]"><img src={f.images[0]} alt={f.name} className="h-full w-full object-cover"/><span className={`absolute left-3 top-3 rounded-full px-2.5 py-1 text-[11px] font-bold ${f.isActive ? 'bg-lime-500/90 text-black' : 'bg-gray-900/90 text-gray-300'}`}>{f.isActive ? 'Active' : 'Hidden'}</span></div>
        <div className="space-y-3 p-4"><div className="flex items-start justify-between gap-3"><div><h3 className="font-bold text-white">{f.name}</h3><p className="mt-1 text-xs capitalize text-gray-400">{f.category.replace('-', ' ')} · {f.location}</p></div><button onClick={() => editFacility(f)} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-gray-700 px-3 py-2 text-xs font-semibold text-gray-200 hover:border-lime-500"><Pencil size={13}/> Edit</button></div><p className="line-clamp-2 text-xs text-gray-400">{f.description}</p><div className="flex flex-wrap gap-2 text-xs"><span className="rounded bg-gray-800 px-2 py-1 text-gray-300">Base {formatCurrency(f.pricePerHour)}/hr</span><span className="rounded bg-lime-500/10 px-2 py-1 text-lime-300">Peak {formatCurrency(f.peakPricePerHour)}/hr</span><span className="rounded bg-gray-800 px-2 py-1 text-gray-300">Weekend ×{f.weekendMultiplier}</span></div></div>
      </article>)}
      {!facilities.length && <p className="text-sm text-gray-400">No facilities found in Supabase yet.</p>}
    </div>
  </div>
}
