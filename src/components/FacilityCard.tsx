import { Link } from 'react-router-dom'
import { Star, ArrowRight, MapPin } from 'lucide-react'
import { Facility } from '../types'
import { formatCurrency } from '../utils/helpers'

interface Props {
  facility: Facility
  compact?: boolean
}

export default function FacilityCard({ facility, compact = false }: Props) {
  return (
    <article className="group bg-card rounded-xl overflow-hidden border border-gray-800 hover:border-lime-500/50 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-lime-500/10 flex flex-col">
      {/* Image */}
      <div className="relative overflow-hidden">
        <img
          src={facility.images[0]}
          alt={facility.name}
          className={`w-full object-cover transition-transform duration-500 group-hover:scale-105 ${
            compact ? 'h-40' : 'h-52'
          }`}
          loading="lazy"
          onError={e => {
            (e.target as HTMLImageElement).src = `https://images.unsplash.com/photo-1529900748604-07564a03e7a6?w=800&q=80`
          }}
        />
        {/* Category badge */}
        <div className="absolute top-3 left-3">
          <span className="bg-lime-500 text-black text-xs font-bold px-2 py-1 rounded-md uppercase tracking-wide">
            {facility.category.replace('-', ' ')}
          </span>
        </div>
        {/* Price badge */}
        <div className="absolute top-3 right-3 bg-black/80 backdrop-blur-sm rounded-md px-2 py-1">
          <span className="text-lime-400 font-bold text-sm">
            {formatCurrency(facility.pricePerHour)}<span className="text-gray-400 font-normal text-xs">/hr</span>
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 flex flex-col flex-1">
        {/* Name + rating */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <h3 className="font-bold text-white text-base leading-tight group-hover:text-lime-400 transition">
            {facility.name}
          </h3>
          <div className="flex items-center gap-1 shrink-0">
            <Star size={13} className="text-lime-500 fill-lime-500" />
            <span className="text-sm text-white font-semibold">{facility.rating}</span>
            <span className="text-xs text-gray-500">({facility.reviewCount})</span>
          </div>
        </div>

        {!compact && (
          <p className="text-gray-400 text-sm leading-relaxed mb-3 line-clamp-2">
            {facility.description}
          </p>
        )}

        {/* Location */}
        <div className="flex items-center gap-1 text-xs text-gray-500 mb-3">
          <MapPin size={12} />
          <span>{facility.location}</span>
        </div>

        {/* Amenities */}
        {!compact && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            {facility.amenities.slice(0, 4).map(a => (
              <span
                key={a}
                className="text-xs bg-gray-800 text-gray-300 px-2 py-0.5 rounded-full border border-gray-700"
              >
                {a}
              </span>
            ))}
            {facility.amenities.length > 4 && (
              <span className="text-xs text-gray-500 px-2 py-0.5">
                +{facility.amenities.length - 4} more
              </span>
            )}
          </div>
        )}

        {/* Price row */}
        <div className="flex items-center justify-between mb-4 mt-auto">
          <div>
            <div className="text-lime-500 font-bold text-lg leading-none">
              {formatCurrency(facility.pricePerHour)}
              <span className="text-gray-400 font-normal text-sm">/hr</span>
            </div>
            <div className="text-xs text-gray-500 mt-0.5">
              Peak: {formatCurrency(facility.peakPricePerHour)}/hr
            </div>
          </div>
        </div>

        {/* Buttons */}
        <div className="flex gap-2">
          <Link
            to={`/turf/${facility.id}`}
            className="flex-1 text-center text-sm font-semibold py-2 rounded-md border border-gray-600 text-gray-300 hover:border-lime-500 hover:text-lime-400 transition"
          >
            View Details
          </Link>
          <Link
            to="/booking"
            state={{ facilityId: facility.id }}
            className="flex-1 text-center text-sm font-bold py-2 rounded-md bg-lime-500 text-black hover:bg-lime-400 transition flex items-center justify-center gap-1"
          >
            Book Now <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    </article>
  )
}

