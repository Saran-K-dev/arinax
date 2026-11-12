import { useState, useEffect } from 'react'
import { DollarSign, Save, RotateCcw, CheckCircle, Percent, Clock, Sparkles } from 'lucide-react'
import { SITE } from '../../config/site'
import { Facility } from '../../types'
import {
  getPricingSettings,
  AdminPricingSettings,
  formatCurrency,
} from '../../utils/helpers'
import { fetchAdminFacilities, fetchPricing, savePricing as persistPricing } from '../../lib/database'

export default function AdminPricing() {
  const [facilities, setFacilities] = useState<(Facility & { isActive?: boolean })[]>([])
  const [settings, setSettings] = useState<AdminPricingSettings>(getPricingSettings())
  const [savedSuccess, setSavedSuccess] = useState(false)
  const [loadError, setLoadError] = useState('')

  // Facility custom rates map
  const [facilityPrices, setFacilityPrices] = useState<
    Record<string, { pricePerHour: number; peakPricePerHour: number }>
  >({})

  useEffect(() => {
    let active = true
    Promise.all([fetchAdminFacilities(), fetchPricing()]).then(([facilityRows, rows]) => {
      if (!active) return
      setFacilities(facilityRows)
      const current = getPricingSettings()
      const first = rows[0]
      setSettings({ ...current, advancePercent: first?.advance_percent ?? current.advancePercent,
        peakHoursStart: first?.peak_start ?? current.peakHoursStart, peakHoursEnd: first?.peak_end ?? current.peakHoursEnd,
        weekendMultiplier: first?.weekend_multiplier ?? current.weekendMultiplier })
      const prices: Record<string, { pricePerHour: number; peakPricePerHour: number }> = {}
      facilityRows.forEach(f => {
        const row = rows.find(r => r.facility_id === f.id)
        prices[f.id] = { pricePerHour: row ? Number(row.base_price) : f.pricePerHour,
          peakPricePerHour: row ? Number(row.peak_price) : f.peakPricePerHour }
      })
      setFacilityPrices(prices); setLoadError('')
    }).catch(e => setLoadError(e instanceof Error ? e.message : 'Could not load pricing.'))
    return () => { active = false }
  }, [])

  const handleFacilityPriceChange = (
    id: string,
    field: 'pricePerHour' | 'peakPricePerHour',
    val: number
  ) => {
    setFacilityPrices((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        [field]: val,
      },
    }))
  }

  const handleSave = async () => {
    try {
      await persistPricing(facilities.map(f => ({ facility_id: f.id,
        base_price: facilityPrices[f.id]?.pricePerHour ?? f.pricePerHour,
        peak_price: facilityPrices[f.id]?.peakPricePerHour ?? f.peakPricePerHour,
        weekend_multiplier: settings.weekendMultiplier, advance_percent: settings.advancePercent,
        peak_start: settings.peakHoursStart, peak_end: settings.peakHoursEnd })))
      setSavedSuccess(true); setLoadError(''); setTimeout(() => setSavedSuccess(false), 3000)
    } catch (e) { setLoadError(e instanceof Error ? e.message : 'Could not save pricing.') }
  }

  const handleResetDefaults = async () => {
    const defaultSettings: AdminPricingSettings = {
      advancePercent: SITE.pricing.advancePercent,
      peakHoursStart: SITE.pricing.peakHoursStart,
      peakHoursEnd: SITE.pricing.peakHoursEnd,
      weekendMultiplier: SITE.pricing.weekendMultiplier,
      facilityOverrides: {},
    }
    setSettings(defaultSettings)

    const defaultPrices: Record<string, { pricePerHour: number; peakPricePerHour: number }> = {}
    facilities.forEach((f) => {
      defaultPrices[f.id] = {
        pricePerHour: f.pricePerHour,
        peakPricePerHour: f.peakPricePerHour,
      }
    })
    setFacilityPrices(defaultPrices)
    try {
      await persistPricing(facilities.map(f => ({ facility_id: f.id, base_price: f.pricePerHour,
        peak_price: f.peakPricePerHour, weekend_multiplier: defaultSettings.weekendMultiplier,
        advance_percent: defaultSettings.advancePercent, peak_start: defaultSettings.peakHoursStart,
        peak_end: defaultSettings.peakHoursEnd })))
      setSavedSuccess(true); setLoadError(''); setTimeout(() => setSavedSuccess(false), 3000)
    } catch (e) { setLoadError(e instanceof Error ? e.message : 'Could not reset pricing.') }
  }

  return (
    <div className="space-y-6">
      {loadError && <p role="alert" className="text-red-400">{loadError}</p>}
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-white">Pricing &amp; Revenue Configuration</h1>
          <p className="text-gray-400 text-sm mt-1">
            Configure hourly rates, peak hour surge, weekend pricing, and customer advance deposit percentage.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleResetDefaults}
            className="bg-card hover:bg-gray-800 border border-gray-700 text-gray-300 text-sm font-semibold px-4 py-2 rounded-lg flex items-center gap-1.5 transition"
          >
            <RotateCcw size={15} /> Reset Defaults
          </button>
          <button
            onClick={handleSave}
            className="bg-lime-500 hover:bg-lime-400 text-black text-sm font-bold px-5 py-2 rounded-lg flex items-center gap-1.5 transition shadow-lg shadow-lime-500/20"
          >
            <Save size={16} /> Save Changes
          </button>
        </div>
      </div>

      {savedSuccess && (
        <div className="bg-lime-500/10 border border-lime-500/30 rounded-xl p-4 text-lime-400 text-sm flex items-center gap-2 animate-fade-in">
          <CheckCircle size={18} />
          Pricing rules updated in Supabase.
        </div>
      )}

      {/* Global Rules: Peak Hours, Advance %, Weekend Surge */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Advance Percentage */}
        <div className="bg-card rounded-xl border border-gray-800 p-5">
          <div className="flex items-center gap-2 text-lime-400 font-bold mb-3">
            <Percent size={18} />
            Advance Deposit Requirement
          </div>
          <p className="text-xs text-gray-400 mb-4">
            Percentage required from customer upon checkout. Balance is collected at the turf venue.
          </p>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min="10"
              max="100"
              step="5"
              value={settings.advancePercent}
              onChange={(e) => setSettings({ ...settings, advancePercent: Number(e.target.value) })}
              className="flex-1 accent-lime-500"
            />
            <span className="text-xl font-black text-white w-14 text-right">
              {settings.advancePercent}%
            </span>
          </div>
        </div>

        {/* Peak Hours Range */}
        <div className="bg-card rounded-xl border border-gray-800 p-5">
          <div className="flex items-center gap-2 text-lime-400 font-bold mb-3">
            <Clock size={18} />
            Peak Hour Time Window
          </div>
          <p className="text-xs text-gray-400 mb-4">
            High-demand evening hours where peak-rate pricing is automatically applied.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] text-gray-400 uppercase font-semibold">Start Time</label>
              <select
                value={settings.peakHoursStart}
                onChange={(e) => setSettings({ ...settings, peakHoursStart: Number(e.target.value) })}
                className="w-full mt-1 bg-[#141414] border border-gray-700 rounded-lg p-2 text-xs text-white"
              >
                {[16, 17, 18, 19].map((h) => (
                  <option key={h} value={h}>{h > 12 ? `${h - 12} PM` : `${h} AM`}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[11px] text-gray-400 uppercase font-semibold">End Time</label>
              <select
                value={settings.peakHoursEnd}
                onChange={(e) => setSettings({ ...settings, peakHoursEnd: Number(e.target.value) })}
                className="w-full mt-1 bg-[#141414] border border-gray-700 rounded-lg p-2 text-xs text-white"
              >
                {[21, 22, 23].map((h) => (
                  <option key={h} value={h}>{h > 12 ? `${h - 12} PM` : `${h} AM`}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Weekend Multiplier */}
        <div className="bg-card rounded-xl border border-gray-800 p-5">
          <div className="flex items-center gap-2 text-lime-400 font-bold mb-3">
            <Sparkles size={18} />
            Weekend Surge Multiplier
          </div>
          <p className="text-xs text-gray-400 mb-4">
            Saturday and Sunday multiplier applied to each hourly booking rate.
          </p>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min="1.0"
              max="1.5"
              step="0.05"
              value={settings.weekendMultiplier}
              onChange={(e) => setSettings({ ...settings, weekendMultiplier: parseFloat(e.target.value) })}
              className="flex-1 accent-lime-500"
            />
            <span className="text-xl font-black text-white w-14 text-right">
              {settings.weekendMultiplier}x
            </span>
          </div>
        </div>
      </div>

      {/* Per Facility Pricing Table */}
      <div className="bg-card rounded-xl border border-gray-800 overflow-hidden shadow-xl">
        <div className="p-5 border-b border-gray-800">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <DollarSign size={20} className="text-lime-500" />
            Facility Hourly Rates Matrix
          </h2>
          <p className="text-xs text-gray-400 mt-1">
            Override the default hourly rates for each individual sports arena.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#141414] text-xs font-semibold text-gray-400 uppercase tracking-wider border-b border-gray-800">
              <tr>
                <th className="py-3 px-4">Facility Name</th>
                <th className="py-3 px-4">Sport Category</th>
                <th className="py-3 px-4">Off-Peak Rate (₹ / hr)</th>
                <th className="py-3 px-4">Peak Rate (₹ / hr)</th>
                <th className="py-3 px-4">Sample 2hr Booking</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/60">
              {facilities.map((facility) => {
                const current = facilityPrices[facility.id] || {
                  pricePerHour: facility.pricePerHour,
                  peakPricePerHour: facility.peakPricePerHour,
                }
                const sample2hrOffPeak = current.pricePerHour * 2
                const sample2hrPeak = current.peakPricePerHour * 2

                return (
                  <tr key={facility.id} className="hover:bg-white/[0.02] transition">
                    <td className="py-4 px-4">
                      <div className="font-bold text-white">{facility.name}</div>
                      <div className="text-xs text-gray-500">{facility.location}</div>
                    </td>
                    <td className="py-4 px-4">
                      <span className="bg-gray-800 text-gray-300 text-xs px-2.5 py-1 rounded-full capitalize border border-gray-700">
                        {facility.category.replace('-', ' ')}
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-1.5">
                        <span className="text-gray-500 text-xs font-bold">₹</span>
                        <input
                          type="number"
                          step="100"
                          min="200"
                          value={current.pricePerHour}
                          onChange={(e) =>
                            handleFacilityPriceChange(
                              facility.id,
                              'pricePerHour',
                              Math.max(0, parseInt(e.target.value, 10) || 0)
                            )
                          }
                          className="w-28 bg-[#141414] border border-gray-700 focus:border-lime-500 rounded-lg px-3 py-1.5 text-white font-bold text-sm outline-none transition"
                        />
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-1.5">
                        <span className="text-lime-500 text-xs font-bold">₹</span>
                        <input
                          type="number"
                          step="100"
                          min="300"
                          value={current.peakPricePerHour}
                          onChange={(e) =>
                            handleFacilityPriceChange(
                              facility.id,
                              'peakPricePerHour',
                              Math.max(0, parseInt(e.target.value, 10) || 0)
                            )
                          }
                          className="w-28 bg-[#141414] border border-gray-700 focus:border-lime-500 rounded-lg px-3 py-1.5 text-lime-400 font-bold text-sm outline-none transition"
                        />
                      </div>
                    </td>
                    <td className="py-4 px-4 text-xs text-gray-400">
                      <div>Off-Peak: <span className="font-semibold text-white">{formatCurrency(sample2hrOffPeak)}</span></div>
                      <div>Peak: <span className="font-semibold text-lime-400">{formatCurrency(sample2hrPeak)}</span></div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

