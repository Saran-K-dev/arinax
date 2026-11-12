import { Outlet, NavLink, Link, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import {
  LayoutDashboard,
  CalendarCheck,
  Clock,
  DollarSign,
  Building2,
  CreditCard,
  Menu,
  X,
  ArrowLeft,
} from 'lucide-react'
import { SITE } from '../config/site'
import { useAuth } from '../contexts/AuthContext'

const navItems = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/admin/bookings', label: 'Bookings', icon: CalendarCheck },
  { to: '/admin/slots', label: 'Slot Management', icon: Clock },
  { to: '/admin/pricing', label: 'Pricing', icon: DollarSign },
  { to: '/admin/facilities', label: 'Facilities', icon: Building2 },
  { to: '/admin/payments', label: 'Payments', icon: CreditCard },
]

export default function AdminLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { signOut } = useAuth()

  return (
    <div className="min-h-screen bg-[#0d0d0d] text-white flex">
      {/* Sidebar */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-50 w-64 bg-[#141414] border-r border-gray-800
          transform transition-transform duration-300
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          md:translate-x-0 md:static md:flex md:flex-col
        `}
      >
        {/* Logo */}
        <div className="flex items-center justify-between p-5 border-b border-gray-800">
          <Link to="/" className="flex items-center gap-2">
            <span className="text-xl font-black text-lime-500">{SITE.name}</span>
            <span className="text-xs text-gray-500 font-medium">Admin</span>
          </Link>
          <button
            className="md:hidden text-gray-400 hover:text-white"
            onClick={() => setSidebarOpen(false)}
          >
            <X size={20} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/admin'}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all
                ${
                  isActive
                    ? 'bg-lime-500 text-black'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800'
                }`
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Back to site */}
        <div className="p-4 border-t border-gray-800">
          <button onClick={() => void signOut()} className="flex items-center gap-2 text-sm text-gray-400 hover:text-lime-400 transition mb-3">Sign out</button>
          <Link
            to="/"
            className="flex items-center gap-2 text-sm text-gray-400 hover:text-lime-400 transition"
          >
            <ArrowLeft size={16} />
            Back to Website
          </Link>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile topbar */}
        <div className="md:hidden flex items-center gap-3 px-4 py-3 bg-[#141414] border-b border-gray-800">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-gray-400 hover:text-white"
          >
            <Menu size={22} />
          </button>
          <span className="font-bold text-lime-500">{SITE.name} Admin</span>
        </div>

        {/* Page content */}
        <main className="flex-1 overflow-auto p-4 md:p-8">
          <Outlet />
        </main>
      </div>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  )
}

