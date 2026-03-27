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

function generateDates(from: string, to: string): string[] {
  const dates: string[] = []
  const cur = new Date(from + 'T00:00:00Z')
  const end = new Date(to   + 'T00:00:00Z')
  while (cur <= end) {
    dates.push(cur.toISOString().slice(0, 10))
    cur.setUTCDate(cur.getUTCDate() + 1)
  }
  return dates
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || (session.user.role !== 'admin' && session.user.role !== 'executive')) {
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

  try {
    const filterIn  = !!(timeInFrom  && timeInTo)
    const filterOut = !!(timeOutFrom && timeOutTo)

    // 1. All staff from whitelist (same source as presence page)
    const staff = await db.listAllStaffForPresence()

    // 2. Attendance records for registered users in the date range
    const registeredIds = staff.filter(s => s.is_registered).map(s => s.id)
    const records = await db.getAttendanceForReport(registeredIds, from, to)

    // 3. (user_id:date) → record map
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const recordMap = new Map<string, any>()
    for (const rec of records) {
      recordMap.set(`${rec.user_id}:${rec.date}`, rec)
    }

    // 4. All dates in range
    const dates = generateDates(from, to)

    // 5. Output: all dates × all staff
    const lines: string[] = []

    for (const dateStr of dates) {
      for (const s of staff) {
        const { national_id, full_name_th: name, id, is_registered } = s
        const rec  = is_registered ? recordMap.get(`${id}:${dateStr}`) : undefined
        const date = toDDMMYYYY(dateStr)

        if (filterIn && !filterOut) {
          // ── Check-in filter only ─────────────────────────────────────
          if (!rec?.check_in_at) continue
          const hhmmss = extractHHMMSS(rec.check_in_at)
          if (hhmmss.slice(0, 5) < timeInFrom || hhmmss.slice(0, 5) > timeInTo) continue
          lines.push(`${national_id},${date},${hhmmss},${name}`)

        } else if (!filterIn && filterOut) {
          // ── Check-out filter only ────────────────────────────────────
          if (!rec?.check_out_at) continue
          const hhmmss = extractHHMMSS(rec.check_out_at)
          if (hhmmss.slice(0, 5) < timeOutFrom || hhmmss.slice(0, 5) > timeOutTo) continue
          lines.push(`${national_id},${date},${hhmmss},${name}`)

        } else {
          // ── No filter OR both filters → national_id,date,in,out,name ─
          let inTime  = ''
          let outTime = ''

          if (rec?.check_in_at) {
            const hhmmss = extractHHMMSS(rec.check_in_at)
            if (!filterIn || (hhmmss.slice(0, 5) >= timeInFrom && hhmmss.slice(0, 5) <= timeInTo)) {
              inTime = hhmmss
            }
          }
          if (rec?.check_out_at) {
            const hhmmss = extractHHMMSS(rec.check_out_at)
            if (!filterOut || (hhmmss.slice(0, 5) >= timeOutFrom && hhmmss.slice(0, 5) <= timeOutTo)) {
              outTime = hhmmss
            }
          }

          // When both filters active, require both to match
          if (filterIn && filterOut && (!inTime || !outTime)) continue

          // No filter: always include all staff (even with no record)
          lines.push(`${national_id},${date},${inTime},${outTime},${name}`)
        }
      }
    }

    const bom         = fmt === 'csv' ? '\uFEFF' : ''
    const content     = bom + lines.join('\r\n')
    const filename    = `attendance_${from}_${to}.${fmt}`
    const contentType = fmt === 'csv' ? 'text/csv; charset=utf-8' : 'text/plain; charset=utf-8'

    return new NextResponse(content, {
      headers: {
        'Content-Type':        contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (err) {
    console.error('[export-raw]', err)
    return NextResponse.json({ error: 'Export failed', detail: String(err) }, { status: 500 })
  }
}
