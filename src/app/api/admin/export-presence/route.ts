import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import * as db from '@/lib/db'
import ExcelJS from 'exceljs'
import { isPastHardAbsentCutoff } from '@/lib/attendance'

export const dynamic = 'force-dynamic'

const SCHOOL_TZ = process.env.NEXT_PUBLIC_SCHOOL_TZ ?? 'Asia/Bangkok'

function fmtTime(isoStr: string): string {
  return new Intl.DateTimeFormat('th-TH', {
    timeZone: SCHOOL_TZ, hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(new Date(isoStr))
}

const STATUS_LABEL: Record<string, string> = {
  present: 'วิทยาลัย', wfh: 'WFH', late: 'สาย', wfh_late: 'สาย',
  absent: 'ขาด', not_checked: 'ยังไม่มา', not_registered: 'ยังไม่ลงทะเบียน',
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || (session.user.role !== 'admin' && session.user.role !== 'executive')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const date = req.nextUrl.searchParams.get('date') ?? ''
  if (!date) return NextResponse.json({ error: 'Missing date' }, { status: 400 })

  // All staff from whitelist (same source as presence page) — includes unregistered
  const staff = await db.listAllStaffForPresence()
  const registeredIds = staff.filter(s => s.is_registered).map(s => s.id)
  const records = await db.getTodayRecordsForUsers(date, registeredIds)
  const recMap  = Object.fromEntries(records.map(r => [r.user_id, r]))

  const hardCutoff = isPastHardAbsentCutoff()

  const wb = new ExcelJS.Workbook()
  wb.creator = 'TOAS'
  const ws = wb.addWorksheet('สถานะการเข้างาน')

  ws.columns = [
    { header: 'ลำดับ',        key: 'no',       width: 8  },
    { header: 'ชื่อ-สกุล',    key: 'name',     width: 30 },
    { header: 'แผนก',         key: 'dept',     width: 20 },
    { header: 'เวลาเข้างาน',  key: 'checkIn',  width: 14 },
    { header: 'สถานที่เข้า',  key: 'locIn',    width: 14 },
    { header: 'เวลาออกงาน',   key: 'checkOut', width: 14 },
    { header: 'สถานที่ออก',   key: 'locOut',   width: 14 },
    { header: 'สถานะ',        key: 'status',   width: 16 },
  ]

  staff.forEach((s, i) => {
    const r   = s.is_registered ? recMap[s.id] : undefined
    const es  = s.is_registered
      ? (r?.check_in_at
          ? (r.location_mode === 'wfh' ? (r.status === 'late' ? 'wfh_late' : 'wfh') : r.status)
          : hardCutoff ? 'absent' : 'not_checked')
      : 'not_registered'
    const locInLabel  = r?.location_mode === 'wfh' ? 'WFH' : r?.location_mode === 'campus' ? 'วิทยาลัย' : ''
    const locOutLabel = r?.check_out_location_mode === 'wfh' ? 'WFH'
      : r?.check_out_location_mode === 'campus' ? 'วิทยาลัย'
      : locInLabel

    ws.addRow({
      no:       i + 1,
      name:     s.full_name_th,
      dept:     s.department ?? '',
      checkIn:  r?.check_in_at  ? fmtTime(r.check_in_at)  : '',
      locIn:    r?.check_in_at  ? locInLabel : '',
      checkOut: r?.check_out_at ? fmtTime(r.check_out_at) : '',
      locOut:   r?.check_out_at ? locOutLabel : '',
      status:   STATUS_LABEL[es as string] ?? (es as string),
    })
  })

  // Style header row
  const headerRow = ws.getRow(1)
  headerRow.font = { bold: true, size: 11 }
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE5E7EB' } }
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' }
  headerRow.height = 20

  // Freeze top row
  ws.views = [{ state: 'frozen', ySplit: 1 }]

  // Add date label in a merged cell above table
  ws.spliceRows(1, 0, [`วันที่: ${new Date(date + 'T00:00:00').toLocaleDateString('th-TH', { timeZone: SCHOOL_TZ, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}`])
  ws.mergeCells(1, 1, 1, 8)
  const titleRow = ws.getRow(1)
  titleRow.font = { bold: true, size: 12 }
  titleRow.alignment = { vertical: 'middle', horizontal: 'left' }
  titleRow.height = 22

  const buffer    = await wb.xlsx.writeBuffer()
  const dateLabel = date.replace(/-/g, '')

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="presence_${dateLabel}.xlsx"`,
    },
  })
}
