import { useAuthContext } from '@/lib/AuthContext'
import type { Role } from '@/types'

export function useRole() {
  const { profile } = useAuthContext()
  const role = profile?.role as Role | undefined

  const isStaff        = () => role === 'staff'
  const isSupervisor   = () => role === 'supervisor'
  const isGM           = () => role === 'gm'
  const isHR           = () => role === 'hr'
  const isAdmin        = () => role === 'system_admin'

  const canCreateIssue          = () => isStaff() || isSupervisor() || isAdmin()
  const canEscalate             = () => isSupervisor() || isAdmin()
  const canPostSupervisorUpdate = () => isSupervisor() || isAdmin()
  const canPostHRUpdate         = () => isHR() || isAdmin()
  const canPostGMUpdate         = () => isGM() || isAdmin()
  const canViewGMUpdates        = () => isSupervisor() || isHR() || isAdmin()
  const canViewSupervisorFeed   = () => isSupervisor() || isGM() || isHR() || isAdmin()
  const canViewHRUpdates        = () => isSupervisor() || isGM() || isHR() || isAdmin()
  const canViewEscalatedIssues  = () => isGM() || isAdmin()
  const canManageTeamIssues     = () => isSupervisor() || isAdmin()
  const canAccessAdminPanel     = () => isAdmin()

  const canUpdateIssueStatus = (authorId: string) =>
    profile?.id === authorId || isSupervisor() || isAdmin()

  const canViewRawStaffIssues = () => isStaff() || isSupervisor() || isAdmin()

  const getDashboardType = (): 'staff' | 'supervisor' | 'gm' | 'hr' | 'admin' => {
    if (isStaff())      return 'staff'
    if (isSupervisor()) return 'supervisor'
    if (isGM())         return 'gm'
    if (isHR())         return 'hr'
    if (isAdmin())      return 'admin'
    return 'staff'
  }

  return {
    role,
    profile,
    isStaff,
    isSupervisor,
    isGM,
    isHR,
    isAdmin,
    canCreateIssue,
    canEscalate,
    canPostSupervisorUpdate,
    canPostHRUpdate,
    canPostGMUpdate,
    canViewGMUpdates,
    canViewSupervisorFeed,
    canViewHRUpdates,
    canViewEscalatedIssues,
    canManageTeamIssues,
    canAccessAdminPanel,
    canUpdateIssueStatus,
    canViewRawStaffIssues,
    getDashboardType,
  }
}
