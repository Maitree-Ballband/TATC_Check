import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import * as db from '@/lib/db'

export const dynamic = 'force-dynamic'

const SCHOOL_TZ = process.env.NEXT_PUBLIC_SCHOOL_TZ ?? 'Asia/Bangkok'

function extractHHMMSS(isoStr: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: SCHOOL_TZ,
    hour:   '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(new Date(isoStr))
}

function toDDMMYYYY(dateStr: string): string {
  const [y, m, d] = dateStr.split('-')
  return `${d}/${m}/${y}`
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const sp = req.nextUrl.searchParams
  const from        = sp.get('from')        ?? ''
  const to          = sp.get('to')          ?? ''
  const timeInFrom  = sp.get('timeInFrom')  ?? ''  // HH:MM
  const timeInTo    = sp.get('timeInTo')    ?? ''  // HH:MM
  const timeOutFrom = sp.get('timeOutFrom') ?? ''  // HH:MM
  const timeOutTo   = sp.get('timeOutTo')   ?? ''  // HH:MM
  const fmt         = sp.get('format') === 'txt' ? 'txt' : 'csv'

  if (!from || !to) {
    return NextResponse.json({ error: 'Missing date range' }, { status: 400 })
  }

  const filterIn  = !!(timeInFrom  && timeInTo)
  const filterOut = !!(timeOutFrom && timeOutTo)

  const users = await db.listActiveTeachersForExport()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userMap = new Map<string, { national_id: string; name: string }>(
    users
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter((u: any) => u.national_id)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((u: any) => [u.id, { national_id: u.national_id as string, name: u.full_name_th as string }]),
  )

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const records = await db.getAttendanceForReport(users.map((u: any) => u.id), from, to)

  const sep = fmt === 'csv' ? ',' : ' '
  const lines: string[] = []

  for (const rec of records) {
    const info = userMap.get(rec.user_id)
    if (!info) continue

    const { national_id, name } = info
    const dateStr = toDDMMYYYY(rec.date)

    // ── Check-in filter active ─────────────────────────────
    if (filterIn && rec.check_in_at) {
      const hhmmss = extractHHMMSS(rec.check_in_at)
      const hhmm   = hhmmss.slice(0, 5)
      if (hhmm >= timeInFrom && hhmm <= timeInTo) {
        lines.push([national_id, dateStr, hhmmss, name].join(sep))
      }
    }

    // ── Check-out filter active ────────────────────────────
    if (filterOut && rec.check_out_at) {
      const hhmmss = extractHHMMSS(rec.check_out_at)
      const hhmm   = hhmmss.slice(0, 5)
      if (hhmm >= timeOutFrom && hhmm <= timeOutTo) {
        lines.push([national_id, dateStr, hhmmss, name].join(sep))
      }
    }

    // ── No filter → export both check-in AND check-out ────
    if (!filterIn && !filterOut) {
      if (rec.check_in_at) {
        const hhmmss = extractHHMMSS(rec.check_in_at)
        lines.push([national_id, dateStr, hhmmss, name].join(sep))
      }
      if (rec.check_out_at) {
        const hhmmss = extractHHMMSS(rec.check_out_at)
        lines.push([national_id, dateStr, hhmmss, name].join(sep))
      }
    }
  }

  const content     = lines.join('\r\n')
  const filename    = `attendance_${from}_${to}.${fmt}`
  const contentType = fmt === 'csv' ? 'text/csv; charset=utf-8' : 'text/plain; charset=utf-8'

  return new NextResponse(content, {
    headers: {
      'Content-Type':        contentType,
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
