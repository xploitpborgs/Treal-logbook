import { useState, type FormEvent } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useAuthContext } from '@/lib/AuthContext'
import { loginLimiter, logSecurityEvent } from '@/lib/security'
import { STAFF_EMAIL_DOMAIN } from '@/lib/constants'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'

const DEPARTMENTS = [
  'Front Desk',
  'Housekeeping',
  'Maintenance',
  'Management',
  'Security',
  'Restaurant',
] as const

export function LoginPage() {
  const navigate = useNavigate()
  const { signIn } = useAuthContext()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)

    // A07: rate-limit login attempts (5 per minute per browser session)
    const { allowed, retryAfterSeconds } = loginLimiter.check()
    if (!allowed) {
      logSecurityEvent('login_rate_limited', email)
      setError(`Too many attempts. Please wait ${retryAfterSeconds}s before trying again.`)
      return
    }

    if (!email.endsWith(STAFF_EMAIL_DOMAIN)) {
      toast.error(`Please use your ${STAFF_EMAIL_DOMAIN} staff email address.`)
      return
    }

    setIsSubmitting(true)
    try {
      const { error: authError } = await signIn(email, password)
      if (authError) {
        setError(authError)
      } else {
        toast.success('Welcome back!')
        await navigate({ to: '/dashboard' })
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-[100dvh]">
      {/* ── Left branding panel (desktop only) ── */}
      <div className="relative hidden flex-col bg-[#0a0a0a] md:flex md:w-[45%]">
        <div className="flex flex-1 flex-col items-center justify-center px-12">
          <img
            src="/treal-logo.png"
            alt="Treal Hotels & Suites"
            className="h-20 w-auto"
          />
          <div className="mt-5 h-px w-16 bg-brand" />
          <p className="mt-3 text-xs uppercase text-white/50 tracking-[0.2em]">
            Staff Operations Portal
          </p>
        </div>

        <div className="px-12 pb-10 text-center">
          <p className="text-xs tracking-[0.1em] text-white/25">
            © {new Date().getFullYear()} Treal Hotels &amp; Suites
          </p>
        </div>

        <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-brand" />
      </div>

      {/* ── Right form panel ── */}
      <div className="flex flex-1 flex-col items-center justify-center bg-white px-6 sm:px-8 py-12">
        <div className="w-full max-w-sm flex flex-col justify-center">
          {/* Mobile logo — above Welcome back, hidden on desktop */}
          <div className="mb-10 flex justify-center md:hidden">
            <img
              src="/treal png logo 2.png"
              alt="Treal Hotels & Suites"
              className="h-14 w-auto"
            />
          </div>

          <div className="mb-8 text-center md:text-left">
            <h2 className="text-2xl font-bold text-foreground">Welcome back</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Sign in to your staff account
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder={`yourname${STAFF_EMAIL_DOMAIN}`}
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="focus-visible:ring-brand"
                autoComplete="email"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="focus-visible:ring-brand"
                autoComplete="current-password"
                required
              />
            </div>

            {error && (
              <div className="rounded-md border border-brand/25 bg-brand/10 px-4 py-3 text-sm text-brand">
                {error}
              </div>
            )}

            <Button
              type="submit"
              className="w-full bg-brand text-white hover:bg-brand-hover"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Signing in…' : 'Sign In'}
            </Button>
          </form>

          <div className="mt-8">
            <p className="mb-3 text-center text-xs text-muted-foreground">
              Available to all departments
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {DEPARTMENTS.map(dept => (
                <Badge key={dept} variant="secondary" className="text-xs">
                  {dept}
                </Badge>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
