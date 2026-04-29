import { createFileRoute, Navigate } from '@tanstack/react-router'
import { useAuthContext } from '@/lib/AuthContext'
import { FullScreenSpinner } from '@/components/auth/Spinner'

export const Route = createFileRoute('/')({
  component: IndexRoute,
})

function IndexRoute() {
  const { profile, loading } = useAuthContext()

  if (loading) return <FullScreenSpinner size="sm" />

  return <Navigate to={profile ? '/dashboard' : '/login'} />
}
