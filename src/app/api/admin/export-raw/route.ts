import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import * as db from '@/lib/db'
import { readFileSync } from 'fs'
import { join } from 'path'

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

function parseCsvTeachers(): Array<{ national_id: string; full_name_th: string }> {
  const csvPath = join(process.cwd(), 'data', 'Listname.csv')
  const raw = readFileSync(csvPath, 'utf-8').replace(/^\uFEFF/, '') // strip BOM
  const lines = raw.split(/\r?\n/).filter(Boolean)
  return lines.slice(1).map(line => {
    const idx = line.indexOf(',')
    if (idx === -1) return null
    return {
      national_id:  line.slice(0, idx).trim(),
      full_name_th: line.slice(idx + 1).trim(),
    }
  }).filter((t): t is { national_id: string; full_name_th: string } =>
    t !== null && t.national_id.length > 0,
  )
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

  // 1. All 212 teachers from CSV (source of truth)
  const allTeachers = parseCsvTeachers()

  // 2. Registered users from DB
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const registeredUsers = await db.listActiveTeachersForExport() as any[]

  // 3. national_id → user_id map
  const nationalIdToUserId = new Map<string, string>()
  for (const u of registeredUsers) {
    if (u.national_id) nationalIdToUserId.set((u.national_id as string).trim(), u.id as string)
  }

  // 4. Attendance records for all registered users in the date range
  const userIds = registeredUsers.filter(u => u.national_id).map(u => u.id as string)
  const records = await db.getAttendanceForReport(userIds, from, to)

  // 5. (user_id:date) → record map
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recordMap = new Map<string, any>()
  for (const rec of records) {
    recordMap.set(`${rec.user_id}:${rec.date}`, rec)
  }

  // 6. All dates in range
  const dates = generateDates(from, to)

  // 7. Output: all dates × all 212 teachers
  const lines: string[] = []

  for (const dateStr of dates) {
    for (const teacher of allTeachers) {
      const { national_id, full_name_th: name } = teacher
      const userId = nationalIdToUserId.get(national_id)
      const rec    = userId ? recordMap.get(`${userId}:${dateStr}`) : undefined
      const date   = toDDMMYYYY(dateStr)

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

        // No filter: always include all 212 teachers (even with no record)
        lines.push(`${national_id},${date},${inTime},${outTime},${name}`)
      }
    }
  }

  const bom     = fmt === 'csv' ? '\uFEFF' : ''
  const content = bom + lines.join('\r\n')
  const filename    = `attendance_${from}_${to}.${fmt}`
  const contentType = fmt === 'csv' ? 'text/csv; charset=utf-8' : 'text/plain; charset=utf-8'

  return new NextResponse(content, {
    headers: {
      'Content-Type':        contentType,
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
