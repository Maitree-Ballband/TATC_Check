import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import * as db from '@/lib/db'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const from = searchParams.get('from')
  const to   = searchParams.get('to')

  try {
    const records = await db.getAttendanceHistory(session.user.id, from, to)
    return NextResponse.json({ records })
  } catch (err) {
    console.error('[history]', err)
    return NextResponse.json({ error: 'db_error' }, { status: 500 })
  }
}
