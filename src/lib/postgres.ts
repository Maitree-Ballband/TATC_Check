/**
 * PostgreSQL connection pool (replaces Supabase client).
 * Used exclusively by src/lib/db.ts — do not import elsewhere.
 */
import { Pool, types } from 'pg'

// Return timestamptz/timestamp as ISO 8601 strings (matches previous Supabase behaviour)
types.setTypeParser(1184, (v: string) => new Date(v).toISOString()) // timestamptz
types.setTypeParser(1114, (v: string) => new Date(v).toISOString()) // timestamp
// Return date as YYYY-MM-DD string (unchanged)
types.setTypeParser(1082, (v: string) => v)

// Singleton pool — prevents duplicate connections during Next.js hot-reload in dev
declare global {
  // eslint-disable-next-line no-var
  var __pgPool: Pool | undefined
}

const pool =
  globalThis.__pgPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  })

if (process.env.NODE_ENV !== 'production') globalThis.__pgPool = pool

export { pool }
