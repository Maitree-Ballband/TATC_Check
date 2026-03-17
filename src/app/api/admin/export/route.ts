import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import * as db from '@/lib/db'
import ExcelJS from 'exceljs'
import { format } from 'date-fns'
import { todayDate, formatTimeSchool } from '@/lib/attendance'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const from = searchParams.get('from') ?? todayDate().substring(0, 7) + '-01'
  const to   = searchParams.get('to')   ?? todayDate()
  const dept = searchParams.get('department')

  try {
    const users   = await db.listActiveTeachersForExport(dept)
    const records = await db.getAttendanceForReport(users.map(u => u.id), from, to)

    const lookup: Record<string, Record<string, typeof records[0]>> = {}
    for (const r of records) {
      if (!lookup[r.user_id]) lookup[r.user_id] = {}
      lookup[r.user_id][r.date] = r
    }

    const wb = new ExcelJS.Workbook()
    wb.creator = 'TOAS'
    const ws   = wb.addWorksheet('Attendance')

    ws.columns = [
      { header: 'ลำดับ',          key: 'no',         width: 8  },
      { header: 'ชื่อ-นามสกุล',   key: 'name',       width: 28 },
      { header: 'เลขบัตรประชาชน', key: 'national_id', width: 18 },
      { header: 'รหัสพนักงาน',    key: 'employee_id', width: 14 },
      { header: 'แผนก',           key: 'dept',        width: 18 },
      { header: 'วันที่',          key: 'date',        width: 14 },
      { header: 'เช็คอิน',        key: 'in',          width: 10 },
      { header: 'เช็คเอาท์',      key: 'out',         width: 10 },
      { header: 'สถานะ',          key: 'status',      width: 12 },
      { header: 'สถานที่',        key: 'loc',         width: 10 },
    ]

    ws.getRow(1).eachCell(cell => {
      cell.font      = { bold: true, color: { argb: 'FFFFFFFF' } }
      cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A237E' } }
      cell.alignment = { vertical: 'middle', horizontal: 'center' }
    })
    ws.getRow(1).height = 22

    const statusLabel: Record<string, string> = { present: 'ปกติ', late: 'สาย', absent: 'ไม่มา' }

    let rowIdx = 2
    let no     = 1
    for (const user of users) {
      let cur       = new Date(from)
      const end     = new Date(to)
      while (cur <= end) {
        const dateStr = format(cur, 'yyyy-MM-dd')
        const rec     = lookup[user.id]?.[dateStr]

        const row = ws.addRow({
          no,
          name:        user.full_name_th,
          national_id: user.national_id  ?? '-',
          employee_id: user.employee_id  ?? '-',
          dept:        user.department   ?? '-',
          date:        format(cur, 'dd/MM/yyyy'),
          in:          rec?.check_in_at  ? formatTimeSchool(new Date(rec.check_in_at))  : '-',
          out:         rec?.check_out_at ? formatTimeSchool(new Date(rec.check_out_at)) : '-',
          status:      rec ? (statusLabel[rec.status] ?? rec.status) : 'ไม่มีข้อมูล',
          loc:         rec ? (rec.location_mode === 'wfh' ? 'WFH' : 'วิทยาลัย') : '-',
        })

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

        no++; rowIdx++
        cur.setDate(cur.getDate() + 1)
      }
    }

    const buffer = await wb.xlsx.writeBuffer()
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type':        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="attendance_${from}_${to}.xlsx"`,
      },
    })
  } catch (err) {
    console.error('[export]', err)
    return NextResponse.json({ error: 'db_error' }, { status: 500 })
  }
}
