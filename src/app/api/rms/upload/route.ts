import { NextRequest, NextResponse } from 'next/server'
import * as db from '@/lib/db'

export const dynamic = 'force-dynamic'

const SCHOOL_TZ  = process.env.NEXT_PUBLIC_SCHOOL_TZ ?? 'Asia/Bangkok'
const API_SECRET = process.env.RMS_API_SECRET ?? ''
const RMS_BASE   = 'https://rms.tatc.ac.th/index.php'
const RMS_USER   = process.env.RMS_USERNAME ?? ''
const RMS_PASS   = process.env.RMS_PASSWORD ?? ''

// ─── Helpers ──────────────────────────────────────────────────
function todayInTZ(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: SCHOOL_TZ, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date())
}

function toDDMMYYYY(d: string): string {
  const [y, m, day] = d.split('-')
  return `${day}/${m}/${y}`
}

function extractTime(iso: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: SCHOOL_TZ, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).format(new Date(iso))
}

// ─── DB Query (same logic as export-raw) ──────────────────────
async function fetchRecords(mode: 'checkin' | 'checkout') {
  const today = todayInTZ()

  const staff        = await db.listAllStaffForPresence()
  const registeredIds = staff.filter(s => s.is_registered).map(s => s.id)
  const records      = await db.getAttendanceForReport(registeredIds, today, today)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recordMap = new Map<string, any>()
  for (const rec of records) {
    recordMap.set(`${rec.user_id}:${rec.date}`, rec)
  }

  const dateFmt = toDDMMYYYY(today)
  const lines: string[] = []

  for (const s of staff) {
    const { national_id, full_name_th: name, id, is_registered } = s
    const rec = is_registered ? recordMap.get(`${id}:${today}`) : undefined

    if (mode === 'checkin') {
      if (!rec?.check_in_at) continue
      lines.push(`${national_id},${dateFmt},${extractTime(rec.check_in_at)},${name ?? ''}`)
    } else {
      if (!rec?.check_out_at) continue
      lines.push(`${national_id},${dateFmt},${extractTime(rec.check_out_at)},${name ?? ''}`)
    }
  }

  return lines
}

// ─── Cookie helper ────────────────────────────────────────────
function extractCookies(resp: Response, existing = ''): string {
  const raw = resp.headers.getSetCookie?.() ?? [resp.headers.get('set-cookie') ?? '']
  const map = new Map<string, string>()

  // ใส่ cookie เดิมก่อน
  for (const pair of existing.split(';').map(s => s.trim()).filter(Boolean)) {
    const [k, ...v] = pair.split('=')
    map.set(k.trim(), v.join('='))
  }
  // override ด้วย cookie ใหม่
  for (const c of raw) {
    const pair = c.split(';')[0].trim()
    if (!pair) continue
    const [k, ...v] = pair.split('=')
    map.set(k.trim(), v.join('='))
  }
  return Array.from(map.entries()).map(([k, v]) => `${k}=${v}`).join('; ')
}

// ─── RMS Upload ───────────────────────────────────────────────
async function uploadToRms(lines: string[], mode: string) {
  const txt      = lines.join('\r\n')
  const filename = `attendance_${mode}_${todayInTZ()}.txt`
  const UA       = 'Mozilla/5.0'

  // 1. GET หน้า login เพื่อรับ PHPSESSID
  const initResp = await fetch(RMS_BASE, {
    method: 'GET', headers: { 'User-Agent': UA }, redirect: 'manual',
  })
  let cookie = extractCookies(initResp)

  // 2. POST login
  const loginResp = await fetch(RMS_BASE, {
    method:   'POST',
    headers:  { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': UA, Cookie: cookie },
    body:     new URLSearchParams({ username: RMS_USER, password: RMS_PASS, submit: 'เข้าสู่ระบบ' }),
    redirect: 'manual',
  })
  cookie = extractCookies(loginResp, cookie)

  // 3. Follow redirect หลัง login (ถ้ามี)
  const location = loginResp.headers.get('location')
  if (location) {
    const redirectUrl = location.startsWith('http') ? location : `https://rms.tatc.ac.th${location}`
    const redirResp   = await fetch(redirectUrl, {
      method: 'GET', headers: { 'User-Agent': UA, Cookie: cookie }, redirect: 'manual',
    })
    cookie = extractCookies(redirResp, cookie)
  }

  // 4. Upload ด้วย FormData
  const form = new FormData()
  form.append('field1_id', '3')
  form.append('field2_id', '4')
  form.append('field3_id', '5')
  form.append('date_type', '2')
  form.append('data_type', '4')
  form.append('sys_id',    '01')
  form.append('submit',    'นำเข้าข้อมูล')
  form.append('uploadfile', new Blob([txt], { type: 'text/plain' }), filename)

  const uploadResp = await fetch(`${RMS_BASE}?p=log_import&mod=7`, {
    method:  'POST',
    headers: { 'User-Agent': UA, Cookie: cookie },
    body:    form,
  })

  const rmsText = await uploadResp.text()
  return {
    status:  uploadResp.status,
    ok:      uploadResp.ok,
    cookie,
    rmsText: rmsText.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 500),
  }
}

// ─── Handler ──────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-api-secret') ?? ''
  if (!API_SECRET || secret !== API_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const mode = req.nextUrl.searchParams.get('mode')
  if (mode !== 'checkin' && mode !== 'checkout') {
    return NextResponse.json({ error: 'mode ต้องเป็น checkin หรือ checkout' }, { status: 400 })
  }

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
    return NextResponse.json({
      ok:        result.ok,
      rmsStatus: result.status,
      records:   lines.length,
      date:      todayInTZ(),
      cookie:    result.cookie,      // debug: ตรวจ login สำเร็จไหม
      rmsText:   result.rmsText,     // debug: ดู response จาก RMS
    })

  } catch (err) {
    console.error('[rms/upload]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
