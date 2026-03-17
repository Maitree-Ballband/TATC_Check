import { format } from 'date-fns'
import type { AttendanceStatus, LocationMode } from '@/types'

// ── Geofence ─────────────────────────────────────────────────

const SCHOOL_LAT  = parseFloat(process.env.NEXT_PUBLIC_SCHOOL_LAT  ?? '13.736717')
const SCHOOL_LNG  = parseFloat(process.env.NEXT_PUBLIC_SCHOOL_LNG  ?? '100.523186')
const RADIUS_M    = parseFloat(process.env.NEXT_PUBLIC_GEOFENCE_RADIUS ?? '300')

/** Haversine distance in metres */
export function distanceMetres(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export function isWithinGeofence(lat: number, lng: number): boolean {
  return distanceMetres(lat, lng, SCHOOL_LAT, SCHOOL_LNG) <= RADIUS_M
}

// ── Attendance business rules ─────────────────────────────────

const CUTOFF = process.env.NEXT_PUBLIC_CHECKIN_CUTOFF ?? '08:30'   // HH:mm

export function resolveStatus(checkInAt: Date): AttendanceStatus {
  const [cutH, cutM] = CUTOFF.split(':').map(Number)
  const cutoff = new Date(checkInAt)
  cutoff.setHours(cutH, cutM, 0, 0)
  return checkInAt <= cutoff ? 'present' : 'late'
}

export function todayDate(): string {
  return format(new Date(), 'yyyy-MM-dd')
}

// ── Validation schemas (used in API routes) ──────────────────
import { z } from 'zod'

export const checkInSchema = z.object({
  location_mode: z.enum(['campus', 'wfh']),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
}).refine(
  (d) => d.location_mode === 'wfh' || (d.lat != null && d.lng != null),
  { message: 'campus mode requires lat/lng' }
)
