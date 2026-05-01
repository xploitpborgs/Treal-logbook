import { useState, useEffect, type ReactNode } from 'react'
import { useRouterState } from '@tanstack/react-router'
import { cn } from '@/lib/utils'
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import { Sidebar } from '@/components/layout/Sidebar'
import { Header } from '@/components/layout/Header'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'

// ─── Route → page title map ────────────────────────────────────────────────

const ROUTE_TITLES: Record<string, string> = {
  '/dashboard':               'Dashboard',
  '/issues/new':              'New Issue',
  '/supervisor-update/new':   'Post Supervisor Update',
  '/gm-update/new':           'Post GM Update',
  '/hr-update/new':           'Post HR Update',
  '/admin':                   'Admin Panel',
  '/profile':                 'Profile Settings',
  '/security':                'Security Monitor',
  '/issues':                  'All Issues',
}

function resolveTitle(pathname: string, override?: string): string {
  if (override) return override
  if (ROUTE_TITLES[pathname]) return ROUTE_TITLES[pathname]
  if (pathname.startsWith('/issues/')) return 'Issue Details'
  if (pathname.startsWith('/entries/')) return 'Issue Details'
  return 'Dashboard'
}

// ─── Layout ────────────────────────────────────────────────────────────────

interface AppLayoutProps {
  children: ReactNode
  title?: string
}

export function AppLayout({ children, title }: AppLayoutProps) {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const { location } = useRouterState()

  const pageTitle = resolveTitle(location.pathname, title)

  useEffect(() => {
    document.title = `${pageTitle} | Treal Logbook`
  }, [pageTitle])

  return (
    <ProtectedRoute>
      <div className="flex min-h-screen bg-white">

        {/* ── Desktop sidebar ── */}
        <aside
          className={cn(
            'fixed inset-y-0 left-0 z-40 hidden flex-col transition-all duration-300 md:flex',
            isCollapsed ? 'w-16' : 'w-60',
          )}
          style={{ backgroundColor: '#0a0a0a' }}
        >
          <Sidebar
            isCollapsed={isCollapsed}
            onToggle={() => setIsCollapsed(c => !c)}
          />
        </aside>

        {/* ── Mobile sidebar (Sheet) ── */}
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetContent
            side="left"
            className="w-60 border-r-0 p-0 [&>button:first-child]:hidden"
            style={{ backgroundColor: '#0a0a0a' }}
          >
            <SheetHeader className="sr-only">
              <SheetTitle>Navigation</SheetTitle>
            </SheetHeader>
            <Sidebar
              isCollapsed={false}
              onToggle={() => setMobileOpen(false)}
              isMobile
              onNavigate={() => setMobileOpen(false)}
            />
          </SheetContent>
        </Sheet>

        {/* ── Main area ── */}
        <div
          className={cn(
            'flex min-h-screen flex-1 flex-col transition-all duration-300 min-w-0',
            isCollapsed ? 'md:ml-16' : 'md:ml-60',
          )}
        >
          <Header title={pageTitle} onMenuClick={() => setMobileOpen(true)} />
          <main className="flex-1 min-w-0 overflow-y-auto bg-white p-4 sm:p-8 lg:p-10">
            {children}
          </main>
        </div>
      </div>
    </ProtectedRoute>
  )
}
