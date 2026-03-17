import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase'
import ExcelJS from 'exceljs'
import { format } from 'date-fns'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const from = searchParams.get('from') ?? format(new Date(), 'yyyy-MM-01')
  const to   = searchParams.get('to')   ?? format(new Date(), 'yyyy-MM-dd')
  const dept = searchParams.get('department')

  const db = createServerClient()

  // Fetch active teachers (optionally filtered by department)
  let userQ = db.from('users').select('id, full_name_th, department').eq('is_active', true).eq('role', 'teacher').order('full_name_th')
  if (dept) userQ = userQ.eq('department', dept)
  const { data: users } = await userQ

  // Fetch attendance in range
  const { data: records } = await db
    .from('attendance_records')
    .select('*')
    .gte('date', from)
    .lte('date', to)
    .in('user_id', (users ?? []).map(u => u.id))

  // Build lookup: userId → date → record
  const lookup: Record<string, Record<string, typeof records[0]>> = {}
  for (const r of records ?? []) {
    if (!lookup[r.user_id]) lookup[r.user_id] = {}
    lookup[r.user_id][r.date] = r
  }

  // Build xlsx
  const wb = new ExcelJS.Workbook()
  wb.creator = 'TOAS'
  const ws = wb.addWorksheet('Attendance')

  ws.columns = [
    { header: 'ชื่อ-นามสกุล',  key: 'name',    width: 28 },
    { header: 'แผนก',          key: 'dept',    width: 18 },
    { header: 'วันที่',          key: 'date',    width: 14 },
    { header: 'สถานที่',        key: 'loc',     width: 12 },
    { header: 'เช็คอิน',        key: 'in',      width: 12 },
    { header: 'เช็คเอาท์',      key: 'out',     width: 12 },
    { header: 'สถานะ',          key: 'status',  width: 14 },
  ]

  // Style header row
  ws.getRow(1).eachCell(cell => {
    cell.font      = { bold: true, color: { argb: 'FFFFFFFF' } }
    cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A237E' } }
    cell.alignment = { vertical: 'middle', horizontal: 'center' }
  })
  ws.getRow(1).height = 22

  const statusLabel: Record<string, string> = {
    present: 'ปกติ', late: 'สาย', absent: 'ไม่มา',
  }

  let rowIdx = 2
  for (const user of users ?? []) {
    // Iterate every date in range
    let cur = new Date(from)
    const end = new Date(to)
    while (cur <= end) {
      const dateStr = format(cur, 'yyyy-MM-dd')
      const rec = lookup[user.id]?.[dateStr]

      const row = ws.addRow({
        name:   user.full_name_th,
        dept:   user.department ?? '-',
        date:   format(cur, 'dd/MM/yyyy'),
        loc:    rec ? (rec.location_mode === 'wfh' ? 'WFH' : 'วิทยาลัย') : '-',
        in:     rec?.check_in_at  ? format(new Date(rec.check_in_at),  'HH:mm') : '-',
        out:    rec?.check_out_at ? format(new Date(rec.check_out_at), 'HH:mm') : '-',
        status: rec ? (statusLabel[rec.status] ?? rec.status) : 'ไม่มีข้อมูล',
      })

      // Colour status cell
      const statusCell = row.getCell('status')
      if (rec?.status === 'present') statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE6F4EA' } }
      if (rec?.status === 'late')    statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF3E0' } }
      if (!rec)                      statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFDECEA' } }

      if (rowIdx % 2 === 0) {
        row.eachCell(cell => {
          if (!cell.fill || (cell.fill as ExcelJS.FillPattern).fgColor?.argb === 'FFFFFFFF') {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8F9FA' } }
          }
        })
      }

      rowIdx++
      cur.setDate(cur.getDate() + 1)
    }
  }

  const buffer = await wb.xlsx.writeBuffer()
  const filename = `attendance_${from}_${to}.xlsx`

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
