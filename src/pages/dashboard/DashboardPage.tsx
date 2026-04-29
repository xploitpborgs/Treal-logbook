import { useAuthContext } from '@/lib/AuthContext'
import { useRole } from '@/hooks/useRole'
import { StaffDashboard } from './StaffDashboard'
import { SupervisorDashboard } from './SupervisorDashboard'
import { GMDashboard } from './GMDashboard'
import { HrDashboard } from './HrDashboard'
import { SystemAdminDashboard } from './SystemAdminDashboard'
import { Loader2 } from 'lucide-react'

export function DashboardPage() {
  const { loading } = useAuthContext()
  const { profile, getDashboardType } = useRole()

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
      </div>
    )
  }

  if (!profile) return null

  switch (getDashboardType()) {
    case 'staff':      return <StaffDashboard />
    case 'supervisor': return <SupervisorDashboard />
    case 'gm':         return <GMDashboard />
    case 'hr':         return <HrDashboard />
    case 'admin':      return <SystemAdminDashboard />
  }
}
