import { useState, useEffect } from 'react'
import { LogOut, Menu, Settings, User } from 'lucide-react'
import { Link, useNavigate } from '@tanstack/react-router'
import { useAuthContext } from '@/lib/AuthContext'
import { useRole } from '@/hooks/useRole'
import { cn } from '@/lib/utils'
import { formatRole, getInitials } from '@/lib/formatters'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
import { NotificationCenter } from './NotificationCenter'

// ─── Role badge colors (light header bg) ───────────────────────────────────

const ROLE_BADGE_LIGHT: Record<string, string> = {
  staff:        'bg-zinc-100 text-zinc-600',
  supervisor:   'bg-blue-100 text-blue-700',
  gm:           'bg-amber-100 text-amber-700',
  hr:           'bg-purple-100 text-purple-700',
  system_admin: 'bg-[#C41E3A]/10 text-[#C41E3A]',
}

interface HeaderProps {
  onMenuClick: () => void
}

export function Header({ onMenuClick }: HeaderProps) {
  const { profile, signOut } = useAuthContext()
  const { isAdmin } = useRole()
  const navigate = useNavigate()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [time, setTime] = useState(new Date())

  // Keep the time updated every minute
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 60000)
    return () => clearInterval(timer)
  }, [])

  const formattedTime = time.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  })

  const initials   = getInitials(profile?.full_name ?? '')
  const roleBadge  = ROLE_BADGE_LIGHT[profile?.role ?? ''] ?? 'bg-zinc-100 text-zinc-600'
  const roleLabel  = formatRole(profile?.role ?? '')
  const firstName  = profile?.full_name?.split(' ')[0] ?? 'there'

  const handleSignOut = async () => {
    await signOut()
    await navigate({ to: '/login' })
  }

  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center border-b border-zinc-200 bg-white px-4 sm:px-8 lg:px-10">

      {/* Left — hamburger (mobile) + greeting */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={onMenuClick}
          aria-label="Open navigation"
          className="h-8 w-8 text-zinc-500 hover:bg-zinc-100 md:hidden"
        >
          <Menu size={20} />
        </Button>
        <div className="flex flex-col leading-none">
          <span className="text-base font-semibold text-zinc-900 tracking-tight">Welcome, {firstName}</span>
          <span className="text-xs font-medium uppercase tracking-wider text-zinc-400 mt-1">{formattedTime}</span>
        </div>
      </div>

      {/* Right — role badge + avatar dropdown */}
      <div className="ml-auto flex items-center gap-3">
        {/* Role badge */}
        <Badge
          className={cn(
            'hidden sm:inline-flex border-0 shadow-none text-xs font-medium',
            roleBadge,
          )}
        >
          {roleLabel}
        </Badge>

        {/* Persistent Notification Center */}
        <NotificationCenter />

        {/* Avatar dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              aria-label="User menu"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-[#C41E3A] text-xs font-semibold text-white transition-opacity hover:opacity-80"
            >
              {initials}
            </button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-52">
            <div className="px-2 py-1.5">
              <p className="truncate text-xs font-medium text-zinc-900">{profile?.full_name}</p>
              <p className="truncate text-xs text-zinc-500">{roleLabel}</p>
            </div>
            <DropdownMenuSeparator />

            <DropdownMenuItem asChild>
              <Link to="/profile" className="flex items-center">
                <User size={14} className="mr-2 shrink-0" />
                Profile Settings
              </Link>
            </DropdownMenuItem>

            {isAdmin() && (
              <DropdownMenuItem asChild>
                <Link to="/admin" className="flex items-center">
                  <Settings size={14} className="mr-2 shrink-0" />
                  Admin Panel
                </Link>
              </DropdownMenuItem>
            )}

            <DropdownMenuSeparator />

            <DropdownMenuItem
              className="text-[#C41E3A] focus:text-[#C41E3A]"
              onClick={() => setConfirmOpen(true)}
            >
              <LogOut size={14} className="mr-2 shrink-0" />
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Sign-out confirmation */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sign out?</AlertDialogTitle>
            <AlertDialogDescription>You will be returned to the login screen.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleSignOut} className="bg-[#C41E3A] text-white hover:bg-[#a01830]">
              Sign Out
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </header>
  )
}
