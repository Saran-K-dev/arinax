import { Link } from 'react-router-dom'
import { Phone, Mail, MapPin, Instagram, Youtube, Twitter, Facebook } from 'lucide-react'
import { SITE, SPORTS } from '../config/site'

export default function Footer() {
  return (
    <footer className="bg-[#0d0d0d] border-t border-gray-800 mt-auto">
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-9 h-9 bg-lime-500 rounded-md flex items-center justify-center">
                <span className="text-black font-black text-sm">AX</span>
              </div>
              <div>
                <div className="text-white font-black text-lg leading-none">{SITE.name}</div>
                <div className="text-lime-500 text-[9px] font-medium tracking-widest">{SITE.tagline}</div>
              </div>
            </div>
            <p className="text-gray-400 text-sm leading-relaxed mb-4">
              Premium sports turf booking platform. Book your favourite sports venue instantly.
            </p>
            <div className="flex gap-3">
              {[
                { icon: Facebook, href: SITE.social.facebook },
                { icon: Instagram, href: SITE.social.instagram },
                { icon: Twitter, href: SITE.social.twitter },
                { icon: Youtube, href: SITE.social.youtube },
              ].map(({ icon: Icon, href }) => (
                <a
                  key={href}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-8 h-8 rounded-md bg-gray-800 flex items-center justify-center text-gray-400 hover:bg-lime-500 hover:text-black transition-all"
                >
                  <Icon size={15} />
                </a>
              ))}
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="font-bold text-white mb-4">Quick Links</h4>
            <ul className="space-y-2">
              {[
                { to: '/', label: 'Home' },
                { to: '/sports', label: 'Sports & Facilities' },
                { to: '/booking', label: 'Book a Slot' },
                { to: '/about', label: 'About Us' },
                { to: '/contact', label: 'Contact' },
                { to: '/admin', label: 'Admin' },
              ].map(l => (
                <li key={l.to}>
                  <Link
                    to={l.to}
                    className="text-gray-400 hover:text-lime-400 text-sm transition"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Sports */}
          <div>
            <h4 className="font-bold text-white mb-4">Our Sports</h4>
            <ul className="space-y-2">
              {SPORTS.map(s => (
                <li key={s.id}>
                  <Link
                    to="/sports"
                    className="text-gray-400 hover:text-lime-400 text-sm transition"
                  >
                    {s.icon} {s.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="font-bold text-white mb-4">Contact Us</h4>
            <ul className="space-y-3">
              <li className="flex gap-2 text-sm text-gray-400">
                <Phone size={15} className="text-lime-500 shrink-0 mt-0.5" />
                <div>
                  <p>{SITE.contact.phone}</p>
                  <p className="text-xs text-gray-500">WhatsApp available</p>
                </div>
              </li>
              <li className="flex gap-2 text-sm text-gray-400">
                <Mail size={15} className="text-lime-500 shrink-0 mt-0.5" />
                {SITE.contact.email}
              </li>
              <li className="flex gap-2 text-sm text-gray-400">
                <MapPin size={15} className="text-lime-500 shrink-0 mt-0.5" />
                {SITE.contact.address}
              </li>
            </ul>
            <div className="mt-4 text-xs text-gray-500">
              <p>Open daily: {SITE.openingHours.weekday.open} – {SITE.openingHours.weekday.close}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-gray-800 py-4 px-4 md:px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-2 text-xs text-gray-500">
          <p>© {new Date().getFullYear()} {SITE.name}. All rights reserved.</p>
          <div className="flex gap-4">
            <Link to="/about" className="hover:text-gray-300 transition">Privacy Policy</Link>
            <Link to="/about" className="hover:text-gray-300 transition">Terms & Conditions</Link>
          </div>
        </div>
      </div>
    </footer>
  )
}

