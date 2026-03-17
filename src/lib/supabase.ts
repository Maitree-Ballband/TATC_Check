import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// ── Browser client (used in Client Components) ──
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// ── Server client with service role (used in API routes only) ──
// Never expose SUPABASE_SERVICE_ROLE_KEY to the browser
export function createServerClient() {
  return createClient(
    supabaseUrl,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}
