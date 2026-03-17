import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase'
import { todayDate } from '@/lib/attendance'

// GET /api/attendance/today
export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = createServerClient()
  const { data: record } = await db
    .from('attendance_records')
    .select('*')
    .eq('user_id', session.user.id)
    .eq('date', todayDate())
    .maybeSingle()

  return NextResponse.json({
    checked_in:  !!record?.check_in_at,
    checked_out: !!record?.check_out_at,
    record:      record ?? null,
  })
}
