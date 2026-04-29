import { useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  LayoutDashboard,
  LogOut,
  PlusCircle,
  Settings,
  ShieldAlert,
  User,
} from 'lucide-react'
import { Link, useRouterState } from '@tanstack/react-router'
import { useAuthContext } from '@/lib/AuthContext'
import { DEPT_LABELS } from '@/lib/constants'
import { cn, getInitials } from '@/lib/utils'
import { useNavigate } from '@tanstack/react-router'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'

// ─── Nav items config ──────────────────────────────────────────────────────

interface NavItem {
  label: string
  icon: LucideIcon
  to: string
  adminOnly?: boolean    // gm + system_admin
  sysAdminOnly?: boolean // system_admin only
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard',        icon: LayoutDashboard, to: '/dashboard' },
  { label: 'New Entry',        icon: PlusCircle,      to: '/entries/new' },
  { label: 'All Entries',      icon: BookOpen,        to: '/entries/' },
  { label: 'Profile Settings', icon: User,            to: '/profile' },
  { label: 'Admin Panel',      icon: Settings,        to: '/admin',    adminOnly: true },
  { label: 'Security Monitor', icon: ShieldAlert,     to: '/security', sysAdminOnly: true },
]

// ─── Single nav link ───────────────────────────────────────────────────────

interface NavLinkProps {
  item: NavItem
  isCollapsed: boolean
  onClick?: () => void
}

function NavLink({ item, isCollapsed, onClick }: NavLinkProps) {
  const { location } = useRouterState()

  const isActive =
    item.to === '/entries/'
      ? location.pathname.startsWith('/entries') &&
        !location.pathname.startsWith('/entries/new')
      : location.pathname === item.to ||
        location.pathname === item.to.replace(/\/$/, '')

  return (
    <Link
      to={item.to}
      onClick={onClick}
      className={cn(
        'relative flex w-full transition-colors duration-150',
        isActive
          ? 'bg-brand/10 text-brand'
          : 'text-zinc-400 hover:bg-zinc-800 hover:text-white',
      )}
    >
      {/* Left active indicator */}
      {isActive && (
        <span className="absolute inset-y-0 left-0 w-0.5 rounded-r-full bg-brand" />
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

// ─── Sidebar ───────────────────────────────────────────────────────────────

interface SidebarProps {
  isCollapsed: boolean
  onToggle: () => void
  isMobile?: boolean
  /** Called after a nav link is clicked — used to close mobile sheet */
  onNavigate?: () => void
}

export function Sidebar({
  isCollapsed,
  onToggle,
  isMobile = false,
  onNavigate,
}: SidebarProps) {
  const { profile, signOut } = useAuthContext()
  const navigate = useNavigate()
  const [confirmOpen, setConfirmOpen] = useState(false)

  const handleSignOut = async () => {
    await signOut()
    await navigate({ to: '/login' })
  }

  const initials = getInitials(profile?.full_name ?? '')
  const deptLabel = profile ? DEPT_LABELS[profile.department] : ''
  const isAdmin = profile?.role === 'gm' || profile?.role === 'system_admin'
  const visibleItems = NAV_ITEMS.filter(item => {
    if (item.sysAdminOnly && profile?.role !== 'system_admin') return false
    if (item.adminOnly && !isAdmin) return false
    return true
  })

  return (
    <div
      className="relative flex h-full flex-col"
      style={{ backgroundColor: '#0a0a0a' }}
    >
      {/* ── Toggle button (desktop only, floats on right edge) ── */}
      {!isMobile && (
        <button
          onClick={onToggle}
          aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="absolute -right-3 top-5 z-50 flex h-6 w-6 items-center justify-center rounded-full border border-zinc-700 bg-zinc-900 text-zinc-400 transition-colors hover:text-white"
        >
          {isCollapsed ? (
            <ChevronRight size={12} />
          ) : (
            <ChevronLeft size={12} />
          )}
        </button>
      )}

      {/* ── Logo header ── */}
      <div
        className={cn(
          'flex h-20 shrink-0 items-center border-b border-zinc-800',
          isCollapsed ? 'justify-center px-2' : 'px-6',
        )}
      >
        {isCollapsed ? (
          <img src="/treal-icon.png" alt="Treal" className="h-10 w-10" />
        ) : (
          <img src="/treal-logo.png" alt="Treal Hotels & Suites" className="h-12 w-auto" />
        )}
      </div>

      {/* ── Nav links ── */}
      <nav className="flex-1 overflow-y-auto py-6">
        {visibleItems.map(item => (
          <NavLink
            key={item.to}
            item={item}
            isCollapsed={isCollapsed}
            onClick={onNavigate}
          />
        ))}
      </nav>

      {/* ── User section ── */}
      <div className="shrink-0 border-t border-zinc-800 p-3">
        <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Sign out?</AlertDialogTitle>
              <AlertDialogDescription>
                You will be returned to the login screen.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleSignOut}
                className="bg-[#a31e22] text-white hover:bg-[#82181b]"
              >
                Sign Out
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>

          {isCollapsed ? (
            /* Collapsed: stacked icon layout */
            <div className="flex flex-col items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand text-xs font-semibold text-white">
                {initials}
              </div>
              <AlertDialogTrigger asChild>
                <button
                  aria-label="Sign out"
                  className="rounded p-1 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white"
                >
                  <LogOut size={14} />
                </button>
              </AlertDialogTrigger>
            </div>
          ) : (
            /* Expanded: row layout */
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-semibold text-white">
                {initials}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-white">
                  {profile?.full_name}
                </p>
                <p className="truncate text-xs text-zinc-400">{deptLabel}</p>
              </div>
              <AlertDialogTrigger asChild>
                <button
                  aria-label="Sign out"
                  className="shrink-0 rounded p-1 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white"
                >
                  <LogOut size={14} />
                </button>
              </AlertDialogTrigger>
            </div>
          )}
        </AlertDialog>
      </div>
    </div>
  )
}
