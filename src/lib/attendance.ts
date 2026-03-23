import { z } from 'zod'
import type { AttendanceStatus } from '@/types'

// ── School timezone ────────────────────────────────────────────
// All date/time logic must operate in school local time, NOT server UTC.

const SCHOOL_TZ          = process.env.NEXT_PUBLIC_SCHOOL_TZ                ?? 'Asia/Bangkok'
const CUTOFF             = process.env.NEXT_PUBLIC_CHECKIN_CUTOFF           ?? '08:00'  // HH:mm
const ABSENT_CUTOFF      = process.env.NEXT_PUBLIC_ABSENT_CUTOFF            ?? '12:00'  // HH:mm — after this, reason required
const HARD_ABSENT_CUTOFF = process.env.NEXT_PUBLIC_CHECKOUT_AVAILABLE_AFTER ?? '16:30'  // HH:mm — after this, no check-in = absent

// ── Geofence ───────────────────────────────────────────────────

const SCHOOL_LAT = parseFloat(process.env.NEXT_PUBLIC_SCHOOL_LAT  ?? '13.736717')
const SCHOOL_LNG = parseFloat(process.env.NEXT_PUBLIC_SCHOOL_LNG  ?? '100.523186')
const RADIUS_M   = parseFloat(process.env.NEXT_PUBLIC_GEOFENCE_RADIUS ?? '500')

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

// ── Internal timezone helper ───────────────────────────────────

function schoolHM(date: Date): { h: number; m: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: SCHOOL_TZ,
    hour:     '2-digit',
    minute:   '2-digit',
    hour12:   false,
  }).formatToParts(date)
  const get = (type: string) => parseInt(parts.find(p => p.type === type)!.value)
  return { h: get('hour') % 24, m: get('minute') }  // % 24 handles '24' returned for midnight
}

// ── Attendance business rules ──────────────────────────────────

/**
 * Returns today's date as YYYY-MM-DD in the school's local timezone.
 * Using sv-SE locale because it formats as YYYY-MM-DD by default.
 */
export function todayDate(): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: SCHOOL_TZ }).format(new Date())
}

/**
 * Determines 'present' or 'late' based on the school's cutoff time.
 * checkInAt should be a UTC Date (as returned by new Date()).
 */
export function resolveStatus(checkInAt: Date): AttendanceStatus {
  const [cutH, cutM] = CUTOFF.split(':').map(Number)
  const { h, m } = schoolHM(checkInAt)
  return h * 60 + m <= cutH * 60 + cutM ? 'present' : 'late'
}

/**
 * Returns true when the current school-local time is past ABSENT_CUTOFF (default 12:00).
 * Check-ins after this time require a late reason.
 */
export function isPastAbsentCutoff(): boolean {
  const [cutH, cutM] = ABSENT_CUTOFF.split(':').map(Number)
  const { h, m } = schoolHM(new Date())
  return h * 60 + m > cutH * 60 + cutM
}

/**
 * Returns true when the current school-local time is past HARD_ABSENT_CUTOFF (default 16:30).
 * After this time, check-in is blocked completely and the teacher is marked absent.
 */
export function isPastHardAbsentCutoff(): boolean {
  const [cutH, cutM] = HARD_ABSENT_CUTOFF.split(':').map(Number)
  const { h, m } = schoolHM(new Date())
  return h * 60 + m >= cutH * 60 + cutM
}

/**
 * Returns current time as total minutes since midnight in school timezone.
 * Used by checkout to check if it's past the checkout cutoff.
 */
export function currentTimeMinutes(): number {
  const { h, m } = schoolHM(new Date())
  return h * 60 + m
}

/**
 * Formats a Date as HH:mm in school timezone.
 * Use this instead of date-fns format() for any time displayed to users.
 */
export function formatTimeSchool(date: Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: SCHOOL_TZ,
    hour:     '2-digit',
    minute:   '2-digit',
    hour12:   false,
  }).format(date)
}

// ── Validation schemas (used in API routes) ───────────────────

export const checkInSchema = z.object({
  location_mode: z.enum(['campus', 'wfh']),
  lat:    z.number().min(-90).max(90).optional(),
  lng:    z.number().min(-180).max(180).optional(),
  reason: z.string().min(10).max(500).optional(),
}).refine(
  (d) => d.location_mode === 'wfh' || (d.lat != null && d.lng != null),
  { message: 'campus mode requires lat/lng' }
)
