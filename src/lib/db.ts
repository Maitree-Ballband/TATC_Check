/**
 * Database repository layer.
 *
 * All database access goes through this module.
 * To migrate away from Supabase, replace only the implementations below
 * while keeping every function signature identical.
 */
import { pool } from '@/lib/postgres'
import type { User, AttendanceRecord } from '@/types'

// ─── User queries ─────────────────────────────────────────────────────────────

export async function findUserByLineId(lineUserId: string) {
  const { rows } = await pool.query(
    `SELECT id, is_active, is_pending FROM users WHERE line_user_id = $1 LIMIT 1`,
    [lineUserId],
  )
  return (rows[0] ?? null) as Pick<User, 'id' | 'is_active' | 'is_pending'> | null
}

export async function findUserAuthByLineId(lineUserId: string) {
  const { rows } = await pool.query(
    `SELECT id, role, full_name_th, department, is_pending FROM users WHERE line_user_id = $1 LIMIT 1`,
    [lineUserId],
  )
  return (rows[0] ?? null) as Pick<User, 'id' | 'role' | 'full_name_th' | 'department' | 'is_pending'> | null
}

export async function createPendingUser(
  lineUserId: string,
  name: string,
  avatarUrl: string | null,
) {
  await pool.query(
    `INSERT INTO users (line_user_id, full_name_th, avatar_url, role, is_active, is_pending)
     VALUES ($1, $2, $3, 'teacher', false, true)`,
    [lineUserId, name, avatarUrl],
  )
}

export async function updateUserAvatar(lineUserId: string, avatarUrl: string | null) {
  await pool.query(
    `UPDATE users SET avatar_url = $1 WHERE line_user_id = $2`,
    [avatarUrl, lineUserId],
  )
}

export async function listActiveTeachers() {
  const { rows } = await pool.query(
    `SELECT id, full_name_th, department, role, avatar_url
     FROM users WHERE is_active = true ORDER BY full_name_th`,
  )
  return rows
}

export async function listAllUsers() {
  const { rows } = await pool.query(
    `SELECT id, line_user_id, full_name_th, national_id, employee_id, department,
            role, is_active, is_pending, avatar_url, created_at
     FROM users ORDER BY full_name_th`,
  )
  return rows as User[]
}

export async function createUser(payload: Record<string, unknown>) {
  const keys = Object.keys(payload)
  const values = Object.values(payload)
  const placeholders = keys.map((_, i) => `$${i + 1}`)
  const { rows } = await pool.query(
    `INSERT INTO users (${keys.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`,
    values,
  )
  if (!rows[0]) throw new Error('createUser: insert returned no row')
  return rows[0] as User
}

export async function updateUser(id: string, payload: Record<string, unknown>) {
  const keys = Object.keys(payload)
  const values = Object.values(payload)
  const setClause = keys.map((k, i) => `${k} = $${i + 1}`).join(', ')
  values.push(id)
  const { rows } = await pool.query(
    `UPDATE users SET ${setClause} WHERE id = $${keys.length + 1} RETURNING *`,
    values,
  )
  if (!rows[0]) throw new Error('updateUser: user not found')
  return rows[0] as User
}

export async function deactivateUser(id: string) {
  const { rowCount } = await pool.query(
    `UPDATE users SET is_active = false WHERE id = $1`,
    [id],
  )
  if (!rowCount) throw new Error('deactivateUser: user not found')
}

export async function listUsersWithNationalId() {
  const { rows } = await pool.query(
    `SELECT id, national_id FROM users WHERE national_id IS NOT NULL`,
  )
  return rows as Pick<User, 'id' | 'national_id'>[]
}

export async function getPendingUserProfile(id: string) {
  const { rows } = await pool.query(
    `SELECT full_name_th, national_id FROM users WHERE id = $1 LIMIT 1`,
    [id],
  )
  return (rows[0] ?? null) as Pick<User, 'full_name_th' | 'national_id'> | null
}

export async function updatePendingUserProfile(
  id: string,
  full_name_th: string,
  national_id: string,
) {
  const { rowCount } = await pool.query(
    `UPDATE users
     SET full_name_th = $1, national_id = $2, is_pending = false, is_active = true
     WHERE id = $3 AND is_pending = true`,
    [full_name_th, national_id, id],
  )
  if (!rowCount) throw new Error('updatePendingUserProfile: user not found or already active')
}

export async function findUserAuthById(id: string) {
  const { rows } = await pool.query(
    `SELECT id, role, full_name_th, department, is_pending FROM users WHERE id = $1 LIMIT 1`,
    [id],
  )
  return (rows[0] ?? null) as Pick<User, 'id' | 'role' | 'full_name_th' | 'department' | 'is_pending'> | null
}

export async function listActiveTeachersForExport(dept?: string | null) {
  if (dept) {
    const { rows } = await pool.query(
      `SELECT id, full_name_th, national_id, employee_id, department
       FROM users WHERE is_active = true AND department = $1 ORDER BY full_name_th`,
      [dept],
    )
    return rows
  }
  const { rows } = await pool.query(
    `SELECT id, full_name_th, national_id, employee_id, department
     FROM users WHERE is_active = true ORDER BY full_name_th`,
  )
  return rows
}

export async function listAllStaffForPresence(): Promise<{
  id: string
  national_id: string
  full_name_th: string
  department: string | null
  avatar_url: string | null
  is_registered: boolean
}[]> {
  const { rows } = await pool.query(
    `SELECT
       COALESCE(u.id::text, sw.national_id)  AS id,
       sw.national_id,
       sw.full_name_th,
       u.department,
       u.avatar_url,
       (u.id IS NOT NULL)                    AS is_registered
     FROM staff_whitelist sw
     LEFT JOIN users u
       ON u.national_id = sw.national_id
      AND u.is_active   = true
      AND u.is_pending  = false
     ORDER BY sw.full_name_th`,
  )
  return rows
}

