import { useState } from 'react'
import { LogOut, Menu, Settings, User } from 'lucide-react'
import { Link, useNavigate } from '@tanstack/react-router'
import { useAuthContext } from '@/lib/AuthContext'
import { useRole } from '@/hooks/useRole'
import { cn } from '@/lib/utils'
import { formatRole, getInitials } from '@/lib/formatters'
import { Badge } from '@/components/ui/badge'
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

// ─── Role badge colors (light header bg) ───────────────────────────────────

const ROLE_BADGE_LIGHT: Record<string, string> = {
  staff:        'bg-zinc-100 text-zinc-600',
  supervisor:   'bg-blue-100 text-blue-700',
  gm:           'bg-amber-100 text-amber-700',
  hr:           'bg-purple-100 text-purple-700',
  system_admin: 'bg-[#C41E3A]/10 text-[#C41E3A]',
}

interface HeaderProps {
  title: string
  onMenuClick: () => void
}

export function Header({ title, onMenuClick }: HeaderProps) {
  const { profile, signOut } = useAuthContext()
  const { isAdmin } = useRole()
  const navigate = useNavigate()
  const [confirmOpen, setConfirmOpen] = useState(false)

  const initials   = getInitials(profile?.full_name ?? '')
  const roleBadge  = ROLE_BADGE_LIGHT[profile?.role ?? ''] ?? 'bg-zinc-100 text-zinc-600'
  const roleLabel  = formatRole(profile?.role ?? '')

  const handleSignOut = async () => {
    await signOut()
    await navigate({ to: '/login' })
  }

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center border-b border-zinc-200 bg-white px-4 sm:px-8 lg:px-10">

      {/* Left — hamburger (mobile) + page title */}
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          aria-label="Open navigation"
          className="rounded-md p-1.5 text-zinc-500 transition-colors hover:bg-zinc-100 md:hidden"
        >
          <Menu size={20} />
        </button>
        <h1 className="text-base font-semibold text-zinc-900 sm:text-lg">{title}</h1>
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

        {/* Avatar dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              aria-label="User menu"
              className="flex h-8 w-8 items-center justify-center rounded-full bg-[#C41E3A] text-xs font-semibold text-white transition-opacity hover:opacity-80"
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
            <AlertDialogAction onClick={handleSignOut} className="bg-[#C41E3A] text-white hover:bg-[#a31e22]">
              Sign Out
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </header>
  )
}
