/**
 * One-time script: import Listname.csv → Supabase staff_whitelist table
 *
 * Usage:
 *   node --env-file=.env.local scripts/seed-whitelist.mjs
 *
 * Requires Node.js 20.6+ (for --env-file flag).
 * Table must already exist (run migration 002_staff_whitelist.sql first).
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// ── Supabase client (service role — bypasses RLS) ──────────────────────────
const supabaseUrl     = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey  = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing env vars: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
})

// ── CSV parser ──────────────────────────────────────────────────────────────
// Handles:
//   - header row (skipped)
//   - quoted fields with commas: EM5569324,"MISS CHU, YARU"
//   - non-13-digit national IDs (e.g. 802444000000, EM5569324)
function parseCsv(text) {
  const rows = []
  for (const line of text.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) continue

    let national_id, full_name_th

    if (trimmed.includes('"')) {
      // Field with quotes: id,"name with, comma"
      const match = trimmed.match(/^([^,]+),"(.+)"$/)
      if (!match) continue
      national_id  = match[1].trim()
      full_name_th = match[2].trim()
    } else {
      const idx = trimmed.indexOf(',')
      if (idx === -1) continue
      national_id  = trimmed.substring(0, idx).trim()
      full_name_th = trimmed.substring(idx + 1).trim()
    }

    if (national_id === 'national_id') continue  // skip header
    if (!national_id || !full_name_th) continue

    rows.push({ national_id, full_name_th })
  }
  return rows
}

// ── Main ────────────────────────────────────────────────────────────────────
async function main() {
  const csvPath = join(__dirname, '..', 'data', 'Listname.csv')
  const text = readFileSync(csvPath, 'utf-8')
  const rows = parseCsv(text)

  console.log(`Parsed ${rows.length} rows from CSV`)

  // Insert in one batch; skip exact duplicates (same national_id + full_name_th)
  const { error } = await supabase
    .from('staff_whitelist')
    .upsert(rows, { onConflict: 'national_id,full_name_th' })

  if (error) {
    console.error('Insert failed:', error.message)
    process.exit(1)
  }

  console.log(`Done — ${rows.length} rows upserted into staff_whitelist`)
}

main()
