import { lazy, Suspense } from 'react'
import { Routes, Route } from 'react-router-dom'
const MainLayout = lazy(() => import('./layouts/MainLayout'))
const AdminLayout = lazy(() => import('./layouts/AdminLayout'))
const Home = lazy(() => import('./pages/Home'))
const Sports = lazy(() => import('./pages/Sports'))
const TurfDetail = lazy(() => import('./pages/TurfDetail'))
const Booking = lazy(() => import('./pages/Booking'))
const Checkout = lazy(() => import('./pages/Checkout'))
const Confirmation = lazy(() => import('./pages/Confirmation'))
const About = lazy(() => import('./pages/About'))
const Contact = lazy(() => import('./pages/Contact'))
const NotFound = lazy(() => import('./pages/NotFound'))
const Auth = lazy(() => import('./pages/Auth'))
const PaymentHistory = lazy(() => import('./pages/PaymentHistory'))
import { Navigate } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext'

function AdminGate() {
  const { user, isAdmin, loading } = useAuth()
  if (loading) return <div className="p-10 text-center text-gray-400">Checking access…</div>
  if (!user) return <Navigate to="/auth" replace state={{ returnTo: '/admin' }} />
  if (!isAdmin) return <main className="min-h-screen bg-[#0d0d0d] text-white grid place-items-center p-6">
    <section className="max-w-md rounded-xl border border-gray-800 bg-[#141414] p-7 text-center">
      <h1 className="text-xl font-bold">Admin access not enabled</h1>
      <p className="mt-3 text-sm text-gray-400">Signed in as {user.email ?? 'this account'}, but this account is not an administrator yet. Ask the project owner to grant admin access in Supabase, then sign in again.</p>
      <a href="/" className="mt-6 inline-flex rounded bg-lime-500 px-5 py-2.5 font-bold text-black">Return to website</a>
    </section>
  </main>
  return <AdminLayout />
}

const AdminDashboard = lazy(() => import('./pages/admin/Dashboard'))
const AdminBookings = lazy(() => import('./pages/admin/Bookings'))
const AdminSlots = lazy(() => import('./pages/admin/Slots'))
const AdminPricing = lazy(() => import('./pages/admin/Pricing'))
const AdminFacilities = lazy(() => import('./pages/admin/Facilities'))
const AdminPayments = lazy(() => import('./pages/admin/Payments'))

export default function App() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0d0d0d] grid place-items-center text-gray-400" role="status">Loading ARENA X…</div>}>
    <Routes>
      <Route element={<MainLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/sports" element={<Sports />} />
        <Route path="/turf/:id" element={<TurfDetail />} />
        <Route path="/booking" element={<Booking />} />
        <Route path="/checkout" element={<Checkout />} />
        <Route path="/booking-confirmation" element={<Confirmation />} />
        <Route path="/about" element={<About />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/auth" element={<Auth />} />
        <Route path="/payments" element={<PaymentHistory />} />
        <Route path="*" element={<NotFound />} />
      </Route>
      <Route path="/admin" element={<AdminGate />}>
        <Route index element={<AdminDashboard />} />
        <Route path="bookings" element={<AdminBookings />} />
        <Route path="slots" element={<AdminSlots />} />
        <Route path="pricing" element={<AdminPricing />} />
        <Route path="facilities" element={<AdminFacilities />} />
        <Route path="payments" element={<AdminPayments />} />
      </Route>
    </Routes>
    </Suspense>
  )
}

