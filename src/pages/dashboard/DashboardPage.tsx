import { useAuthContext } from '@/lib/AuthContext'
import { StaffDashboard } from './StaffDashboard'
import { SupervisorDashboard } from './SupervisorDashboard'
import { GMDashboard } from './GMDashboard'
import { HrDashboard } from './HrDashboard'
import { SystemAdminDashboard } from './SystemAdminDashboard'
import { Loader2 } from 'lucide-react'

export function DashboardPage() {
  const { profile, loading } = useAuthContext()

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
      </div>
    )
  }

  if (!profile) return null

  switch (profile.role) {
    case 'staff':
      return <StaffDashboard />
    case 'supervisor':
      return <SupervisorDashboard />
    case 'gm':
      return <GMDashboard />
    case 'hr':
      return <HrDashboard />
    case 'system_admin':
      return <SystemAdminDashboard />
    default:
      return <div>Unknown role</div>
  }
}
