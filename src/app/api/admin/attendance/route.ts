import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase'
import { todayDate } from '@/lib/attendance'

export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const db   = createServerClient()
  const date = todayDate()

  // Fetch all active teachers
  const { data: users, error: uErr } = await db
    .from('users')
    .select('id, full_name_th, department, role, avatar_url')
    .eq('is_active', true)
    .eq('role', 'teacher')
    .order('full_name_th')

  if (uErr) return NextResponse.json({ error: 'db_error' }, { status: 500 })

  // Fetch today's records for all teachers
  const userIds = (users ?? []).map(u => u.id)
  const { data: records } = await db
    .from('attendance_records')
    .select('*')
    .eq('date', date)
    .in('user_id', userIds)

  const recordMap = Object.fromEntries((records ?? []).map(r => [r.user_id, r]))

  const rows = (users ?? []).map(user => {
    const record = recordMap[user.id] ?? null
    const effectiveStatus = record?.check_in_at
      ? (record.location_mode === 'wfh' ? 'wfh' : record.status)
      : 'not_checked'

    return { user, record, effectiveStatus }
  })

  // Aggregate stats
  const stats = rows.reduce(
    (acc, r) => {
      if (r.effectiveStatus === 'wfh')         acc.wfh++
      else if (r.effectiveStatus === 'present') acc.campus++
      else if (r.effectiveStatus === 'late')    acc.late++
      else                                      acc.absent++
      return acc
    },
    { campus: 0, wfh: 0, late: 0, absent: 0 }
  )

  return NextResponse.json({ date, rows, stats, total: rows.length })
}
