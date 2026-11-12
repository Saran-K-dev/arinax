import { useState } from 'react'
import { Search } from 'lucide-react'
import FacilityCard from '../components/FacilityCard'
import { SPORTS } from '../config/site'
import { SportCategory } from '../types'
import { useFacilities } from '../hooks/useFacilities'

export default function Sports() {
  const [activeFilter, setActiveFilter] = useState<SportCategory | 'all'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const { facilities, loading, error } = useFacilities()

  const filtered = facilities.filter(f => {
    const matchesCat = activeFilter === 'all' || f.category === activeFilter
    const matchesSearch = f.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.description.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesCat && matchesSearch
  })

  return (
    <div className="pt-16 min-h-screen">
      {/* Header */}
      <section className="bg-[#0d0d0d] border-b border-gray-800 py-12 px-4 md:px-6">
        <div className="max-w-7xl mx-auto text-center">
          <p className="text-lime-500 text-sm font-bold uppercase tracking-widest mb-2">All Venues</p>
          <h1 className="text-4xl md:text-5xl font-black text-white mb-4">
            Sports &amp; Facilities
          </h1>
          <p className="text-gray-400 max-w-xl mx-auto text-sm">
            Choose from a variety of sports and world-class facilities.
          </p>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 md:px-6 py-10">
        {/* Filters + Search */}
        <div className="flex flex-col md:flex-row gap-4 mb-8">
          {/* Category filters */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setActiveFilter('all')}
              className={`px-4 py-2 rounded-md text-sm font-semibold transition ${
                activeFilter === 'all'
                  ? 'bg-lime-500 text-black'
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700 border border-gray-700'
              }`}
            >
              All Sports
            </button>
            {SPORTS.map(sport => (
              <button
                key={sport.id}
                onClick={() => setActiveFilter(sport.id)}
                className={`px-4 py-2 rounded-md text-sm font-semibold transition flex items-center gap-1.5 ${
                  activeFilter === sport.id
                    ? 'bg-lime-500 text-black'
                    : 'bg-gray-800 text-gray-300 hover:bg-gray-700 border border-gray-700'
                }`}
              >
                <span>{sport.icon}</span> {sport.name}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative ml-auto w-full md:w-64">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              type="text"
              placeholder="Search facilities..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-md pl-9 pr-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-lime-500"
            />
          </div>
        </div>

        {/* Results count */}
        <p className="text-gray-500 text-sm mb-6">
          Showing <span className="text-white font-semibold">{filtered.length}</span> {filtered.length === 1 ? 'facility' : 'facilities'}
        </p>

        {/* Grid */}
        {loading ? <p className="text-gray-400 py-16 text-center">Loading facilities…</p> : error ? <p role="alert" className="text-red-400 py-16 text-center">{error}</p> : filtered.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map(fac => (
              <FacilityCard key={fac.id} facility={fac} />
            ))}
          </div>
        ) : (
          <div className="text-center py-24 text-gray-500">
            <p className="text-5xl mb-4">🏟️</p>
            <p className="font-semibold text-white mb-2">No facilities found</p>
            <p className="text-sm">Try a different sport or search term.</p>
          </div>
        )}
      </div>
    </div>
  )
}
