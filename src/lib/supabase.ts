import { createClient } from '@supabase/supabase-js'
import { getCsrfToken } from './security'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    '[hotel-logbook] VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY is not set.\n' +
      'Make sure .env exists in the project root and restart the dev server.',
  )
}

// A08: Every request carries an X-CSRF-Token header.
// Supabase itself ignores it, but an edge proxy / Supabase Edge Function can
// enforce it for additional CSRF protection beyond the JWT Bearer mechanism.
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: {
    headers: {
      'X-CSRF-Token': getCsrfToken(),
    },
  },
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
})
