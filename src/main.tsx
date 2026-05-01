import { Component, StrictMode } from 'react'
import type { ReactNode } from 'react'
import ReactDOM from 'react-dom/client'
import { RouterProvider, createRouter } from '@tanstack/react-router'
import { AuthProvider } from '@/lib/AuthContext'
import { routeTree } from './routeTree.gen'
import './index.css'
import { AlertCircle } from 'lucide-react'

// ─── Env validation ─────────────────────────────────────────────────────────

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error(
    'Missing required environment variables: ' +
    'VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set.',
  )
}

// ─── Router ─────────────────────────────────────────────────────────────────

const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

// ─── Error boundary ──────────────────────────────────────────────────────────

class ErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; error?: Error }
> {
  state = { hasError: false, error: undefined as Error | undefined }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-screen items-center justify-center bg-white">
          <div className="text-center max-w-md px-6">
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-6 h-6 text-red-600" />
            </div>
            <h2 className="text-lg font-medium text-zinc-900 mb-2">Something went wrong</h2>
            <p className="text-sm text-zinc-500 mb-6">
              An unexpected error occurred. Please refresh the page.
              If the problem persists contact your system administrator.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="bg-[#C41E3A] text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-[#a01830]"
            >
              Refresh Page
            </button>
            {import.meta.env.DEV && this.state.error && (
              <pre className="mt-4 text-xs text-left bg-zinc-50 p-3 rounded border border-zinc-200 overflow-auto max-h-32">
                {this.state.error.message}
              </pre>
            )}
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

// ─── Mount ───────────────────────────────────────────────────────────────────

const rootElement = document.getElementById('root')!
if (!rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement)
  root.render(
    <StrictMode>
      <ErrorBoundary>
        <AuthProvider>
          <RouterProvider router={router} />
        </AuthProvider>
      </ErrorBoundary>
    </StrictMode>,
  )
}
