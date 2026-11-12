import { Link } from 'react-router-dom'
import { ArrowRight, Users, Trophy, MapPin, Clock } from 'lucide-react'
import { SITE } from '../config/site'

export default function About() {
  return (
    <div className="pt-16 min-h-screen">
      {/* Hero */}
      <section className="relative bg-[#0d0d0d] border-b border-gray-800 py-20 px-4 md:px-6 overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <img
            src="https://images.unsplash.com/photo-1529900748604-07564a03e7a6?w=1200&q=60"
            alt=""
            className="w-full h-full object-cover"
          />
        </div>
        <div className="relative max-w-4xl mx-auto text-center">
          <p className="text-lime-500 text-sm font-bold uppercase tracking-widest mb-3">About Us</p>
          <h1 className="text-4xl md:text-6xl font-black text-white mb-6">
            We Are <span className="text-lime-500">{SITE.name}</span>
          </h1>
          <p className="text-gray-300 text-lg max-w-2xl mx-auto leading-relaxed">
            {SITE.name} is a premium sports-turf booking platform built to give every athlete – amateur or professional –
            access to world-class sports facilities at transparent, honest prices.
          </p>
        </div>
      </section>

      {/* Mission */}
      <section className="py-16 px-4 md:px-6 max-w-5xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
          <div>
            <p className="text-lime-500 text-sm font-bold uppercase tracking-widest mb-3">Our Mission</p>
            <h2 className="text-3xl font-black text-white mb-4">Making Sports Accessible to Everyone</h2>
            <p className="text-gray-400 leading-relaxed mb-4">
              We believe sport brings people together. That's why we built {SITE.name} — to remove the
              friction between wanting to play and actually playing. No more phone calls, no more confusion
              about availability. Just open the app, pick a slot, and play.
            </p>
            <p className="text-gray-400 leading-relaxed mb-6">
              Our venues are maintained to the highest standards, our pricing is transparent, and our
              customer support is always available. We are redefining what a sports facility booking
              experience should feel like.
            </p>
            <Link
              to="/booking"
              className="inline-flex items-center gap-2 bg-lime-500 hover:bg-lime-400 text-black font-bold px-6 py-3 rounded-md transition text-sm"
            >
              Book Your First Slot <ArrowRight size={16} />
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {SITE.stats.map(stat => (
              <div key={stat.label} className="bg-card rounded-xl border border-gray-800 p-5 text-center hover:border-lime-500/30 transition">
                <div className="text-3xl font-black text-lime-500 mb-1">{stat.value}</div>
                <div className="text-gray-400 text-xs uppercase tracking-wide">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="bg-[#0d0d0d] border-y border-gray-800 py-16 px-4 md:px-6">
        <div className="max-w-5xl mx-auto text-center mb-10">
          <p className="text-lime-500 text-sm font-bold uppercase tracking-widest mb-3">Our Values</p>
          <h2 className="text-3xl font-black text-white">What We Stand For</h2>
        </div>
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {[
            { icon: Trophy, title: 'Excellence', desc: 'Premium surfaces and facilities maintained to international standards.' },
            { icon: Users, title: 'Community', desc: 'Building a thriving sports community one game at a time.' },
            { icon: Clock, title: 'Convenience', desc: 'Open 17 hours a day, 7 days a week, 365 days a year.' },
            { icon: MapPin, title: 'Accessibility', desc: 'Located centrally with ample parking for everyone.' },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="bg-card rounded-xl border border-gray-800 p-5 text-center hover:border-lime-500/30 transition">
              <div className="w-12 h-12 bg-lime-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Icon size={22} className="text-lime-500" />
              </div>
              <h3 className="font-bold text-white mb-2">{title}</h3>
              <p className="text-gray-400 text-sm leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Cancellation Policy */}
      <section className="py-16 px-4 md:px-6 max-w-3xl mx-auto">
        <h2 className="text-2xl font-black text-white mb-6">Cancellation &amp; Refund Policy</h2>
        <div className="space-y-4 text-sm text-gray-300 bg-card rounded-xl border border-gray-800 p-6">
          {[
            { title: 'Cancellation 24+ hours before slot', policy: 'Full refund of advance payment.' },
            { title: 'Cancellation 12–24 hours before slot', policy: '50% of advance payment refunded.' },
            { title: 'Cancellation less than 12 hours', policy: 'No refund on advance payment.' },
            { title: 'No-show', policy: 'No refund. Balance payment not applicable.' },
          ].map(item => (
            <div key={item.title} className="flex gap-3">
              <span className="text-lime-500 font-bold shrink-0">→</span>
              <div>
                <span className="font-semibold text-white">{item.title}: </span>
                {item.policy}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
