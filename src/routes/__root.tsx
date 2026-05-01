import { createRootRoute, Outlet } from '@tanstack/react-router'
import { Toaster } from '@/components/ui/sonner'
import { PWAUpdatePrompt } from '@/components/PWAUpdatePrompt'

// A05: DevTools are stripped in production builds — they expose route structure
// and internal state that should not be visible to end users.
const RouterDevtools =
  import.meta.env.PROD
    ? () => null
    : (await import('@tanstack/router-devtools')).TanStackRouterDevtools

export const Route = createRootRoute({
  component: () => (
    <>
      <Outlet />
      <PWAUpdatePrompt />
      <Toaster richColors position="bottom-right" duration={4000} closeButton />
      <RouterDevtools />
    </>
  ),
})
