import { createClient } from '@supabase/supabase-js'

const supabaseUrl    = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

/**
 * Server-only Supabase client (uses service role key — bypasses RLS).
 * Import only in server-side code (API routes, Server Components).
 * Never expose SUPABASE_SERVICE_ROLE_KEY to the browser.
 */
export function createServerClient() {
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  })
}
