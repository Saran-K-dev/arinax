import { Link } from 'react-router-dom'
import { ArrowRight, ChevronDown } from 'lucide-react'
import FacilityCard from '../components/FacilityCard'
import { SITE, SPORTS, TESTIMONIALS, WHY_CHOOSE } from '../config/site'
import { formatCurrency, getPricingSettings } from '../utils/helpers'
import { Star } from 'lucide-react'
import { useFacilities } from '../hooks/useFacilities'

export default function Home() {
  const { facilities } = useFacilities()
  const featured = facilities.slice(0, 4)
  const minPrice = facilities.length ? Math.min(...facilities.map(f => f.pricePerHour)) : 0
  const defaults = getPricingSettings()
  const pricingRules = facilities[0] ? { ...defaults, advancePercent: facilities[0].advancePercent ?? defaults.advancePercent,
    peakHoursStart: facilities[0].peakHoursStart ?? defaults.peakHoursStart,
    peakHoursEnd: facilities[0].peakHoursEnd ?? defaults.peakHoursEnd,
    weekendMultiplier: facilities[0].weekendMultiplier ?? defaults.weekendMultiplier } : defaults
  const formatHour = (hour: number) => hour === 0 ? '12 AM' : hour < 12 ? `${hour} AM` : hour === 12 ? '12 PM' : `${hour - 12} PM`

  return (
    <div className="pt-16">
      {/* ── HERO ───────────────────────────────────────────── */}
      <section className="relative min-h-[92vh] flex items-center overflow-hidden">
        {/* Background image */}
        <div className="absolute inset-0">
          <img
            src="https://images.unsplash.com/photo-1529900748604-07564a03e7a6?w=1600&q=85"
            alt="Football turf at night"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/70 to-black/40" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-4 md:px-6 w-full">
          <div className="max-w-2xl">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 bg-lime-500/10 border border-lime-500/30 rounded-full px-4 py-1.5 mb-6">
              <span className="w-2 h-2 bg-lime-500 rounded-full animate-pulse" />
              <span className="text-lime-400 text-sm font-medium">Premium Sports Turf</span>
            </div>

            <h1 className="text-5xl md:text-7xl font-black leading-[1.05] tracking-tight mb-6">
              <span className="text-white">YOUR GAME.</span>
              <br />
              <span className="text-lime-500">YOUR TURF.</span>
              <br />
              <span className="text-white">YOUR TIME.</span>
            </h1>

            <p className="text-gray-300 text-lg md:text-xl leading-relaxed mb-8 max-w-lg">
              Book your favourite sports turf instantly and play with your friends, anytime, anywhere.
            </p>

            <div className="flex flex-wrap gap-4">
              <Link
                to="/booking"
                className="inline-flex items-center gap-2 bg-lime-500 hover:bg-lime-400 text-black font-bold px-8 py-3.5 rounded-md transition-all hover:shadow-xl hover:shadow-lime-500/30 text-base"
              >
                Book Your Slot <ArrowRight size={18} />
              </Link>
              <Link
                to="/sports"
                className="inline-flex items-center gap-2 border border-white/30 hover:border-lime-500 text-white hover:text-lime-400 font-semibold px-8 py-3.5 rounded-md transition-all text-base"
              >
                Explore Facilities
              </Link>
            </div>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce text-gray-400">
          <ChevronDown size={28} />
        </div>
      </section>

      {/* ── SPORTS CATEGORIES ─────────────────────────────── */}
      <section className="bg-[#0d0d0d] border-y border-gray-800 py-6">
        <div className="max-w-7xl mx-auto px-4 md:px-6">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5 lg:divide-x lg:divide-gray-800">
            {SPORTS.map(sport => (
              <Link
                key={sport.id}
                to={`/sports`}
                className="flex min-w-0 flex-col items-center gap-2 rounded-lg py-4 px-2 hover:bg-gray-800/50 transition group lg:rounded-none"
              >
                <span className="text-2xl md:text-3xl">{sport.icon}</span>
                <span className="text-xs md:text-sm font-semibold text-gray-300 group-hover:text-lime-400 transition text-center">
                  {sport.name}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── STATS ─────────────────────────────────────────── */}
      <section className="py-16 bg-charcoal">
        <div className="max-w-7xl mx-auto px-4 md:px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {SITE.stats.map(stat => (
              <div key={stat.label} className="text-center">
                <div className="text-3xl md:text-4xl font-black text-lime-500 mb-1">{stat.value}</div>
                <div className="text-gray-400 text-sm font-medium uppercase tracking-wide">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURED FACILITIES ───────────────────────────── */}
      <section className="py-20 bg-[#0d0d0d]">
        <div className="max-w-7xl mx-auto px-4 md:px-6">
          <div className="flex items-end justify-between mb-10">
            <div>
              <p className="text-lime-500 text-sm font-bold uppercase tracking-widest mb-2">Our Facilities</p>
              <h2 className="text-3xl md:text-4xl font-black text-white">
                World-Class<br />Sports Arenas
              </h2>
              <p className="text-gray-400 mt-3 max-w-sm text-sm">
                Modern infrastructure, premium turf and the best playing experience.
              </p>
            </div>
            <Link
              to="/sports"
              className="hidden md:flex items-center gap-2 text-lime-500 font-semibold hover:text-lime-400 border border-lime-500/30 hover:border-lime-500 px-4 py-2 rounded-md transition text-sm"
            >
              View All Facilities <ArrowRight size={16} />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {featured.map(fac => (
              <FacilityCard key={fac.id} facility={fac} />
            ))}
          </div>

          <div className="mt-8 md:hidden text-center">
            <Link
              to="/sports"
              className="inline-flex items-center gap-2 text-lime-500 font-semibold border border-lime-500/30 px-6 py-2.5 rounded-md"
            >
              View All Facilities <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>

      {/* ── PRICING PREVIEW ───────────────────────────────── */}
      <section className="py-20 bg-charcoal">
        <div className="max-w-7xl mx-auto px-4 md:px-6">
          <div className="text-center mb-12">
            <p className="text-lime-500 text-sm font-bold uppercase tracking-widest mb-2">Pricing</p>
            <h2 className="text-3xl md:text-4xl font-black text-white">Transparent Pricing</h2>
            <p className="text-gray-400 mt-3 max-w-xl mx-auto text-sm">
              No hidden charges. What you see is what you pay.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {facilities.slice(0, 3).map(fac => (
              <div key={fac.id} className="bg-card rounded-xl border border-gray-800 p-5 hover:border-lime-500/40 transition">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-lime-500/10 rounded-lg flex items-center justify-center">
                    <span className="text-xl">
                      {SPORTS.find(s => s.id === fac.category)?.icon ?? '🏟️'}
                    </span>
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-sm">{fac.name}</h3>
                    <p className="text-gray-500 text-xs capitalize">{fac.category.replace('-', ' ')}</p>
                  </div>
                </div>
                <div className="space-y-2 text-sm">
                  {(() => {
                    const pricing = { basePrice: fac.pricePerHour, peakPrice: fac.peakPricePerHour }
                    return <>
                  <div className="flex justify-between text-gray-300">
                    <span>Off-Peak ({formatHour(6)} – {formatHour(pricingRules.peakHoursStart)})</span>
                    <span className="font-semibold text-white">{formatCurrency(pricing.basePrice)}/hr</span>
                  </div>
                  <div className="flex justify-between text-gray-300">
                    <span>Peak ({formatHour(pricingRules.peakHoursStart)} – {formatHour(pricingRules.peakHoursEnd)})</span>
                    <span className="font-semibold text-lime-400">{formatCurrency(pricing.peakPrice)}/hr</span>
                  </div>
                  <div className="flex justify-between text-gray-300">
                    <span>Advance Required</span>
                    <span className="font-semibold text-white">{pricingRules.advancePercent}%</span>
                  </div>
                    </>
                  })()}
                </div>
                <Link
                  to="/booking"
                  state={{ facilityId: fac.id }}
                  className="mt-4 block w-full text-center bg-lime-500 hover:bg-lime-400 text-black font-bold text-sm py-2.5 rounded-md transition"
                >
                  Book Now
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── WHY CHOOSE ────────────────────────────────────── */}
      <section className="py-20 bg-[#0d0d0d]">
        <div className="max-w-7xl mx-auto px-4 md:px-6">
          <div className="text-center mb-12">
            <p className="text-lime-500 text-sm font-bold uppercase tracking-widest mb-2">Why Us</p>
            <h2 className="text-3xl md:text-4xl font-black text-white">Why Choose {SITE.name}?</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
            {WHY_CHOOSE.map(w => (
              <div
                key={w.title}
                className="bg-card rounded-xl border border-gray-800 p-5 hover:border-lime-500/40 transition group"
              >
                <div className="text-3xl mb-3">{w.icon}</div>
                <h3 className="font-bold text-white mb-2 group-hover:text-lime-400 transition">{w.title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{w.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── GALLERY ───────────────────────────────────────── */}
      <section className="py-20 bg-charcoal">
        <div className="max-w-7xl mx-auto px-4 md:px-6">
          <div className="text-center mb-10">
            <p className="text-lime-500 text-sm font-bold uppercase tracking-widest mb-2">Gallery</p>
            <h2 className="text-3xl md:text-4xl font-black text-white">Our Facilities</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {facilities.flatMap(f => f.images).slice(0, 8).map((src, i) => (
              <div key={i} className="overflow-hidden rounded-xl aspect-square group">
                <img
                  src={src}
                  alt={`Gallery ${i + 1}`}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                  loading="lazy"
                  onError={e => {
                    (e.target as HTMLImageElement).src = `https://images.unsplash.com/photo-1529900748604-07564a03e7a6?w=400&q=80`
                  }}
                />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TESTIMONIALS ──────────────────────────────────── */}
      <section className="py-20 bg-[#0d0d0d]">
        <div className="max-w-7xl mx-auto px-4 md:px-6">
          <div className="text-center mb-12">
            <p className="text-lime-500 text-sm font-bold uppercase tracking-widest mb-2">Reviews</p>
            <h2 className="text-3xl md:text-4xl font-black text-white">What Our Players Say</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {TESTIMONIALS.map(t => (
              <blockquote
                key={t.id}
                className="bg-card rounded-xl border border-gray-800 p-5 hover:border-lime-500/30 transition"
              >
                {/* Stars */}
                <div className="flex gap-0.5 mb-3">
                  {[...Array(t.rating)].map((_, i) => (
                    <Star key={i} size={14} className="text-lime-500 fill-lime-500" />
                  ))}
                </div>
                <p className="text-gray-300 text-sm leading-relaxed mb-4 italic">"{t.comment}"</p>
                <footer className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-lime-500/20 flex items-center justify-center text-lime-400 font-bold text-sm">
                    {t.avatar}
                  </div>
                  <div>
                    <div className="font-semibold text-white text-sm">{t.name}</div>
                    <div className="text-gray-500 text-xs">{t.sport}</div>
                  </div>
                </footer>
              </blockquote>
            ))}
          </div>
        </div>
      </section>

      {/* ── LOCATION / CTA ────────────────────────────────── */}
      <section className="py-20 bg-charcoal">
        <div className="max-w-7xl mx-auto px-4 md:px-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
            <div>
              <p className="text-lime-500 text-sm font-bold uppercase tracking-widest mb-2">Location</p>
              <h2 className="text-3xl md:text-4xl font-black text-white mb-4">Find Us Here</h2>
              <p className="text-gray-400 text-sm mb-6">{SITE.contact.address}</p>
              <div className="space-y-3 text-sm text-gray-300 mb-6">
                <p>📞 {SITE.contact.phone}</p>
                <p>📧 {SITE.contact.email}</p>
                <p>🕐 Daily: {SITE.openingHours.weekday.open} – {SITE.openingHours.weekday.close}</p>
              </div>
              <div className="flex gap-3">
                <Link
                  to="/booking"
                  className="inline-flex items-center gap-2 bg-lime-500 hover:bg-lime-400 text-black font-bold px-6 py-3 rounded-md transition text-sm"
                >
                  Book Now <ArrowRight size={16} />
                </Link>
                <Link
                  to="/contact"
                  className="inline-flex items-center gap-2 border border-gray-600 hover:border-lime-500 text-gray-300 hover:text-lime-400 font-semibold px-6 py-3 rounded-md transition text-sm"
                >
                  Contact Us
                </Link>
              </div>
            </div>
            {/* Map embed */}
            <div className="rounded-xl overflow-hidden border border-gray-800 h-72">
              <iframe
                src={SITE.contact.mapEmbed}
                width="100%"
                height="100%"
                style={{ border: 0, filter: 'invert(0.9) hue-rotate(180deg)' }}
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                title="ARENA X Location"
              />
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

