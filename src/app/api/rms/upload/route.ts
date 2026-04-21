import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/lib/postgres'

export const dynamic = 'force-dynamic'

const SCHOOL_TZ  = process.env.NEXT_PUBLIC_SCHOOL_TZ ?? 'Asia/Bangkok'
const API_SECRET = process.env.RMS_API_SECRET ?? ''
const RMS_BASE   = 'https://rms.tatc.ac.th/index.php'
const RMS_USER   = process.env.RMS_USERNAME ?? ''
const RMS_PASS   = process.env.RMS_PASSWORD ?? ''

// ─── Helpers ──────────────────────────────────────────────────
function todayInTZ(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: SCHOOL_TZ,
    year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
}

function toDDMMYYYY(d: string): string {
  const [y, m, day] = d.split('-')
  return `${day}/${m}/${y}`
}

function extractTime(iso: string): string {
  return new Intl.DateTimeFormat('en-GB', { timeZone: SCHOOL_TZ,
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(new Date(iso))
}

// ─── DB Query ─────────────────────────────────────────────────
async function fetchRecords(mode: 'checkin' | 'checkout') {
  const today = todayInTZ()
  const col   = mode === 'checkin' ? 'check_in_at' : 'check_out_at'

  const { rows } = await pool.query(`
    SELECT u.national_id, ar.${col} AS ts, u.full_name_th
    FROM attendance_records ar
    JOIN users u ON u.id = ar.user_id
    WHERE ar.date = $1
      AND ar.${col} IS NOT NULL
      AND u.national_id IS NOT NULL
    ORDER BY u.full_name_th
  `, [today])

  const dateFmt = toDDMMYYYY(today)
  return rows.map(r => `${r.national_id},${dateFmt},${extractTime(r.ts)},${r.full_name_th ?? ''}`)
}

// ─── Multipart builder ────────────────────────────────────────
function buildMultipart(txtContent: string, filename: string) {
  const boundary = '----Boundary' + Date.now()
  const fields: Record<string, string> = {
    field1_id: '3', field2_id: '4', field3_id: '5',
    date_type: '2', data_type: '4', sys_id: '01', submit: 'นำเข้าข้อมูล',
  }
  let body = ''
  for (const [k, v] of Object.entries(fields)) {
    body += `--${boundary}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${v}\r\n`
  }
  body += `--${boundary}\r\nContent-Disposition: form-data; name="uploadfile"; filename="${filename}"\r\nContent-Type: text/plain\r\n\r\n${txtContent}\r\n--${boundary}--\r\n`
  return { body, boundary }
}

// ─── RMS Upload ───────────────────────────────────────────────
async function uploadToRms(lines: string[], mode: string) {
  const txt      = lines.join('\r\n')
  const filename = `attendance_${mode}_${todayInTZ()}.txt`

  // Login
  const loginResp = await fetch(RMS_BASE, {
    method:   'POST',
    headers:  { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'Mozilla/5.0' },
    body:     new URLSearchParams({ username: RMS_USER, password: RMS_PASS, submit: 'เข้าสู่ระบบ' }),
    redirect: 'manual',
  })
  const cookie = loginResp.headers.get('set-cookie') ?? ''

  // Upload
  const { body, boundary } = buildMultipart(txt, filename)
  const uploadResp = await fetch(`${RMS_BASE}?p=log_import&mod=7`, {
    method:  'POST',
    headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}`, 'User-Agent': 'Mozilla/5.0', Cookie: cookie },
    body,
  })

  return { status: uploadResp.status, ok: uploadResp.ok }
}

// ─── Handler ──────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  // Auth — ตรวจ secret key จาก header เท่านั้น
  const secret = req.headers.get('x-api-secret') ?? ''
  if (!API_SECRET || secret !== API_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const mode = req.nextUrl.searchParams.get('mode')
  if (mode !== 'checkin' && mode !== 'checkout') {
    return NextResponse.json({ error: 'mode ต้องเป็น checkin หรือ checkout' }, { status: 400 })
  }

  // ข้ามเสาร์-อาทิตย์
  const dow = new Date().toLocaleDateString('en-US', { timeZone: SCHOOL_TZ, weekday: 'short' })
  if (dow === 'Sat' || dow === 'Sun') {
    return NextResponse.json({ skipped: true, reason: 'weekend' })
  }

  try {
    const lines = await fetchRecords(mode)
    if (lines.length === 0) {
      return NextResponse.json({ skipped: true, reason: 'no records', date: todayInTZ() })
    }

    const result = await uploadToRms(lines, mode)
    return NextResponse.json({ ok: result.ok, rmsStatus: result.status, records: lines.length, date: todayInTZ() })

  } catch (err) {
    console.error('[rms/upload]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
