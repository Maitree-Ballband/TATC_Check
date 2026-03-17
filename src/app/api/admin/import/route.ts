import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import * as db from '@/lib/db'
import { resolveStatus } from '@/lib/attendance'

// CSV format: national_id, date (MM/DD/YYYY or DD/MM/YYYY), time (HH:MM:SS), ...
// First scan of the day = check-in, last scan = check-out

function parseDate(raw: string): string | null {
  const parts = raw.trim().split('/')
  if (parts.length !== 3) return null
  const [a, b, y] = parts.map(Number)
  // If first part > 12 it must be DD/MM/YYYY
  const [month, day] = a > 12 ? [b, a] : [a, b]
  if (isNaN(month) || isNaN(day) || isNaN(y)) return null
  return `${y}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const formData = await req.formData()
  const file     = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'no_file' }, { status: 400 })

  const text  = await file.text()
  const lines = text.split(/\r?\n/).filter(l => l.trim())

  const users        = await db.listUsersWithNationalId()
  const nationalIdMap: Record<string, string> = {}
  for (const u of users) {
    if (u.national_id) nationalIdMap[u.national_id.trim()] = u.id
  }

  type ScanEntry = { datetime: Date }
  const grouped: Record<string, Record<string, ScanEntry[]>> = {}
  let skipped = 0

  for (const line of lines) {
    const cols = line.split(',')
    if (cols.length < 3) { skipped++; continue }

    const nationalId = cols[0].trim()
    const dateStr    = parseDate(cols[1].trim())
    const timeStr    = cols[2].trim()

    if (!nationalId || !dateStr || !timeStr) { skipped++; continue }
    const userId = nationalIdMap[nationalId]
    if (!userId) { skipped++; continue }

    const [hh, mm, ss] = timeStr.split(':').map(Number)
    const dt = new Date(
      `${dateStr}T${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}:${String(ss ?? 0).padStart(2,'0')}`,
    )

    if (!grouped[userId])          grouped[userId] = {}
    if (!grouped[userId][dateStr]) grouped[userId][dateStr] = []
    grouped[userId][dateStr].push({ datetime: dt })
  }

  const upserts = []
  for (const [userId, dates] of Object.entries(grouped)) {
    for (const [date, scans] of Object.entries(dates)) {
      scans.sort((a, b) => a.datetime.getTime() - b.datetime.getTime())
      const checkIn  = scans[0].datetime
      const checkOut = scans.length > 1 ? scans[scans.length - 1].datetime : null
      upserts.push({
        user_id:       userId,
        date,
        check_in_at:   checkIn.toISOString(),
        check_out_at:  checkOut?.toISOString() ?? null,
        location_mode: 'campus',
        status:        resolveStatus(checkIn),
      })
    }
  }

  if (upserts.length === 0) {
    return NextResponse.json({
      imported: 0,
      skipped,
      message: 'ไม่พบข้อมูลที่ตรงกัน ตรวจสอบเลขบัตรประชาชนในระบบ',
    })
  }

  try {
    await db.upsertAttendanceBatch(upserts)
    return NextResponse.json({ imported: upserts.length, skipped })
  } catch (err) {
    console.error('[import]', err)
    return NextResponse.json({ error: 'db_error' }, { status: 500 })
  }
}
