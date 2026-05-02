/* eslint-disable react-refresh/only-export-components */
import { useState, useEffect, createContext, useContext, type ReactNode } from 'react'
import { supabase } from '@/lib/supabase'
import { logSecurityEvent } from '@/lib/security'
import type { Profile } from '@/types'

interface AuthContextValue {
  profile: Profile | null
  userEmail: string | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        // A09: log failure without leaking credentials
        logSecurityEvent('login_failed', error.code ?? 'auth_error')
        // A02: return generic message — don't reveal whether email exists
        const msg =
          error.message.toLowerCase().includes('invalid')
            ? 'Invalid email or password.'
            : 'Unable to sign in. Please try again.'
        return { error: msg }
      }
      logSecurityEvent('login_success')
      return { error: null }
    } catch (e) {
      return { error: e instanceof Error ? e.message : 'Unable to reach the server.' }
    }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    setProfile(null)
    setUserEmail(null)
  }

  const refreshProfile = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) return
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single()
    if (data && !error) setProfile(data as Profile)
  }

  useEffect(() => {
    let cancelled = false

    // A01/A07: Load profile and enforce is_active check
    const loadProfile = async (session: { user?: { id: string; email?: string } } | null) => {
      if (!session?.user) {
        if (!cancelled) {
          setProfile(null)
          setUserEmail(null)
          setLoading(false)
        }
        return
      }

      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single()

        if (cancelled) return

        if (data && !error) {
          const p = data as Profile

          // A01: Deactivated accounts are signed out immediately
          if (!p.is_active) {
            logSecurityEvent('inactive_account_blocked', session.user.email)
            await supabase.auth.signOut()
            setProfile(null)
            setUserEmail(null)
          } else {
            setProfile(p)
            setUserEmail(session.user.email ?? null)
          }
        } else {
          setProfile(null)
          setUserEmail(null)
        }
      } catch (err) {
        console.error('Error fetching profile:', err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        console.error('Session error:', error)
        if (!cancelled) setLoading(false)
        return
      }
      loadProfile(session)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'INITIAL_SESSION') return
      if (event === 'TOKEN_REFRESHED') return

      if (event === 'SIGNED_OUT') {
        logSecurityEvent('session_expired')
      }

      // Set loading=true synchronously so ProtectedRoute shows a spinner
      // instead of redirecting while loadProfile is still in flight.
      // Without this, navigating to /dashboard after sign-in hits ProtectedRoute
      // with profile=null (not yet loaded) and gets bounced back to /login.
      if (!cancelled) setLoading(true)

      loadProfile(session)
    })

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [])

  return (
    <AuthContext.Provider value={{ profile, userEmail, loading, signIn, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuthContext() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuthContext must be used within AuthProvider')
  return ctx
}
