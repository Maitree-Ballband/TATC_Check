import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import * as db from '@/lib/db'
import { checkInSchema, isWithinGeofence, isPastAbsentCutoff, resolveStatus, todayDate } from '@/lib/attendance'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body   = await req.json()
  const parsed = checkInSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }
  const { location_mode, lat, lng } = parsed.data

  if (location_mode === 'campus' && lat != null && lng != null) {
    if (!isWithinGeofence(lat, lng)) {
      return NextResponse.json({ error: 'outside_geofence' }, { status: 422 })
    }
  }

  const date = todayDate()

  // Idempotency — reject duplicate check-in same day
  const existing = await db.getTodayRecord(session.user.id, date)
  if (existing?.check_in_at) {
    return NextResponse.json({ error: 'already_checked_in', record: existing }, { status: 409 })
  }

  // Past noon without a check-in → absent, block further check-in
  if (isPastAbsentCutoff()) {
    return NextResponse.json({ error: 'absent' }, { status: 403 })
  }

  const now    = new Date()
  const status = resolveStatus(now)

  try {
    const record = await db.upsertCheckIn({
      user_id:       session.user.id,
      date,
      check_in_at:   now.toISOString(),
      location_mode,
      check_in_lat:  lat ?? null,
      check_in_lng:  lng ?? null,
      status,
    })
    return NextResponse.json({ record, status, checked_in_at: now.toISOString() })
  } catch (err) {
    console.error('[checkin]', err)
    return NextResponse.json({ error: 'db_error' }, { status: 500 })
  }
}
