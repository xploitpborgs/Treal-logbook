import { useState } from 'react'
import { LogOut, Menu, Settings, User } from 'lucide-react'
import { Link, useNavigate } from '@tanstack/react-router'
import { useAuthContext } from '@/lib/AuthContext'
import { getInitials } from '@/lib/utils'
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

interface HeaderProps {
  title: string
  onMenuClick: () => void
}

export function Header({ title, onMenuClick }: HeaderProps) {
  const { profile, signOut } = useAuthContext()
  const navigate = useNavigate()
  const [confirmOpen, setConfirmOpen] = useState(false)

  const initials = getInitials(profile?.full_name ?? '')

  const handleSignOut = async () => {
    await signOut()
    await navigate({ to: '/login' })
  }

  const isAdmin = profile?.role === 'gm' || profile?.role === 'system_admin'

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center border-b border-zinc-200 bg-white px-4 sm:px-8 lg:px-10">
      {/* Left — hamburger (mobile only) + page title */}
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          aria-label="Open navigation"
          className="rounded-md p-1.5 text-zinc-500 transition-colors hover:bg-zinc-100 md:hidden"
        >
          <Menu size={20} />
        </button>
        <h1 className="text-base sm:text-lg font-semibold text-zinc-900">{title}</h1>
      </div>

      {/* Right — avatar dropdown */}
      <div className="ml-auto">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              aria-label="User menu"
              className="flex h-8 w-8 items-center justify-center rounded-full bg-brand text-xs font-semibold text-white transition-opacity hover:opacity-80"
            >
              {initials}
            </button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-48">
            {/* User info header */}
            <div className="px-2 py-1.5">
              <p className="truncate text-xs font-medium text-zinc-900">
                {profile?.full_name}
              </p>
              <p className="truncate text-xs text-zinc-500">
                {profile?.department.replace(/_/g, ' ')}
              </p>
            </div>
            <DropdownMenuSeparator />

            <DropdownMenuItem asChild>
              <Link to="/profile" className="flex items-center">
                <User size={14} className="mr-2 shrink-0" />
                Profile
              </Link>
            </DropdownMenuItem>

            {isAdmin && (
              <DropdownMenuItem asChild>
                <Link to="/admin" className="flex items-center">
                  <Settings size={14} className="mr-2 shrink-0" />
                  Admin Panel
                </Link>
              </DropdownMenuItem>
            )}

            <DropdownMenuSeparator />

            <DropdownMenuItem
              className="text-brand focus:text-brand"
              onClick={() => setConfirmOpen(true)}
            >
              <LogOut size={14} className="mr-2 shrink-0" />
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

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
      </AlertDialog>
    </header>
  )
}
