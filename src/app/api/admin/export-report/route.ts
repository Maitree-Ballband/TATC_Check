import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import * as db from '@/lib/db'
import ExcelJS from 'exceljs'
import { differenceInCalendarDays, parseISO } from 'date-fns'

export const dynamic = 'force-dynamic'

const SCHOOL_TZ = process.env.NEXT_PUBLIC_SCHOOL_TZ ?? 'Asia/Bangkok'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const from = req.nextUrl.searchParams.get('from') ?? ''
  const to   = req.nextUrl.searchParams.get('to')   ?? ''
  if (!from || !to) return NextResponse.json({ error: 'Missing from/to' }, { status: 400 })

  const daysInRange = differenceInCalendarDays(parseISO(to), parseISO(from)) + 1

  const users   = await db.listActiveTeachers()
  const records = await db.getAttendanceForReport(users.map(u => u.id), from, to)

  const summaries = users.map(u => {
    const recs   = records.filter(r => r.user_id === u.id)
    const campus = recs.filter(r => r.location_mode === 'campus' && r.check_in_at).length
    const wfh    = recs.filter(r => r.location_mode === 'wfh'    && r.check_in_at).length
    const worked = campus + wfh
    const rate   = Math.round(worked / daysInRange * 100)
    return { user: u, campus, wfh, worked, rate }
  })

  const rangeLabel = `${new Date(from + 'T00:00:00').toLocaleDateString('th-TH', { timeZone: SCHOOL_TZ, day: 'numeric', month: 'long', year: 'numeric' })} – ${new Date(to + 'T00:00:00').toLocaleDateString('th-TH', { timeZone: SCHOOL_TZ, day: 'numeric', month: 'long', year: 'numeric' })}`

  const wb = new ExcelJS.Workbook()
  wb.creator = 'TOAS'
  const ws = wb.addWorksheet('ภาพรวมประจำเดือน')

  ws.columns = [
    { header: 'ลำดับ',        key: 'no',      width: 8  },
    { header: 'ชื่อ-สกุล',    key: 'name',    width: 30 },
    { header: 'แผนก',         key: 'dept',    width: 20 },
    { header: 'วิทยาลัย (วัน)', key: 'campus', width: 16 },
    { header: 'WFH (วัน)',    key: 'wfh',     width: 12 },
    { header: 'รวมมา (วัน)',  key: 'worked',  width: 14 },
    { header: 'อัตรา (%)',    key: 'rate',    width: 12 },
  ]

  summaries.forEach((s, i) => {
    ws.addRow({
      no:     i + 1,
      name:   s.user.full_name_th,
      dept:   s.user.department ?? '',
      campus: s.campus,
      wfh:    s.wfh,
      worked: s.worked,
      rate:   s.rate,
    })
  })

  // Style header row
  const headerRow = ws.getRow(1)
  headerRow.font      = { bold: true, size: 11 }
  headerRow.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE5E7EB' } }
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' }
  headerRow.height    = 20

  // Freeze top row
  ws.views = [{ state: 'frozen', ySplit: 1 }]

  // Insert title row above header
  ws.spliceRows(1, 0, [`ภาพรวมประจำเดือน: ${rangeLabel}  (${daysInRange} วันปฏิทิน)`])
  ws.mergeCells(1, 1, 1, 7)
  const titleRow      = ws.getRow(1)
  titleRow.font       = { bold: true, size: 12 }
  titleRow.alignment  = { vertical: 'middle', horizontal: 'left' }
  titleRow.height     = 22

  const buffer    = await wb.xlsx.writeBuffer()
  const fileLabel = `report_${from.replace(/-/g, '')}_${to.replace(/-/g, '')}`

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${fileLabel}.xlsx"`,
    },
  })
}
