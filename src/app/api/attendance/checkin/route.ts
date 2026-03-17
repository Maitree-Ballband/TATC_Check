import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase'
import { checkInSchema, isWithinGeofence, resolveStatus, todayDate } from '@/lib/attendance'

export async function POST(req: NextRequest) {
  // 1. Auth guard
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 2. Validate body
  const body = await req.json()
  const parsed = checkInSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }
  const { location_mode, lat, lng } = parsed.data

  // 3. Geofence check (campus only)
  if (location_mode === 'campus' && lat != null && lng != null) {
    if (!isWithinGeofence(lat, lng)) {
      return NextResponse.json({ error: 'outside_geofence' }, { status: 422 })
    }
  }

  const db   = createServerClient()
  const date = todayDate()

  // 4. Idempotency — reject duplicate check-in same day
  const { data: existing } = await db
    .from('attendance_records')
    .select('id, check_in_at, status')
    .eq('user_id', session.user.id)
    .eq('date', date)
    .maybeSingle()

  if (existing?.check_in_at) {
    return NextResponse.json({ error: 'already_checked_in', record: existing }, { status: 409 })
  }

  // 5. Determine status
  const now    = new Date()
  const status = resolveStatus(now)

  // 6. Upsert record
  const { data: record, error } = await db
    .from('attendance_records')
    .upsert({
      user_id:       session.user.id,
      date,
      check_in_at:   now.toISOString(),
      location_mode,
      check_in_lat:  lat ?? null,
      check_in_lng:  lng ?? null,
      status,
    }, { onConflict: 'user_id,date' })
    .select()
    .single()

  if (error) {
    console.error('[checkin]', error)
    return NextResponse.json({ error: 'db_error' }, { status: 500 })
  }

  return NextResponse.json({ record, status, checked_in_at: now.toISOString() })
}
