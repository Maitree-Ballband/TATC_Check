/**
 * Database repository layer.
 *
 * All database access goes through this module.
 * To migrate away from Supabase, replace only the implementations below
 * while keeping every function signature identical.
 */
import { createServerClient } from '@/lib/supabase'
import type { User, AttendanceRecord } from '@/types'

function client() {
  return createServerClient()
}

// ─── User queries ─────────────────────────────────────────────────────────────

export async function findUserByLineId(lineUserId: string) {
  const { data } = await client()
    .from('users')
    .select('id, is_active, is_pending')
    .eq('line_user_id', lineUserId)
    .single()
  return data as Pick<User, 'id' | 'is_active' | 'is_pending'> | null
}

export async function findUserAuthByLineId(lineUserId: string) {
  const { data } = await client()
    .from('users')
    .select('id, role, full_name_th, department, is_pending')
    .eq('line_user_id', lineUserId)
    .single()
  return data as Pick<User, 'id' | 'role' | 'full_name_th' | 'department' | 'is_pending'> | null
}

export async function createPendingUser(
  lineUserId: string,
  name: string,
  avatarUrl: string | null,
) {
  const { error } = await client().from('users').insert({
    line_user_id: lineUserId,
    full_name_th: name,
    avatar_url:   avatarUrl,
    role:         'teacher',
    is_active:    false,
    is_pending:   true,
  })
  if (error) throw new Error(`createPendingUser: ${error.message}`)
}

export async function updateUserAvatar(lineUserId: string, avatarUrl: string | null) {
  await client()
    .from('users')
    .update({ avatar_url: avatarUrl })
    .eq('line_user_id', lineUserId)
}

export async function listActiveTeachers() {
  const { data, error } = await client()
    .from('users')
    .select('id, full_name_th, department, role, avatar_url')
    .eq('is_active', true)
    .eq('role', 'teacher')
    .order('full_name_th')
  if (error) throw new Error(`listActiveTeachers: ${error.message}`)
  return data ?? []
}

export async function listAllUsers() {
  const { data, error } = await client()
    .from('users')
    .select('id, line_user_id, full_name_th, national_id, employee_id, department, role, is_active, is_pending, created_at')
    .order('full_name_th')
  if (error) throw new Error(`listAllUsers: ${error.message}`)
  return (data ?? []) as User[]
}

export async function createUser(payload: Record<string, unknown>) {
  const { data, error } = await client()
    .from('users')
    .insert(payload)
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data as User
}

export async function updateUser(id: string, payload: Record<string, unknown>) {
  const { data, error } = await client()
    .from('users')
    .update(payload)
    .eq('id', id)
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data as User
}

export async function deactivateUser(id: string) {
  const { error } = await client()
    .from('users')
    .update({ is_active: false })
    .eq('id', id)
  if (error) throw new Error(error.message)
}

export async function listUsersWithNationalId() {
  const { data } = await client()
    .from('users')
    .select('id, national_id')
    .not('national_id', 'is', null)
  return (data ?? []) as Pick<User, 'id' | 'national_id'>[]
}

export async function getPendingUserProfile(id: string) {
  const { data } = await client()
    .from('users')
    .select('full_name_th, national_id')
    .eq('id', id)
    .single()
  return data as Pick<User, 'full_name_th' | 'national_id'> | null
}

export async function updatePendingUserProfile(
  id: string,
  full_name_th: string,
  national_id: string,
) {
  const { error } = await client()
    .from('users')
    .update({ full_name_th, national_id, is_pending: false, is_active: true })
    .eq('id', id)
    .eq('is_pending', true)
  if (error) throw new Error(error.message)
}

export async function findUserAuthById(id: string) {
  const { data } = await client()
    .from('users')
    .select('id, role, full_name_th, department, is_pending')
    .eq('id', id)
    .single()
  return data as Pick<User, 'id' | 'role' | 'full_name_th' | 'department' | 'is_pending'> | null
}

export async function listActiveTeachersForExport(dept?: string | null) {
  let q = client()
    .from('users')
    .select('id, full_name_th, national_id, employee_id, department')
    .eq('is_active', true)
    .eq('role', 'teacher')
    .order('full_name_th')
  if (dept) q = q.eq('department', dept)
  const { data, error } = await q
  if (error) throw new Error(error.message)
  return data ?? []
}

// ─── Staff whitelist queries ───────────────────────────────────────────────────

/** ตรวจสอบว่า national_id + full_name_th ตรงคู่กันใน whitelist */
export async function checkWhitelist(nationalId: string, fullName: string): Promise<boolean> {
  const { data } = await client()
    .from('staff_whitelist')
    .select('national_id')
    .eq('national_id', nationalId)
    .eq('full_name_th', fullName)
    .maybeSingle()
  return data !== null
}

/** ค้นหาชื่อใน whitelist จากเลขบัตรประชาชน — คืน full_name_th หรือ null */
export async function lookupNameByNationalId(nationalId: string): Promise<string | null> {
  const { data } = await client()
    .from('staff_whitelist')
    .select('full_name_th')
    .eq('national_id', nationalId)
    .maybeSingle()
  return data?.full_name_th ?? null
}

/** ค้นหาชื่อใน whitelist ที่มี q เป็นส่วนหนึ่ง (ส่งคืนแค่ชื่อ ไม่มีเลขบัตร) */
export async function searchWhitelistNames(q: string): Promise<string[]> {
  const { data } = await client()
    .from('staff_whitelist')
    .select('full_name_th')
    .ilike('full_name_th', `%${q}%`)
    .limit(10)
  return (data ?? []).map((r: { full_name_th: string }) => r.full_name_th)
}

// ─── Attendance queries ───────────────────────────────────────────────────────

export async function getTodayRecord(userId: string, date: string) {
  const { data } = await client()
    .from('attendance_records')
    .select('*')
    .eq('user_id', userId)
    .eq('date', date)
    .maybeSingle()
  return (data ?? null) as AttendanceRecord | null
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
  const { data, error } = await client()
    .from('attendance_records')
    .upsert(payload, { onConflict: 'user_id,date' })
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data as AttendanceRecord
}

export async function updateCheckOut(recordId: string, checkOutAt: string) {
  const { data, error } = await client()
    .from('attendance_records')
    .update({ check_out_at: checkOutAt })
    .eq('id', recordId)
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data as AttendanceRecord
}

export async function getTodayRecordsForUsers(date: string, userIds: string[]) {
  if (userIds.length === 0) return [] as AttendanceRecord[]
  const { data } = await client()
    .from('attendance_records')
    .select('*')
    .eq('date', date)
    .in('user_id', userIds)
  return (data ?? []) as AttendanceRecord[]
}

export async function getAttendanceHistory(
  userId: string,
  from?: string | null,
  to?: string | null,
  limit = 90,
) {
  let q = client()
    .from('attendance_records')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: false })
  if (from) q = q.gte('date', from)
  if (to)   q = q.lte('date', to)
  const { data, error } = await q.limit(limit)
  if (error) throw new Error(error.message)
  return (data ?? []) as AttendanceRecord[]
}

export async function getAttendanceForReport(userIds: string[], from: string, to: string) {
  if (userIds.length === 0) return [] as AttendanceRecord[]
  const { data } = await client()
    .from('attendance_records')
    .select('*')
    .gte('date', from)
    .lte('date', to)
    .in('user_id', userIds)
  return (data ?? []) as AttendanceRecord[]
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await client()
    .from('attendance_records')
    .upsert(records as any, { onConflict: 'user_id,date' })
  if (error) throw new Error(error.message)
}
