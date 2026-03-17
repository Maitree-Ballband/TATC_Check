import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import * as db from '@/lib/db'
import { todayDate } from '@/lib/attendance'

export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const record = await db.getTodayRecord(session.user.id, todayDate())
  return NextResponse.json({
    checked_in:  !!record?.check_in_at,
    checked_out: !!record?.check_out_at,
    record:      record ?? null,
  })
}
