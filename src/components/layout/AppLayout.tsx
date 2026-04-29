import { useState, type ReactNode } from 'react'
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

interface AppLayoutProps {
  children: ReactNode
  title: string
}

export function AppLayout({ children, title }: AppLayoutProps) {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <ProtectedRoute>
      <div className="flex min-h-screen bg-white">
        {/* ── Desktop sidebar (fixed, hidden on mobile) ── */}
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

        {/* ── Mobile sidebar (shadcn Sheet) ── */}
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetContent
            side="left"
            className="w-60 border-r-0 p-0 [&>button:first-child]:hidden"
            style={{ backgroundColor: '#0a0a0a' }}
          >
            {/* Screen-reader label required by radix */}
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

        {/* ── Main area (shifts right on desktop to clear sidebar) ── */}
        <div
          className={cn(
            'flex min-h-screen flex-1 flex-col transition-all duration-300 min-w-0',
            isCollapsed ? 'md:ml-16' : 'md:ml-60',
          )}
        >
          <Header title={title} onMenuClick={() => setMobileOpen(true)} />

          <main className="flex-1 min-w-0 overflow-y-auto bg-white p-4 sm:p-8 lg:p-10">{children}</main>
        </div>
      </div>
    </ProtectedRoute>
  )
}
