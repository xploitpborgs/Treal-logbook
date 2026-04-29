import type { ReactNode } from 'react'
import { Navigate } from '@tanstack/react-router'
import { useAuthContext } from '@/lib/AuthContext'
import { logSecurityEvent } from '@/lib/security'
import { FullScreenSpinner } from '@/components/auth/Spinner'

// A01: Guards every authenticated route.
// Inactive accounts are already signed out in AuthContext; this is the
// last-resort UI gate in case the profile arrives before the sign-out resolves.
export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { profile, loading } = useAuthContext()

  if (loading) return <FullScreenSpinner />

  if (!profile) {
    return <Navigate to="/login" />
  }

  if (!profile.is_active) {
    logSecurityEvent('inactive_account_blocked', profile.id)
    return <Navigate to="/login" />
  }

  return <>{children}</>
}
