// ── A08: CSRF token (defense-in-depth for JWT-based SPA) ─────────────────────
// JWTs in localStorage already make traditional CSRF impossible, but this token
// is added to every Supabase request header so that an edge proxy can enforce it.

const CSRF_KEY = 'treal_csrf'

export function getCsrfToken(): string {
  let token = sessionStorage.getItem(CSRF_KEY)
  if (!token) {
    const bytes = new Uint8Array(32)
    crypto.getRandomValues(bytes)
    token = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')
    sessionStorage.setItem(CSRF_KEY, token)
  }
  return token
}

// ── A03: Input sanitisation ───────────────────────────────────────────────────
// React already escapes JSX output (no raw innerHTML), so the main risks are:
// - oversized payloads exhausting DB/UI
// - javascript: URIs injected into href attributes
// - angle-bracket injection if content is ever emailed/exported

export function sanitize(value: string, maxLength = 5000): string {
  return value
    .trim()
    .slice(0, maxLength)
    .replace(/javascript\s*:/gi, '')   // kill javascript: URI scheme
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '') // strip <script> blocks
}

// ── A07: Client-side rate limiter ─────────────────────────────────────────────
// Supabase's auth service also enforces server-side rate limits; this adds a
// UX-friendly client guard that fires first.

export class RateLimiter {
  private timestamps: number[] = []
  private maxCalls: number
  private windowMs: number

  constructor(maxCalls: number, windowMs: number) {
    this.maxCalls = maxCalls
    this.windowMs = windowMs
  }

  check(): { allowed: boolean; retryAfterSeconds: number } {
    const now = Date.now()
    this.timestamps = this.timestamps.filter(t => now - t < this.windowMs)
    if (this.timestamps.length >= this.maxCalls) {
      const retryAfterSeconds = Math.ceil(
        (this.windowMs - (now - this.timestamps[0])) / 1000,
      )
      return { allowed: false, retryAfterSeconds }
    }
    this.timestamps.push(now)
    return { allowed: true, retryAfterSeconds: 0 }
  }
}

// 5 login attempts per minute (A07)
export const loginLimiter = new RateLimiter(5, 60_000)

// 10 form submits per minute for other forms (A07)
export const formLimiter = new RateLimiter(10, 60_000)

import { supabase } from '@/lib/supabase'

// ── A09: Security event logger ────────────────────────────────────────────────
// Production logging forwards these to Supabase security_events table.
// They are also stored in sessionStorage as a fallback.

type SecurityEventType =
  | 'login_success'
  | 'login_failed'
  | 'login_rate_limited'
  | 'inactive_account_blocked'
  | 'unauthorized_access'
  | 'form_rate_limited'
  | 'session_expired'

interface SecurityEventPayload {
  event: SecurityEventType
  detail?: string
  ts: string
  path: string
}

export function logSecurityEvent(event: SecurityEventType, detail?: string): void {
  const payload: SecurityEventPayload = {
    event,
    detail,
    ts: new Date().toISOString(),
    path: window.location.pathname,
  }

  if (import.meta.env.DEV) {
    console.warn('[security]', payload)
  }

  // 1. Send to Supabase (fire and forget)
  supabase.from('security_events').insert([{
    event_type: event,
    description: detail || '',
    path: payload.path,
    user_email: detail && detail.includes('@') ? detail : null // Optional extraction
  }]).then(({ error }) => {
    if (error && import.meta.env.DEV) {
      console.error('[security] Failed to log to Supabase:', error)
    }
  })

  // 2. Keep in local storage as fallback
  try {
    const key = 'treal_security_log'
    const raw = sessionStorage.getItem(key)
    const log: SecurityEventPayload[] = raw ? JSON.parse(raw) : []
    log.push(payload)
    // Keep last 50 events only
    sessionStorage.setItem(key, JSON.stringify(log.slice(-50)))
  } catch {
    // sessionStorage may be full or unavailable — fail silently
  }
}
