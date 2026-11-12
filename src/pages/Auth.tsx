import { FormEvent, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { requireSupabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

export default function Auth() {
  const [params] = useSearchParams(); const navigate = useNavigate(); const { user } = useAuth()
  const location = useLocation()
  const returnState = location.state as { returnTo?: string; bookingData?: unknown } | null
  const returnTo = returnState?.returnTo ?? '/booking'
  const returnBookingData = returnState?.bookingData
  const [register, setRegister] = useState(params.get('mode') === 'register')
  const [name, setName] = useState(''); const [phone, setPhone] = useState(''); const [email, setEmail] = useState(''); const [password, setPassword] = useState('')
  const [message, setMessage] = useState(''); const [error, setError] = useState(''); const [busy, setBusy] = useState(false)
  if (user) return <main className="pt-28 min-h-screen text-center text-white"><p>You are signed in.</p><Link className="text-lime-400" to="/">Return home</Link></main>
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError(''); setMessage('')
    try {
      const client = requireSupabase()
      if (register) {
        const { data, error } = await client.auth.signUp({ email, password, options: { data: { full_name: name, phone } } })
        if (error) throw error
        if (data.session) navigate(returnTo, { state: returnBookingData ? { bookingData: returnBookingData } : undefined })
        else setMessage('Check your email to confirm your account, then sign in.')
      } else {
        const { error } = await client.auth.signInWithPassword({ email, password }); if (error) throw error
        navigate(returnTo, { state: returnBookingData ? { bookingData: returnBookingData } : undefined })
      }
    } catch (e) { setError(e instanceof Error ? e.message : 'Authentication failed.') }
    finally { setBusy(false) }
  }
  return <main className="min-h-screen px-4 pb-16 pt-24 sm:pt-28"><section className="mx-auto max-w-md rounded-xl border border-gray-800 bg-card p-5 sm:p-7">
    <p className="text-xs font-bold uppercase tracking-widest text-lime-400">ARENA X account</p><h1 className="mt-2 mb-6 text-2xl font-black text-white sm:text-3xl">{register ? 'Create account' : 'Welcome back'}</h1>
    <form onSubmit={submit} className="space-y-4">
      {register && <><label className="block text-sm text-gray-300">Full name<input required value={name} onChange={e=>setName(e.target.value)} className="mt-1 w-full rounded bg-gray-800 border border-gray-700 px-3 py-2 text-white" /></label><label className="block text-sm text-gray-300">Phone<input required value={phone} onChange={e=>setPhone(e.target.value)} className="mt-1 w-full rounded bg-gray-800 border border-gray-700 px-3 py-2 text-white" /></label></>}
      <label className="block text-sm text-gray-300">Email<input required type="email" value={email} onChange={e=>setEmail(e.target.value)} className="mt-1 w-full rounded bg-gray-800 border border-gray-700 px-3 py-2 text-white" /></label>
      <label className="block text-sm text-gray-300">Password<input required minLength={8} type="password" value={password} onChange={e=>setPassword(e.target.value)} className="mt-1 w-full rounded bg-gray-800 border border-gray-700 px-3 py-2 text-white" /></label>
      {error && <p role="alert" className="text-red-400 text-sm">{error}</p>}{message && <p className="text-lime-400 text-sm">{message}</p>}
      <button disabled={busy} className="w-full bg-lime-500 text-black rounded py-3 font-bold disabled:opacity-50">{busy ? 'Please wait…' : register ? 'Create account' : 'Sign in'}</button>
    </form><button onClick={()=>{setRegister(!register);setError('');setMessage('')}} className="mt-5 text-sm text-gray-400 hover:text-lime-400">{register ? 'Already registered? Sign in' : 'New to ARENA X? Create an account'}</button>
  </section></main>
}
