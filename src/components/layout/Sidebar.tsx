import { useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import {
  ChevronLeft,
  ChevronRight,
  LayoutDashboard,
  LogOut,
  Megaphone,
  MessageSquarePlus,
  PlusCircle,
  Settings,
} from 'lucide-react'
import { Link, useRouterState } from '@tanstack/react-router'
import { useNavigate } from '@tanstack/react-router'
import { useAuthContext } from '@/lib/AuthContext'
import { useRole } from '@/hooks/useRole'
import { cn } from '@/lib/utils'
import { formatDepartment, formatRole, getInitials } from '@/lib/formatters'
import { Badge } from '@/components/ui/badge'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

// ─── Types ─────────────────────────────────────────────────────────────────

interface NavItem {
  label: string
  icon: LucideIcon
  to: string
}

// ─── Role badge colors (dark sidebar bg) ───────────────────────────────────

const ROLE_BADGE_DARK: Record<string, string> = {
  staff:        'bg-zinc-700 text-zinc-300',
  supervisor:   'bg-blue-500/20 text-blue-400',
  gm:           'bg-amber-500/20 text-amber-400',
  hr:           'bg-purple-500/20 text-purple-400',
  system_admin: 'bg-[#C41E3A]/20 text-[#C41E3A]',
}

// ─── Single nav link ────────────────────────────────────────────────────────

function NavLink({
  item,
  isCollapsed,
  onClick,
}: {
  item: NavItem
  isCollapsed: boolean
  onClick?: () => void
}) {
  const { location } = useRouterState()
  const isActive =
    location.pathname === item.to ||
    (item.to !== '/dashboard' && location.pathname.startsWith(item.to))

  return (
    <Link
      to={item.to}
      onClick={onClick}
      className={cn(
        'relative flex w-full transition-colors duration-150',
        isActive
          ? 'bg-[#C41E3A]/10 text-[#C41E3A]'
          : 'text-zinc-400 hover:bg-zinc-800 hover:text-white',
      )}
    >
      {isActive && (
        <span className="absolute inset-y-0 left-0 w-0.5 rounded-r-full bg-[#C41E3A]" />
      )}
      <div
        className={cn(
          'flex w-full items-center',
          isCollapsed ? 'justify-center py-3' : 'gap-3 px-4 py-2.5',
        )}
      >
        <item.icon size={18} className="shrink-0" />
        {!isCollapsed && (
          <span className="truncate text-sm font-medium">{item.label}</span>
        )}
      </div>
    </Link>
  )
}

// ─── Sidebar ────────────────────────────────────────────────────────────────

interface SidebarProps {
  isCollapsed: boolean
  onToggle: () => void
  isMobile?: boolean
  onNavigate?: () => void
}

export function Sidebar({ isCollapsed, onToggle, isMobile = false, onNavigate }: SidebarProps) {
  const { signOut } = useAuthContext()
  const navigate = useNavigate()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const { profile, canCreateIssue, canPostSupervisorUpdate, canPostHRUpdate, canPostGMUpdate, canAccessAdminPanel } = useRole()

  const handleSignOut = async () => {
    await signOut()
    await navigate({ to: '/login' })
  }

  const navItems: NavItem[] = [
    { label: 'Dashboard',      icon: LayoutDashboard,   to: '/dashboard' },
  ]
  if (canCreateIssue())          navItems.push({ label: 'New Issue',       icon: PlusCircle,        to: '/issues/new' })
  if (canPostSupervisorUpdate()) navItems.push({ label: 'Post Update',     icon: MessageSquarePlus, to: '/supervisor-update/new' })
  if (canPostGMUpdate())         navItems.push({ label: 'Post GM Update',  icon: Megaphone,         to: '/gm-update/new' })
  if (canPostHRUpdate())         navItems.push({ label: 'Post HR Update',  icon: Megaphone,         to: '/hr-update/new' })
  if (canAccessAdminPanel())     navItems.push({ label: 'Admin Panel',     icon: Settings,          to: '/admin' })

  const initials  = getInitials(profile?.full_name ?? '')
  const roleBadge = ROLE_BADGE_DARK[profile?.role ?? ''] ?? 'bg-zinc-700 text-zinc-300'

  return (
    <div className="relative flex h-full flex-col" style={{ backgroundColor: '#0a0a0a' }}>

      {/* ── Toggle (desktop only) ── */}
      {!isMobile && (
        <button
          onClick={onToggle}
          aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="absolute -right-3 top-5 z-50 flex h-6 w-6 items-center justify-center rounded-full border border-zinc-700 bg-zinc-900 text-zinc-400 transition-colors hover:text-white"
        >
          {isCollapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
        </button>
      )}

      {/* ── Logo ── */}
      <div
        className={cn(
          'flex h-16 shrink-0 items-center border-b border-zinc-800',
          isCollapsed ? 'justify-center px-2' : 'gap-2.5 px-5',
        )}
      >
        <img src="/treal-icon.png" alt="Treal" className="h-8 w-8 shrink-0" />
        {!isCollapsed && (
          <span className="text-sm font-semibold tracking-widest text-white">TREAL</span>
        )}
      </div>

      {/* ── Nav ── */}
      <nav className="flex-1 overflow-y-auto py-4">
        {navItems.map(item => (
          <NavLink key={item.to} item={item} isCollapsed={isCollapsed} onClick={onNavigate} />
        ))}
      </nav>

      {/* ── User section ── */}
      <div className="shrink-0 border-t border-zinc-800 p-3">
        {isCollapsed ? (
          <div className="flex flex-col items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#C41E3A] text-xs font-semibold text-white">
              {initials}
            </div>
            <button
              aria-label="Sign out"
              onClick={() => setConfirmOpen(true)}
              className="rounded p-1 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white"
            >
              <LogOut size={14} />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#C41E3A] text-xs font-semibold text-white">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-white">{profile?.full_name}</p>
              <Badge className={cn('mt-0.5 h-4 px-1.5 text-[10px] border-0 shadow-none', roleBadge)}>
                {formatRole(profile?.role ?? '')}
              </Badge>
              <p className="truncate text-xs text-zinc-500 mt-0.5">
                {formatDepartment(profile?.department ?? '')}
              </p>
            </div>
            <button
              aria-label="Sign out"
              onClick={() => setConfirmOpen(true)}
              className="shrink-0 rounded p-1 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white"
            >
              <LogOut size={14} />
            </button>
          </div>
        )}
      </div>

      {/* ── Sign-out confirmation ── */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sign out?</AlertDialogTitle>
            <AlertDialogDescription>You will be returned to the login screen.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleSignOut} className="bg-[#C41E3A] text-white hover:bg-[#a31e22]">
              Sign Out
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