// ─── Staff whitelist queries ───────────────────────────────────────────────────

export async function checkWhitelist(nationalId: string, fullName: string): Promise<boolean> {
  const { rows } = await pool.query(
    `SELECT 1 FROM staff_whitelist WHERE national_id = $1 AND full_name_th = $2 LIMIT 1`,
    [nationalId, fullName],
  )
  return rows.length > 0
}

export async function lookupNameByNationalId(nationalId: string): Promise<string | null> {
  const { rows } = await pool.query(
    `SELECT full_name_th FROM staff_whitelist WHERE national_id = $1 LIMIT 1`,
    [nationalId],
  )
  return rows[0]?.full_name_th ?? null
}

export async function searchWhitelistNames(q: string): Promise<string[]> {
  const { rows } = await pool.query(
    `SELECT full_name_th FROM staff_whitelist WHERE full_name_th ILIKE $1 LIMIT 10`,
    [`%${q}%`],
  )
  return rows.map((r: { full_name_th: string }) => r.full_name_th)
}

// ─── Attendance queries ───────────────────────────────────────────────────────

export async function getTodayRecord(userId: string, date: string) {
  const { rows } = await pool.query(
    `SELECT * FROM attendance_records WHERE user_id = $1 AND date = $2 LIMIT 1`,
    [userId, date],
  )
  return (rows[0] ?? null) as AttendanceRecord | null
}

export async function upsertCheckIn(payload: {
  user_id:       string
  date:          string
  check_in_at:   string
  location_mode: string
  check_in_lat:  number | null
  check_in_lng:  number | null
  status:        string
  late_reason?:  string | null
}) {
  const { rows } = await pool.query(
    `INSERT INTO attendance_records
       (user_id, date, check_in_at, location_mode, check_in_lat, check_in_lng, status, late_reason)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (user_id, date) DO UPDATE SET
       check_in_at   = EXCLUDED.check_in_at,
       location_mode = EXCLUDED.location_mode,
       check_in_lat  = EXCLUDED.check_in_lat,
       check_in_lng  = EXCLUDED.check_in_lng,
       status        = EXCLUDED.status,
       late_reason   = EXCLUDED.late_reason
     RETURNING *`,
    [
      payload.user_id,
      payload.date,
      payload.check_in_at,
      payload.location_mode,
      payload.check_in_lat,
      payload.check_in_lng,
      payload.status,
      payload.late_reason ?? null,
    ],
  )
  if (!rows[0]) throw new Error('upsertCheckIn: no row returned')
  return rows[0] as AttendanceRecord
}

export async function updateCheckOut(recordId: string, checkOutAt: string, locationMode: string) {
  const { rows } = await pool.query(
    `UPDATE attendance_records
     SET check_out_at = $1, check_out_location_mode = $2
     WHERE id = $3
     RETURNING *`,
    [checkOutAt, locationMode, recordId],
  )
  if (!rows[0]) throw new Error('updateCheckOut: record not found')
  return rows[0] as AttendanceRecord
}

export async function getTodayRecordsForUsers(date: string, userIds: string[]) {
  if (userIds.length === 0) return [] as AttendanceRecord[]
  const { rows } = await pool.query(
    `SELECT * FROM attendance_records WHERE date = $1 AND user_id = ANY($2)`,
    [date, userIds],
  )
  return rows as AttendanceRecord[]
}

export async function getAttendanceHistory(
  userId: string,
  from?: string | null,
  to?: string | null,
  limit = 90,
) {
  const conditions: string[] = ['user_id = $1']
  const values: unknown[] = [userId]
  if (from) { values.push(from); conditions.push(`date >= $${values.length}`) }
  if (to)   { values.push(to);   conditions.push(`date <= $${values.length}`) }
  values.push(limit)
  const { rows } = await pool.query(
    `SELECT * FROM attendance_records
     WHERE ${conditions.join(' AND ')}
     ORDER BY date DESC
     LIMIT $${values.length}`,
    values,
  )
  return rows as AttendanceRecord[]
}

export async function getAttendanceForReport(userIds: string[], from: string, to: string) {
  if (userIds.length === 0) return [] as AttendanceRecord[]
  const { rows } = await pool.query(
    `SELECT * FROM attendance_records
     WHERE date >= $1 AND date <= $2 AND user_id = ANY($3)`,
    [from, to, userIds],
  )
  return rows as AttendanceRecord[]
}

type AttendanceBatchRow = {
  user_id:       string
  date:          string
  check_in_at:   string
  check_out_at:  string | null
  location_mode: string
  status:        string
}

export async function upsertAttendanceBatch(records: AttendanceBatchRow[]) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    for (const r of records) {
      await client.query(
        `INSERT INTO attendance_records (user_id, date, check_in_at, check_out_at, location_mode, status)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (user_id, date) DO UPDATE SET
           check_in_at   = EXCLUDED.check_in_at,
           check_out_at  = EXCLUDED.check_out_at,
           location_mode = EXCLUDED.location_mode,
           status        = EXCLUDED.status`,
        [r.user_id, r.date, r.check_in_at, r.check_out_at, r.location_mode, r.status],
      )
    }
    await client.query('COMMIT')
  } catch (e) {
    await client.query('ROLLBACK')
    throw e
  } finally {
    client.release()
  }
}
