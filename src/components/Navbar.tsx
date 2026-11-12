import { useState, useEffect } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { Menu, X, Phone } from 'lucide-react'
import { SITE } from '../config/site'
import { useAuth } from '../contexts/AuthContext'

const links = [
  { to: '/', label: 'Home' },
  { to: '/sports', label: 'Sports' },
  { to: '/sports', label: 'Facilities' },
  { to: '/about', label: 'About' },
  { to: '/contact', label: 'Contact' },
]

export default function Navbar() {
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const { pathname } = useLocation()
  const { user, signOut } = useAuth()

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    setOpen(false)
  }, [pathname])

  return (
    <header
      className={`fixed top-0 inset-x-0 z-40 transition-all duration-300 ${
        scrolled ? 'bg-black/95 backdrop-blur-md shadow-lg shadow-black/40' : 'bg-black/70 backdrop-blur-sm'
      }`}
    >
      <nav className="max-w-7xl mx-auto px-4 md:px-6 flex items-center justify-between h-16">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 group">
          <div className="w-8 h-8 bg-lime-500 rounded-md flex items-center justify-center">
            <span className="text-black font-black text-sm">AX</span>
          </div>
          <div>
            <div className="text-white font-black text-lg leading-none tracking-wide">{SITE.name}</div>
            <div className="text-lime-500 text-[9px] font-medium tracking-widest leading-none">{SITE.tagline}</div>
          </div>
        </Link>

        {/* Desktop nav */}
        <ul className="hidden md:flex items-center gap-6">
          {links.map(l => (
            <li key={`${l.to}-${l.label}`}>
              <NavLink
                to={l.to}
                end={l.to === '/'}
                className={({ isActive }) =>
                  `text-sm font-medium transition-colors hover:text-lime-400 ${
                    isActive ? 'text-lime-500' : 'text-gray-300'
                  }`
                }
              >
                {l.label}
              </NavLink>
            </li>
          ))}
        </ul>

        {/* Desktop right */}
        <div className="hidden md:flex items-center gap-4">
          <a
            href={`tel:${SITE.contact.phone}`}
            className="flex items-center gap-1.5 text-sm text-gray-300 hover:text-lime-400 transition"
          >
            <Phone size={14} />
            {SITE.contact.phone}
          </a>
          <Link
            to="/booking"
            className="bg-lime-500 hover:bg-lime-400 text-black font-bold text-sm px-5 py-2 rounded-md transition-all hover:shadow-lg hover:shadow-lime-500/25"
          >
            Book Now →
          </Link>
          {user ? <><Link to="/payments" className="text-sm text-gray-300 hover:text-lime-400">Payment history</Link><button onClick={() => void signOut()} className="text-sm text-gray-300 hover:text-lime-400">Sign out</button></> : <Link to="/auth" className="text-sm text-gray-300 hover:text-lime-400">Sign in</Link>}
        </div>

        {/* Mobile menu button */}
        <button
          onClick={() => setOpen(o => !o)}
          className="md:hidden grid min-h-11 min-w-11 place-items-center rounded-md text-white hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-lime-400"
          aria-label="Toggle menu"
          aria-expanded={open}
          aria-controls="mobile-navigation"
        >
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </nav>

      {/* Mobile drawer */}
      <div
        id="mobile-navigation"
        className={`md:hidden overflow-y-auto transition-[max-height,opacity] duration-300 ${
          open ? 'max-h-[calc(100dvh-4rem)] opacity-100' : 'max-h-0 opacity-0'
        } bg-black/95 border-t border-gray-800`}
      >
        <ul className="px-4 py-4 space-y-1">
          {links.map(l => (
            <li key={`${l.to}-${l.label}`}>
              <NavLink
                to={l.to}
                end={l.to === '/'}
                className={({ isActive }) =>
                  `block py-2.5 px-3 rounded-md text-sm font-medium transition ${
                    isActive ? 'bg-lime-500/10 text-lime-400' : 'text-gray-300 hover:text-white hover:bg-gray-800'
                  }`
                }
              >
                {l.label}
              </NavLink>
            </li>
          ))}
        </ul>
        <div className="px-4 pb-4">
          <Link
            to="/booking"
            className="block w-full text-center bg-lime-500 hover:bg-lime-400 text-black font-bold py-3 rounded-md transition"
          >
            Book Now →
          </Link>
          <div className="flex items-center gap-5 px-4 pb-4">{user ? <><Link to="/payments" className="text-sm text-gray-300">Payment history</Link><button onClick={() => void signOut()} className="text-sm text-gray-300">Sign out</button></> : <Link to="/auth" className="text-sm text-gray-300">Sign in / Register</Link>}</div>
        </div>
      </div>
    </header>
  )
}

