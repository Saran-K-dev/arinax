import { useParams, useNavigate, Link } from 'react-router-dom'
import { useState } from 'react'
import { Star, MapPin, Clock, ArrowLeft, CheckCircle, ArrowRight } from 'lucide-react'
import { SPORTS, SITE, TESTIMONIALS } from '../config/site'
import { formatCurrency, getPricingSettings } from '../utils/helpers'
import { useFacilities } from '../hooks/useFacilities'

export default function TurfDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [activeImg, setActiveImg] = useState(0)
  const { facilities, loading, error } = useFacilities()

  const facility = facilities.find(f => f.id === id)

  if (!facility) {
    if (loading) return <div className="pt-24 min-h-screen text-center text-gray-400">Loading facility…</div>
    if (error) return <div role="alert" className="pt-24 min-h-screen text-center text-red-400">{error}</div>
    return (
      <div className="pt-24 min-h-screen flex flex-col items-center justify-center gap-4 text-gray-400">
        <p className="text-5xl">🏟️</p>
        <p className="font-semibold text-white text-xl">Facility not found</p>
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-lime-500 hover:text-lime-400 font-medium"
        >
          <ArrowLeft size={16} /> Go Back
        </button>
      </div>
    )
  }

  const sport = SPORTS.find(s => s.id === facility.category)
  const pricing = { basePrice: facility.pricePerHour, peakPrice: facility.peakPricePerHour }
  const fallbackRules = getPricingSettings()
  const pricingRules = { ...fallbackRules, advancePercent: facility.advancePercent ?? fallbackRules.advancePercent,
    peakHoursStart: facility.peakHoursStart ?? fallbackRules.peakHoursStart,
    peakHoursEnd: facility.peakHoursEnd ?? fallbackRules.peakHoursEnd,
    weekendMultiplier: facility.weekendMultiplier ?? fallbackRules.weekendMultiplier }

  return (
    <div className="pt-16 min-h-screen">
      {/* Back nav */}
      <div className="max-w-7xl mx-auto px-4 md:px-6 pt-6">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-gray-400 hover:text-lime-400 text-sm font-medium transition mb-4"
        >
          <ArrowLeft size={16} /> Back to Facilities
        </button>
      </div>

      <div className="max-w-7xl mx-auto px-4 md:px-6 pb-16">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          {/* Images */}
          <div>
            <div className="relative overflow-hidden rounded-xl aspect-video mb-3">
              <img
                src={facility.images[activeImg]}
                alt={facility.name}
                className="w-full h-full object-cover"
                onError={e => {
                  (e.target as HTMLImageElement).src = `https://images.unsplash.com/photo-1529900748604-07564a03e7a6?w=800&q=80`
                }}
              />
              <div className="absolute top-3 left-3">
                <span className="bg-lime-500 text-black text-xs font-bold px-2 py-1 rounded-md uppercase">
                  {facility.category.replace('-', ' ')}
                </span>
              </div>
            </div>
            {facility.images.length > 1 && (
              <div className="flex gap-2">
                {facility.images.map((src, i) => (
                  <button
                    key={i}
                    onClick={() => setActiveImg(i)}
                    className={`overflow-hidden rounded-lg flex-1 aspect-video border-2 transition ${
                      activeImg === i ? 'border-lime-500' : 'border-transparent opacity-60 hover:opacity-100'
                    }`}
                  >
                    <img src={src} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Details */}
          <div>
            {/* Header */}
            <div className="flex items-start justify-between gap-3 mb-3">
              <h1 className="text-3xl font-black text-white">{facility.name}</h1>
              <div className="flex flex-col items-end shrink-0">
                <div className="flex items-center gap-1">
                  <Star size={16} className="text-lime-500 fill-lime-500" />
                  <span className="font-bold text-white">{facility.rating}</span>
                  <span className="text-gray-500 text-sm">({facility.reviewCount})</span>
                </div>
              </div>
            </div>

            {/* Location */}
            <div className="flex items-center gap-1.5 text-gray-400 text-sm mb-4">
              <MapPin size={14} className="text-lime-500" />
              {facility.location}
            </div>

            {/* Price */}
            <div className="bg-[#0d0d0d] border border-gray-800 rounded-xl p-4 mb-5">
              <div className="flex justify-between items-center mb-3">
                <div>
                  <div className="text-gray-400 text-xs uppercase tracking-wide mb-1">Off-Peak Rate</div>
                  <div className="text-2xl font-black text-lime-500">
                    {formatCurrency(pricing.basePrice)}<span className="text-gray-400 font-normal text-sm">/hr</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-gray-400 text-xs uppercase tracking-wide mb-1">Peak Rate ({pricingRules.peakHoursStart}:00–{pricingRules.peakHoursEnd}:00)</div>
                  <div className="text-2xl font-black text-white">
                    {formatCurrency(pricing.peakPrice)}<span className="text-gray-400 font-normal text-sm">/hr</span>
                  </div>
                </div>
              </div>
              <p className="text-xs text-gray-500">30% advance required at booking. Balance due at venue.</p>
            </div>

            {/* Description */}
            <p className="text-gray-300 text-sm leading-relaxed mb-5">{facility.description}</p>

            {/* Sports supported */}
            <div className="mb-5">
              <h3 className="font-bold text-white mb-2 text-sm">Sports Supported</h3>
              <div className="flex flex-wrap gap-2">
                {facility.sports.map(s => (
                  <span key={s} className="text-xs bg-lime-500/10 text-lime-400 border border-lime-500/20 px-3 py-1 rounded-full">
                    {s}
                  </span>
                ))}
              </div>
            </div>

            {/* Amenities */}
            <div className="mb-5">
              <h3 className="font-bold text-white mb-2 text-sm">Amenities</h3>
              <div className="grid grid-cols-2 gap-2">
                {facility.amenities.map(a => (
                  <div key={a} className="flex items-center gap-2 text-sm text-gray-300">
                    <CheckCircle size={14} className="text-lime-500 shrink-0" />
                    {a}
                  </div>
                ))}
              </div>
            </div>

            {/* Opening Hours */}
            <div className="mb-6">
              <h3 className="font-bold text-white mb-2 text-sm">Opening Hours</h3>
              <div className="flex items-center gap-2 text-sm text-gray-300">
                <Clock size={14} className="text-lime-500" />
                <span>Daily: {SITE.openingHours.weekday.open} – {SITE.openingHours.weekday.close}</span>
              </div>
            </div>

            {/* CTA */}
            <Link
              to="/booking"
              state={{ facilityId: facility.id }}
              className="flex items-center justify-center gap-2 w-full bg-lime-500 hover:bg-lime-400 text-black font-bold py-4 rounded-xl transition text-base"
            >
              Book This Turf <ArrowRight size={18} />
            </Link>
          </div>
        </div>

        {/* Rules & Policies */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-8">
          <div>
            <h2 className="text-xl font-bold text-white mb-4">Rules &amp; Policies</h2>
            <ul className="space-y-3 text-sm text-gray-300">
              {[
                'Proper sports footwear must be worn at all times.',
                'No outside food or beverages allowed on the turf.',
                'Bookings are non-transferable to another person.',
                'Management not responsible for lost property.',
                'Arrive at least 10 minutes before your slot.',
                'Cancellations must be made 24 hours in advance for a refund.',
                'Smoking and alcohol strictly prohibited.',
                'Players must maintain discipline and sportsmanship.',
              ].map((rule, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-lime-500 mt-0.5">•</span>
                  {rule}
                </li>
              ))}
            </ul>
          </div>

          {/* Reviews */}
          <div>
            <h2 className="text-xl font-bold text-white mb-4">Customer Reviews</h2>
            {/* Rating summary */}
            <div className="flex items-center gap-4 mb-5 p-4 bg-card rounded-xl border border-gray-800">
              <div className="text-center">
                <div className="text-5xl font-black text-lime-500">{facility.rating}</div>
                <div className="flex gap-0.5 justify-center mt-1">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      size={12}
                      className={i < Math.floor(facility.rating) ? 'text-lime-500 fill-lime-500' : 'text-gray-600'}
                    />
                  ))}
                </div>
                <div className="text-gray-500 text-xs mt-1">{facility.reviewCount} reviews</div>
              </div>
              <div className="flex-1 space-y-1.5">
                {[5, 4, 3, 2, 1].map(star => (
                  <div key={star} className="flex items-center gap-2 text-xs">
                    <span className="text-gray-400 w-3">{star}</span>
                    <Star size={10} className="text-lime-500 fill-lime-500" />
                    <div className="flex-1 bg-gray-800 rounded-full h-1.5">
                      <div
                        className="bg-lime-500 h-1.5 rounded-full"
                        style={{ width: `${star === 5 ? 70 : star === 4 ? 20 : star === 3 ? 7 : star === 2 ? 2 : 1}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              {TESTIMONIALS.slice(0, 2).map(t => (
                <blockquote key={t.id} className="bg-card rounded-xl border border-gray-800 p-4">
                  <div className="flex gap-0.5 mb-2">
                    {[...Array(t.rating)].map((_, i) => (
                      <Star key={i} size={12} className="text-lime-500 fill-lime-500" />
                    ))}
                  </div>
                  <p className="text-gray-300 text-sm italic mb-2">"{t.comment}"</p>
                  <footer className="text-xs text-gray-500">— {t.name}</footer>
                </blockquote>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

