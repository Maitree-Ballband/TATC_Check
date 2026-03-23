import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import * as db from '@/lib/db'
import { todayDate, currentTimeMinutes } from '@/lib/attendance'

export async function POST(_req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const date     = todayDate()
  const existing = await db.getTodayRecord(session.user.id, date)

  if (!existing?.check_in_at) {
    return NextResponse.json({ error: 'not_checked_in' }, { status: 409 })
  }

  const cutoff       = process.env.NEXT_PUBLIC_CHECKOUT_AVAILABLE_AFTER ?? '16:30'
  const [cutH, cutM] = cutoff.split(':').map(Number)
  // currentTimeMinutes() uses school timezone — correct regardless of server UTC offset
  if (currentTimeMinutes() < cutH * 60 + cutM) {
    return NextResponse.json({ error: 'too_early', available_after: cutoff }, { status: 422 })
  }

  try {
    const record = await db.updateCheckOut(existing.id, new Date().toISOString())
    return NextResponse.json({ record, checked_out_at: record.check_out_at })
  } catch (err) {
    console.error('[checkout]', err)
    return NextResponse.json({ error: 'db_error' }, { status: 500 })
  }
}
