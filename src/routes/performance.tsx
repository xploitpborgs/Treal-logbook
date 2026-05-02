import { createFileRoute } from '@tanstack/react-router'
import { AppLayout } from '@/components/layout/AppLayout'
import { PerformancePage } from '@/pages/performance/PerformancePage'
import { useRole } from '@/hooks/useRole'
import { useEffect } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'

export const Route = createFileRoute('/performance')({
  component: PerformanceRoute,
})

function PerformanceRoute() {
  const { profile, isAdmin } = useRole()
  const navigate = useNavigate()

  useEffect(() => {
    if (profile && profile.role !== 'gm' && !isAdmin()) {
      toast.error('Access denied. GM or Admin access required.')
      navigate({ to: '/dashboard' })
    }
  }, [profile, isAdmin, navigate])

  if (!profile || (profile.role !== 'gm' && !isAdmin())) {
    return null
  }

  return (
    <AppLayout>
      <PerformancePage />
    </AppLayout>
  )
}
