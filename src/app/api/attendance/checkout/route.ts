import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase'
import { todayDate } from '@/lib/attendance'

// POST /api/attendance/checkout
export async function POST(_req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db   = createServerClient()
  const date = todayDate()
  const now  = new Date()

  const { data: existing } = await db
    .from('attendance_records')
    .select('id, check_in_at, check_out_at')
    .eq('user_id', session.user.id)
    .eq('date', date)
    .maybeSingle()

  if (!existing?.check_in_at) {
    return NextResponse.json({ error: 'not_checked_in' }, { status: 409 })
  }
  if (existing.check_out_at) {
    return NextResponse.json({ error: 'already_checked_out' }, { status: 409 })
  }

  const { data: record, error } = await db
    .from('attendance_records')
    .update({ check_out_at: now.toISOString() })
    .eq('id', existing.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: 'db_error' }, { status: 500 })
  return NextResponse.json({ record, checked_out_at: now.toISOString() })
}
