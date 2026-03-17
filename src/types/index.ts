// ─── Database types (matches Supabase schema) ──────────────

export type Role = 'teacher' | 'admin'
export type LocationMode = 'campus' | 'wfh'
export type AttendanceStatus = 'present' | 'late' | 'absent'

export interface User {
  id: string
  line_user_id: string
  full_name_th: string
  department: string | null
  role: Role
  is_active: boolean
  avatar_url: string | null
  created_at: string
}

export interface AttendanceRecord {
  id: string
  user_id: string
  date: string                  // YYYY-MM-DD
  check_in_at: string | null    // ISO timestamp
  check_out_at: string | null
  location_mode: LocationMode
  check_in_lat: number | null
  check_in_lng: number | null
  status: AttendanceStatus
  created_at: string
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
  effectiveStatus: AttendanceStatus | 'wfh' | 'not_checked'
  locationMode: LocationMode | null
}

export interface DashboardStats {
  campus: number
  wfh: number
  late: number
  absent: number
  total: number
}
