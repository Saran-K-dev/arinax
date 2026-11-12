import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { Session, User } from '@supabase/supabase-js'
import { requireSupabase, supabase } from '../lib/supabase'

type AuthState = { session: Session | null; user: User | null; isAdmin: boolean; loading: boolean; signOut: () => Promise<void> }
const AuthContext = createContext<AuthState>({ session: null, user: null, isAdmin: false, loading: true, signOut: async () => {} })

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    if (!supabase) { setLoading(false); return }
    let active = true
    let requestId = 0
    const refresh = async (next: Session | null) => {
      const currentRequest = ++requestId
      setSession(next)
      if (!next?.user) {
        if (active && currentRequest === requestId) { setIsAdmin(false); setLoading(false) }
        return
      }
      setLoading(true)
      try {
        // Ask Supabase using the current authenticated JWT. Never infer admin
        // access from browser metadata or a locally stored role.
        const { data, error } = await requireSupabase().rpc('is_admin')
        if (active && currentRequest === requestId) setIsAdmin(!error && data === true)
      } catch {
        if (active && currentRequest === requestId) setIsAdmin(false)
      } finally {
        if (active && currentRequest === requestId) setLoading(false)
      }
    }

    // Do not call another Supabase operation inside onAuthStateChange: the
    // client can still hold its auth lock while invoking that callback.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next)
      setIsAdmin(false)
      setLoading(true)
      window.setTimeout(() => { if (active) void refresh(next) }, 0)
    })
    void supabase.auth.getSession().then(({ data, error }) => {
      if (error) { if (active) setLoading(false); return }
      if (active) void refresh(data.session)
    }).catch(() => { if (active) setLoading(false) })
    return () => { active = false; subscription.unsubscribe() }
  }, [])
  const value = { session, user: session?.user ?? null, isAdmin, loading, signOut: async () => {
    const { error } = await requireSupabase().auth.signOut(); if (error) throw error
  } }
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
export const useAuth = () => useContext(AuthContext)
