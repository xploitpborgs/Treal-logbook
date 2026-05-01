import { Navigate } from '@tanstack/react-router'
import { useAuthContext } from '@/lib/AuthContext'
import { useRole } from '@/hooks/useRole'
import { supabase } from '@/lib/supabase'
import { FullPageSpinner } from '@/components/ui/FullPageSpinner'
import { UserX } from 'lucide-react'
import type { Role } from '@/types'

interface RoleGuardProps {
  children: React.ReactNode
  allowedRoles: Role[]
  redirectTo?: string
}

export function RoleGuard({
  children,
  allowedRoles,
  redirectTo = '/dashboard',
}: RoleGuardProps) {
  const { profile, loading } = useAuthContext()
  const { role } = useRole()

  if (loading) return <FullPageSpinner />

  if (!profile) return <Navigate to="/login" />

  // Deactivated account screen
  if (profile.is_active === false) {
    return (
      <div className="flex h-screen items-center justify-center bg-white">
        <div className="text-center max-w-sm px-6">
          <div className="w-12 h-12 rounded-full bg-zinc-100 flex items-center justify-center mx-auto mb-4">
            <UserX className="w-6 h-6 text-zinc-400" />
          </div>
          <h2 className="text-lg font-medium text-zinc-900 mb-2">Account Deactivated</h2>
          <p className="text-sm text-zinc-500 mb-6">
            Your account has been deactivated. Please contact your system administrator.
          </p>
          <button
            onClick={() => supabase.auth.signOut()}
            className="text-sm text-[#C41E3A] hover:underline"
          >
            Sign out
          </button>
        </div>
      </div>
    )
  }

  if (role && !allowedRoles.includes(role)) {
    return <Navigate to={redirectTo} />
  }

  return <>{children}</>
}
