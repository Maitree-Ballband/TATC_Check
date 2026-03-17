// ─── Database types (matches Supabase schema) ──────────────

export type Role = 'teacher' | 'admin' | 'executive'
export type LocationMode = 'campus' | 'wfh'

/** Values actually stored in the DB — 'absent' is never written, only computed for display */
export type StoredAttendanceStatus = 'present' | 'late'

/** Full set used in UI/API responses (includes computed states) */
export type AttendanceStatus = StoredAttendanceStatus | 'absent'

export interface User {
  id: string
  line_user_id: string
  full_name_th: string
  department: string | null
  national_id: string | null
  employee_id: string | null
  role: Role
  is_active: boolean
  is_pending: boolean
  avatar_url: string | null
  created_at: string
}

export interface AttendanceRecord {
  id: string
  user_id: string
  date: string                        // YYYY-MM-DD
  check_in_at: string | null          // ISO timestamp (UTC)
  check_out_at: string | null         // ISO timestamp (UTC)
  location_mode: LocationMode
  check_in_lat: number | null         // null for WFH records
  check_in_lng: number | null         // null for WFH records
  status: StoredAttendanceStatus      // only 'present' | 'late' — never 'absent' in DB
  selfie_url: string | null
  created_at: string
  updated_at: string                  // auto-updated by DB trigger on checkout
}

// ─── API request / response types ──────────────────────────

export interface CheckInRequest {
  location_mode: LocationMode
  lat?: number
  lng?: number
}

export interface CheckInResponse {
  record: AttendanceRecord
  status: AttendanceStatus      // 'present' | 'late'
  checked_in_at: string
}

export interface TodayStatus {
  checked_in: boolean
  checked_out: boolean
  record: AttendanceRecord | null
}

export interface AdminAttendanceRow {
  user: User
  record: AttendanceRecord | null
  status: AttendanceStatus | 'not_checked'
}

export interface ExportQuery {
  from: string   // YYYY-MM-DD
  to: string     // YYYY-MM-DD
  department?: string
}

// ─── UI / component types ──────────────────────────────────

export interface PresenceCard {
  user: User
  record: AttendanceRecord | null
  effectiveStatus: AttendanceStatus | 'wfh' | 'wfh_late' | 'not_checked'
  locationMode: LocationMode | null
}

export interface DashboardStats {
  campus: number
  wfh: number
  late: number
  absent: number
  total: number
}
