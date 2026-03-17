import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import * as db from '@/lib/db'
import { todayDate } from '@/lib/attendance'

export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const date    = todayDate()
    const users   = await db.listActiveTeachers()
    const userIds = users.map(u => u.id)
    const records = await db.getTodayRecordsForUsers(date, userIds)

    const recordMap = Object.fromEntries(records.map(r => [r.user_id, r]))

    const rows = users.map(user => {
      const record = recordMap[user.id] ?? null
      let effectiveStatus: string = 'not_checked'
      if (record?.check_in_at) {
        effectiveStatus = record.location_mode === 'wfh'
          ? (record.status === 'late' ? 'wfh_late' : 'wfh')
          : record.status
      }
      return { user, record, effectiveStatus }
    })

    const stats = rows.reduce(
      (acc, r) => {
        if      (r.effectiveStatus === 'wfh')      acc.wfh++
        else if (r.effectiveStatus === 'wfh_late') { acc.wfh++; acc.late++ }
        else if (r.effectiveStatus === 'present')  acc.campus++
        else if (r.effectiveStatus === 'late')     acc.late++
        else                                       acc.absent++
        return acc
      },
      { campus: 0, wfh: 0, late: 0, absent: 0 },
    )

    return NextResponse.json({ date, rows, stats, total: rows.length })
  } catch (err) {
    console.error('[admin/attendance]', err)
    return NextResponse.json({ error: 'db_error' }, { status: 500 })
  }
}
