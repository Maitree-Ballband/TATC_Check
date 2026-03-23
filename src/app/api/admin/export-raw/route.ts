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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const users = await db.listActiveTeachersForExport()
  const userMap = new Map<string, { national_id: string; name: string }>(
    users
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter((u: any) => u.national_id)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((u: any) => [u.id, { national_id: u.national_id as string, name: u.full_name_th as string }]),
  )

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const records = await db.getAttendanceForReport(users.map((u: any) => u.id), from, to)

  const lines: string[] = []

  for (const rec of records) {
    const info = userMap.get(rec.user_id)
    if (!info) continue

    const { national_id, name } = info
    const dateStr = toDDMMYYYY(rec.date)

    if (filterIn && !filterOut) {
      // ── Check-in filter only → show เข้า time ───────────────
      if (!rec.check_in_at) continue
      const hhmmss = extractHHMMSS(rec.check_in_at)
      if (hhmmss.slice(0, 5) < timeInFrom || hhmmss.slice(0, 5) > timeInTo) continue
      lines.push(`${national_id},${dateStr}, เข้า${hhmmss} ,${name}`)

    } else if (!filterIn && filterOut) {
      // ── Check-out filter only → show ออก time ───────────────
      if (!rec.check_out_at) continue
      const hhmmss = extractHHMMSS(rec.check_out_at)
      if (hhmmss.slice(0, 5) < timeOutFrom || hhmmss.slice(0, 5) > timeOutTo) continue
      lines.push(`${national_id},${dateStr}, ออก${hhmmss} ,${name}`)

    } else {
      // ── No filter OR both filters → show เข้า + ออก ─────────
      let inTime  = ''
      let outTime = ''

      if (rec.check_in_at) {
        const hhmmss = extractHHMMSS(rec.check_in_at)
        // If filterIn is active, check the time range; otherwise always include
        if (!filterIn || (hhmmss.slice(0, 5) >= timeInFrom && hhmmss.slice(0, 5) <= timeInTo)) {
          inTime = hhmmss
        }
      }

      if (rec.check_out_at) {
        const hhmmss = extractHHMMSS(rec.check_out_at)
        if (!filterOut || (hhmmss.slice(0, 5) >= timeOutFrom && hhmmss.slice(0, 5) <= timeOutTo)) {
          outTime = hhmmss
        }
      }

      // When both filters active, require both to match
      if (filterIn && filterOut && (!inTime || !outTime)) continue
      if (!inTime && !outTime) continue

      if (inTime && outTime) {
        lines.push(`${national_id},${dateStr}, เข้า${inTime}, ออก${outTime} ,${name}`)
      } else if (inTime) {
        lines.push(`${national_id},${dateStr}, เข้า${inTime} ,${name}`)
      } else {
        lines.push(`${national_id},${dateStr}, ออก${outTime} ,${name}`)
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
