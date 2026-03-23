'use client'
import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { AppShell } from '@/components/layout/AppShell'
import { Chip, LocBadge, LiveDot, Panel, PanelHeader } from '@/components/ui'
import type { TodayStatus, AttendanceRecord } from '@/types'

const CUTOFF         = process.env.NEXT_PUBLIC_CHECKIN_CUTOFF           ?? '08:00'
const CHECKOUT_AFTER = process.env.NEXT_PUBLIC_CHECKOUT_AVAILABLE_AFTER ?? '16:30'
const ABSENT_CUTOFF  = process.env.NEXT_PUBLIC_ABSENT_CUTOFF            ?? '12:00'
const SCHOOL_LAT     = parseFloat(process.env.NEXT_PUBLIC_SCHOOL_LAT    ?? '13.736717')
const SCHOOL_LNG     = parseFloat(process.env.NEXT_PUBLIC_SCHOOL_LNG    ?? '100.523186')
const RADIUS_M       = parseFloat(process.env.NEXT_PUBLIC_GEOFENCE_RADIUS ?? '500')
const SCHOOL_TZ      = process.env.NEXT_PUBLIC_SCHOOL_TZ                ?? 'Asia/Bangkok'

function bkkMinutes(date: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: SCHOOL_TZ, hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(date)
  const h = parseInt(parts.find(p => p.type === 'hour')!.value) % 24
  const m = parseInt(parts.find(p => p.type === 'minute')!.value)
  return h * 60 + m
}

function bkkDateStr(date: Date): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: SCHOOL_TZ }).format(date)
}

function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function isAfterCheckoutTime() {
  const [h, m] = CHECKOUT_AFTER.split(':').map(Number)
  return bkkMinutes(new Date()) >= h * 60 + m
}

function isAfterNoon() {
  const [h, m] = ABSENT_CUTOFF.split(':').map(Number)
  return bkkMinutes(new Date()) > h * 60 + m
}

// GPS error code meanings (GeolocationPositionError.code)
const GPS_ERROR: Record<number, { title: string; hint: string }> = {
  0: { title: 'เบราว์เซอร์ไม่รองรับ GPS', hint: 'กรุณาเปิดเว็บใน Chrome หรือ Safari' },
  1: { title: 'ไม่ได้รับอนุญาต GPS',      hint: 'เปิดการตั้งค่า → ความเป็นส่วนตัว → ตำแหน่ง → อนุญาตสำหรับเว็บไซต์นี้' },
  2: { title: 'ระบุตำแหน่งไม่ได้',        hint: 'ลองออกไปที่โล่ง หรือเปิด Wi-Fi แล้วลองใหม่' },
  3: { title: 'GPS ช้าเกินไป',             hint: 'ลองย้ายไปที่โล่ง แล้วกด "ลองใหม่"' },
}

export default function CheckinPage() {
  const { data: session } = useSession()
  const [today, setToday]               = useState<TodayStatus | null>(null)
  const [history, setHistory]           = useState<AttendanceRecord[]>([])
  const [gpsState, setGpsState]         = useState<'loading' | 'ok' | 'error'>('loading')
  const [gpsErrCode, setGpsErrCode]     = useState<number>(0)
  const [coords, setCoords]             = useState<{ lat: number; lng: number } | null>(null)
  const [distance, setDistance]         = useState<number | null>(null)
  const [locMode, setLocMode]           = useState<'campus' | 'wfh'>('wfh')
  const [loading, setLoading]           = useState(false)
  const [clock, setClock]               = useState('')
  const [toast, setToast]               = useState<{ msg: string; type: string } | null>(null)
  const [showReasonModal, setShowReasonModal] = useState(false)
  const [lateReason, setLateReason]     = useState('')

  // Live clock
  useEffect(() => {
    const tick = () => setClock(new Date().toLocaleTimeString('th-TH', {
      timeZone: SCHOOL_TZ, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
    }))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  // GPS detection — extracted for retry
  const detectGps = useCallback(() => {
    if (!navigator.geolocation) {
      setGpsState('error'); setGpsErrCode(0); setLocMode('wfh'); return
    }
    setGpsState('loading')
    navigator.geolocation.getCurrentPosition(
      pos => {
        const { latitude, longitude } = pos.coords
        setCoords({ lat: latitude, lng: longitude })
        const dist = haversine(latitude, longitude, SCHOOL_LAT, SCHOOL_LNG)
        setDistance(dist)
        setLocMode(dist <= RADIUS_M ? 'campus' : 'wfh')
        setGpsState('ok')
      },
      err => {
        setGpsState('error')
        setGpsErrCode(err.code)
        setLocMode('wfh')   // always fall back to WFH — never block check-in
      },
      { enableHighAccuracy: true, timeout: 10000 },
    )
  }, [])

  useEffect(() => { detectGps() }, [detectGps])

  const fetchToday = useCallback(async () => {
    const res = await fetch('/api/attendance/today')
    if (res.ok) setToday(await res.json())
  }, [])

  const fetchHistory = useCallback(async () => {
    const to   = bkkDateStr(new Date())
    const from = bkkDateStr(new Date(Date.now() - 7 * 86400000))
    const res  = await fetch(`/api/attendance/history?from=${from}&to=${to}`)
    if (res.ok) { const d = await res.json(); setHistory(d.records ?? []) }
  }, [])

  useEffect(() => { fetchToday(); fetchHistory() }, [fetchToday, fetchHistory])

  const showToast = (msg: string, type = 'ok') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3200)
  }

  // Actual API call — accepts optional late reason
  const doCheckin = useCallback(async (reason?: string) => {
    setShowReasonModal(false)
    setLoading(true)
    const body: Record<string, unknown> = { location_mode: locMode }
    if (locMode === 'campus' && coords) { body.lat = coords.lat; body.lng = coords.lng }
    if (reason) body.reason = reason

    const res  = await fetch('/api/attendance/checkin', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    })
    const data = await res.json()
    setLoading(false)

    if (res.ok) {
      const label = locMode === 'campus' ? 'วิทยาลัย' : 'WFH'
      showToast(`เช็คอินสำเร็จ — ${label} · ${new Date().toLocaleTimeString('th-TH', { timeZone: SCHOOL_TZ, hour: '2-digit', minute: '2-digit', hour12: false })} น.`, 'ok')
      fetchToday(); fetchHistory()
    } else if (data.error === 'already_checked_in') {
      showToast('เช็คอินแล้วในวันนี้', 'warn')
    } else {
      showToast('เกิดข้อผิดพลาด กรุณาลองใหม่', 'danger')
    }
  }, [locMode, coords, fetchToday, fetchHistory]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleCheckin = async () => {
    if (today?.checked_in) return
    if (isAbsent) { showToast(`พ้นเวลา ${CHECKOUT_AFTER} น. แล้ว — บันทึกว่า "ขาด"`, 'danger'); return }
    if (gpsState === 'loading') { showToast('กำลังตรวจสอบตำแหน่ง กรุณารอสักครู่', 'warn'); return }
    // Note: gpsState==='error' is allowed — locMode will be 'wfh' as fallback
    if (isNoonPassed) { setLateReason(''); setShowReasonModal(true); return }
    doCheckin()
  }

  const handleCheckout = async () => {
    if (!today?.checked_in || today?.checked_out) return
    if (!isAfterCheckoutTime()) { showToast(`เช็คเอาท์ได้หลัง ${CHECKOUT_AFTER} น. เท่านั้น`, 'warn'); return }
    setLoading(true)
    const res = await fetch('/api/attendance/checkout', { method: 'POST' })
    setLoading(false)
    if (res.ok) {
      showToast(`เช็คเอาท์สำเร็จ · ${new Date().toLocaleTimeString('th-TH', { timeZone: SCHOOL_TZ, hour: '2-digit', minute: '2-digit', hour12: false })} น.`, 'ok')
      fetchToday()
    }
  }

  const isAbsent    = !today?.checked_in && isAfterCheckoutTime()
  const isNoonPassed = !today?.checked_in && isAfterNoon() && !isAfterCheckoutTime()

  const statusChip = () => {
    if (isAbsent)                               return <Chip variant="danger"  label="ขาด" />
    if (!today?.checked_in)                     return <Chip variant="neutral" label="ยังไม่ลงชื่อ" />
    if (today.record?.location_mode === 'wfh')  return <Chip variant="blue"   label="WFH" />
    if (today.record?.status === 'late')        return <Chip variant="warn"   label="สาย" />
    return <Chip variant="ok" label="ลงชื่อแล้ว" />
  }

  const toastColor: Record<string, string> = { ok: 'var(--ok)', warn: 'var(--warn)', danger: 'var(--danger)' }

  // ── GPS badge content ──
  const gpsInfo = (() => {
    if (gpsState === 'loading') return {
      bg: 'var(--bg-raised)', border: '1px solid var(--line-mid)', dot: 'var(--text-dim)',
      title: 'กำลังตรวจสอบตำแหน่ง...', sub: 'รอสักครู่',
    }
    if (gpsState === 'error') {
      const e = GPS_ERROR[gpsErrCode] ?? GPS_ERROR[2]
      return {
        bg: 'var(--warn-dim)', border: '1px solid rgba(217,119,6,.25)', dot: 'var(--warn)',
        title: e.title, sub: e.hint, isError: true,
      }
    }
    // ok
    if (locMode === 'campus') return {
      bg: 'var(--ok-dim)', border: '1px solid rgba(95,184,130,.2)', dot: 'var(--ok)',
      title: 'อยู่ในพื้นที่วิทยาลัย',
      sub: distance !== null ? `ห่าง ${Math.round(distance)} ม. · เกณฑ์ ≤ ${RADIUS_M} ม.` : '',
    }
    return {
      bg: 'var(--blue-dim)', border: '1px solid rgba(91,142,240,.2)', dot: 'var(--blue)',
      title: distance !== null ? `อยู่นอกพื้นที่ (ห่าง ${Math.round(distance)} ม.)` : 'อยู่นอกพื้นที่ (WFH)',
      sub: `เกณฑ์วิทยาลัย ≤ ${RADIUS_M} ม.`,
    }
  })()

  // Button appearance
  const checkinBtnDisabled = loading || !!today?.checked_in || isAbsent || gpsState === 'loading'
  const checkinBtnBg = today?.checked_in ? 'var(--bg-active)'
    : isAbsent   ? 'var(--danger-dim)'
    : isNoonPassed ? 'var(--warn-dim)'
    : gpsState === 'loading' ? 'var(--bg-raised)'
    : 'var(--text-primary)'
  const checkinBtnColor = today?.checked_in ? 'var(--text-muted)'
    : isAbsent   ? 'var(--danger-text)'
    : isNoonPassed ? 'var(--warn-text)'
    : gpsState === 'loading' ? 'var(--text-dim)'
    : 'var(--bg-base)'

  return (
    <AppShell>
      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', bottom: 24, right: 16, left: 16, background: 'var(--bg-raised)', border: '1px solid var(--line-mid)', borderRadius: 8, padding: '11px 16px', fontSize: 13, color: 'var(--text-primary)', zIndex: 200, display: 'flex', alignItems: 'center', gap: 10, boxShadow: '0 8px 32px rgba(0,0,0,.5)', maxWidth: 400, margin: '0 auto' }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: toastColor[toast.type] ?? 'var(--ok)', flexShrink: 0 }} />
          {toast.msg}
        </div>
      )}

      {/* Late Reason Modal */}
      {showReasonModal && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
          onClick={e => { if (e.target === e.currentTarget) setShowReasonModal(false) }}
        >
          <div style={{ background: 'var(--bg-surface)', borderRadius: '16px 16px 0 0', padding: '24px 20px 32px', width: '100%', maxWidth: 480, boxShadow: '0 -8px 40px rgba(0,0,0,.2)' }}>
            <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--line-mid)', margin: '0 auto 20px' }} />
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-heading)', marginBottom: 6 }}>
              ลงชื่อเข้าเกินเที่ยง
            </div>
            <div style={{ fontSize: 13.5, color: 'var(--text-muted)', fontFamily: 'var(--font-body)', marginBottom: 16 }}>
              คุณลงชื่อหลัง {ABSENT_CUTOFF} น. สถานะจะถูกบันทึกเป็น{' '}
              <strong style={{ color: 'var(--warn-text)' }}>สาย</strong><br/>
              กรุณาระบุเหตุผล <strong>อย่างน้อย 10 ตัวอักษร</strong> เพื่อดำเนินการต่อ
            </div>
            <textarea
              value={lateReason}
              onChange={e => setLateReason(e.target.value)}
              placeholder="ระบุเหตุผลที่มาสาย เช่น ติดภารกิจราชการ, รถติด, ไม่สบาย..."
              rows={3}
              maxLength={500}
              style={{
                width: '100%', padding: '10px 12px', borderRadius: 8,
                border: `1px solid ${lateReason.length > 0 && lateReason.trim().length < 10 ? 'var(--danger)' : 'var(--line-mid)'}`,
                background: 'var(--bg-raised)',
                color: 'var(--text-primary)', fontFamily: 'var(--font-body)', fontSize: 14,
                resize: 'none', lineHeight: 1.6, marginBottom: 4,
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              {lateReason.length > 0 && lateReason.trim().length < 10 ? (
                <span style={{ fontSize: 11, color: 'var(--danger-text)' }}>ต้องกรอกอย่างน้อย 10 ตัวอักษร ({lateReason.trim().length}/10)</span>
              ) : (
                <span />
              )}
              <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>{lateReason.length}/500</span>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => setShowReasonModal(false)}
                style={{ flex: 1, padding: '12px', borderRadius: 10, border: '1px solid var(--line-mid)', background: 'transparent', color: 'var(--text-secondary)', fontSize: 15, fontWeight: 600, fontFamily: 'var(--font-heading)', cursor: 'pointer' }}
              >
                ยกเลิก
              </button>
              <button
                onClick={() => doCheckin(lateReason)}
                disabled={lateReason.trim().length < 10 || loading}
                style={{
                  flex: 2, padding: '12px', borderRadius: 10, border: 'none',
                  background: lateReason.trim().length >= 10 ? 'var(--warn)' : 'var(--bg-active)',
                  color: lateReason.trim().length >= 10 ? '#fff' : 'var(--text-dim)',
                  fontSize: 15, fontWeight: 700, fontFamily: 'var(--font-heading)',
                  cursor: lateReason.trim().length >= 10 ? 'pointer' : 'not-allowed',
                }}
              >
                ยืนยันลงชื่อสาย
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="animate-fade-up checkin-wrap">
        {/* Header */}
        <div style={{ marginBottom: 22 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 4 }}>เช็คอิน · วันนี้</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-heading)', letterSpacing: '-.01em' }}>ยืนยันการเข้างาน</div>
        </div>

        {/* Main card */}
        <div className="animate-fade-up-d1" style={{ background: 'var(--bg-surface)', border: '1px solid var(--line)', borderRadius: 12, overflow: 'hidden', marginBottom: 14 }}>

          {/* Clock section */}
          <div style={{ padding: '20px 20px 16px', textAlign: 'center' }}>
            <div style={{ marginBottom: 14, display: 'flex', justifyContent: 'center' }}><LiveDot label="ระบบออนไลน์" /></div>
            <div className="checkin-clock" style={{ fontSize: 48, fontWeight: 700, letterSpacing: '-.04em', color: 'var(--text-primary)', lineHeight: 1, marginBottom: 4, fontVariantNumeric: 'tabular-nums' }}>
              {clock}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              {new Date().toLocaleDateString('th-TH', { timeZone: SCHOOL_TZ, weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </div>
            {isNoonPassed && (
              <div style={{ marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--warn-dim)', border: '1px solid rgba(217,119,6,.25)', borderRadius: 6, padding: '4px 10px', fontSize: 12, color: 'var(--warn-text)', fontFamily: 'var(--font-body)' }}>
                ⚠ เกินเที่ยงแล้ว — การลงชื่อต้องระบุเหตุผล
              </div>
            )}
          </div>

          {/* GPS location badge */}
          <div style={{ padding: '0 20px 16px' }}>
            <div style={{ borderRadius: 10, padding: '12px 16px', background: gpsInfo.bg, border: gpsInfo.border }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: gpsInfo.dot, flexShrink: 0, marginTop: 5 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}>
                    {gpsInfo.title}
                  </div>
                  <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', marginTop: 2 }}>
                    {gpsInfo.sub}
                  </div>

                  {/* GPS error: retry + WFH fallback notice + browser hint */}
                  {gpsInfo.isError && (
                    <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                        <button
                          onClick={detectGps}
                          style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid var(--warn-text)', background: 'transparent', color: 'var(--warn-text)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-body)' }}
                        >
                          ↺ ลองใหม่
                        </button>
                        <span style={{ fontSize: 12, color: 'var(--warn-text)', fontFamily: 'var(--font-body)' }}>
                          จะเช็คอินในโหมด <strong>WFH</strong> แทน
                        </span>
                      </div>
                      {/* Always recommend Chrome/Safari for GPS issues */}
                      {gpsErrCode !== 0 && (
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-body)', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span style={{ fontSize: 13 }}>💡</span>
                          แนะนำ: ใช้ <strong>Chrome</strong> หรือ <strong>Safari</strong> เพื่อผลลัพธ์ที่ดีกว่า
                        </div>
                      )}
                    </div>
                  )}

                  {/* GPS ok + campus: allow manual switch to WFH */}
                  {gpsState === 'ok' && locMode === 'campus' && (
                    <button
                      onClick={() => setLocMode('wfh')}
                      style={{ marginTop: 8, padding: '4px 10px', borderRadius: 6, border: '1px solid rgba(95,184,130,.4)', background: 'transparent', color: 'var(--ok-text)', fontSize: 11, cursor: 'pointer', fontFamily: 'var(--font-body)' }}
                    >
                      เปลี่ยนเป็น WFH วันนี้
                    </button>
                  )}

                  {/* GPS ok + wfh (out of range): show current mode */}
                  {gpsState === 'ok' && locMode === 'wfh' && (
                    <div style={{ marginTop: 6, fontSize: 11, color: 'var(--blue-text)', fontFamily: 'var(--font-body)' }}>
                      จะเช็คอินในโหมด <strong>WFH</strong>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Profile row */}
          <div style={{ padding: '14px 20px', borderTop: '1px solid var(--line)', borderBottom: '1px solid var(--line)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--bg-active)', border: '1px solid var(--line-mid)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 700, color: 'var(--accent)', flexShrink: 0 }}>
                {session?.user?.nameTh?.slice(0, 2) ?? '??'}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-heading)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{session?.user?.nameTh}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{session?.user?.dept ?? 'ไม่ระบุแผนก'}</div>
              </div>
              <div style={{ marginLeft: 'auto', flexShrink: 0 }}>{statusChip()}</div>
            </div>

            {/* Summary row after checked in */}
            {today?.checked_in && today.record && (
              <div style={{ background: 'var(--bg-raised)', border: '1px solid var(--line)', borderRadius: 8, padding: '10px 14px', marginTop: 12, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                {[
                  { label: 'ลงชื่อเข้า', val: today.record.check_in_at ? new Date(today.record.check_in_at).toLocaleTimeString('th-TH', { timeZone: SCHOOL_TZ, hour: '2-digit', minute: '2-digit', hour12: false }) : '—' },
                  { label: 'ลงชื่อออก', val: today.record.check_out_at ? new Date(today.record.check_out_at).toLocaleTimeString('th-TH', { timeZone: SCHOOL_TZ, hour: '2-digit', minute: '2-digit', hour12: false }) : '—' },
                  { label: 'สถานที่', val: today.record.location_mode === 'wfh' ? 'WFH' : 'วิทยาลัย' },
                ].map(f => (
                  <div key={f.label}>
                    <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 3 }}>{f.label}</div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{f.val}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Late reason display */}
            {today?.record?.late_reason && (
              <div style={{ marginTop: 10, padding: '8px 12px', background: 'var(--warn-dim)', border: '1px solid rgba(217,119,6,.2)', borderRadius: 8, fontSize: 12, color: 'var(--warn-text)', fontFamily: 'var(--font-body)' }}>
                <span style={{ fontWeight: 600 }}>เหตุผล: </span>{today.record.late_reason}
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="checkin-btns" style={{ display: 'flex', gap: 10 }}>

              {/* ลงชื่อเข้า */}
              <button
                onClick={handleCheckin}
                disabled={checkinBtnDisabled}
                style={{
                  flex: 1, padding: '22px 8px', borderRadius: 12, border: 'none',
                  fontSize: 18, fontWeight: 700, letterSpacing: '.01em',
                  fontFamily: 'var(--font-heading)',
                  cursor: checkinBtnDisabled ? 'not-allowed' : 'pointer',
                  background: checkinBtnBg,
                  color: checkinBtnColor,
                  transition: 'all .15s',
                  opacity: gpsState === 'loading' ? 0.5 : 1,
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
                }}
              >
                <span>{isAbsent ? 'ขาด' : isNoonPassed ? 'ลงชื่อสาย' : 'ลงชื่อเข้า'}</span>
                <span style={{ fontSize: 11, fontWeight: 400, fontFamily: 'var(--font-mono)', opacity: 0.85 }}>
                  {today?.checked_in && today.record?.check_in_at
                    ? new Date(today.record.check_in_at).toLocaleTimeString('th-TH', { timeZone: SCHOOL_TZ, hour: '2-digit', minute: '2-digit', hour12: false }) + ' น.'
                    : isAbsent      ? `พ้น ${CHECKOUT_AFTER} น.`
                    : isNoonPassed  ? 'ต้องระบุเหตุผล'
                    : gpsState === 'loading' ? 'กำลังตรวจสอบ...'
                    : gpsState === 'error'   ? 'WFH (ไม่มี GPS)'
                    : locMode === 'campus'   ? 'วิทยาลัย'
                    : 'WFH'}
                </span>
              </button>

              {/* ลงชื่อออก */}
              <button
                onClick={handleCheckout}
                disabled={loading || !today?.checked_in || !!today?.checked_out}
                style={{
                  flex: 1, padding: '22px 8px', borderRadius: 12,
                  fontSize: 18, fontWeight: 700, letterSpacing: '.01em',
                  fontFamily: 'var(--font-heading)',
                  cursor: (!today?.checked_in || today?.checked_out) ? 'not-allowed' : 'pointer',
                  background: today?.checked_out ? 'var(--bg-active)' : today?.checked_in ? 'var(--blue-dim)' : 'transparent',
                  color: today?.checked_out ? 'var(--text-muted)' : today?.checked_in ? 'var(--blue-text)' : 'var(--text-dim)',
                  border: today?.checked_in && !today?.checked_out ? '2px solid rgba(91,142,240,.35)' : '1px solid var(--line-mid)',
                  transition: 'all .15s',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
                }}
              >
                <span>ลงชื่อออก</span>
                <span style={{ fontSize: 11, fontWeight: 400, fontFamily: 'var(--font-mono)', opacity: 0.85 }}>
                  {today?.checked_out && today.record?.check_out_at
                    ? new Date(today.record.check_out_at).toLocaleTimeString('th-TH', { timeZone: SCHOOL_TZ, hour: '2-digit', minute: '2-digit', hour12: false }) + ' น.'
                    : 'หลัง ' + CHECKOUT_AFTER + ' น.'}
                </span>
              </button>
            </div>

            <div style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', textAlign: 'center', lineHeight: 1.7 }}>
              หลัง {CUTOFF} น. = สาย · หลัง {ABSENT_CUTOFF} น. ต้องระบุเหตุผล · ไม่ลงชื่อก่อน {CHECKOUT_AFTER} น. = ขาด
            </div>
          </div>
        </div>

        {/* History */}
        <div className="animate-fade-up-d2">
          <Panel>
            <PanelHeader title="ประวัติ 7 วันล่าสุด" />

            {/* Desktop table */}
            <div className="checkin-hist-desktop">
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>{['วันที่', 'สถานที่', 'ลงชื่อเข้า', 'ลงชื่อออก', 'สถานะ'].map(h => (
                    <th key={h} style={{ padding: '10px 14px', fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', textAlign: 'left', borderBottom: '1px solid var(--line)', fontFamily: "'Sarabun', sans-serif" }}>{h}</th>
                  ))}</tr>
                </thead>
                <tbody>
                  {history.length === 0 && (
                    <tr><td colSpan={5} style={{ padding: '24px 14px', textAlign: 'center', fontSize: 14, color: 'var(--text-muted)', fontFamily: "'Sarabun', sans-serif" }}>ไม่มีประวัติ</td></tr>
                  )}
                  {history.map(r => (
                    <tr key={r.id} style={{ borderBottom: '1px solid var(--line)' }}>
                      <td style={{ padding: '11px 14px', fontSize: 14, color: 'var(--text-secondary)', fontFamily: "'Sarabun', sans-serif" }}>
                        {new Date(r.date + 'T00:00:00').toLocaleDateString('th-TH', { timeZone: SCHOOL_TZ, weekday: 'short', day: '2-digit', month: 'short' })}
                      </td>
                      <td style={{ padding: '11px 14px' }}><LocBadge mode={r.location_mode} /></td>
                      <td style={{ padding: '11px 14px', fontSize: 15, fontWeight: 600, fontFamily: "'Sarabun', sans-serif", color: r.check_in_at ? 'var(--text-primary)' : 'var(--text-dim)' }}>
                        {r.check_in_at ? new Date(r.check_in_at).toLocaleTimeString('th-TH', { timeZone: SCHOOL_TZ, hour: '2-digit', minute: '2-digit', hour12: false }) + ' น.' : '—'}
                      </td>
                      <td style={{ padding: '11px 14px', fontSize: 15, fontWeight: 600, fontFamily: "'Sarabun', sans-serif", color: r.check_out_at ? 'var(--text-primary)' : 'var(--text-dim)' }}>
                        {r.check_out_at ? new Date(r.check_out_at).toLocaleTimeString('th-TH', { timeZone: SCHOOL_TZ, hour: '2-digit', minute: '2-digit', hour12: false }) + ' น.' : '—'}
                      </td>
                      <td style={{ padding: '11px 14px' }}>
                        {r.status === 'present' && <Chip variant="ok"   label="ปกติ" />}
                        {r.status === 'late'    && <Chip variant="warn" label="สาย" />}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile card list */}
            <div className="checkin-hist-mobile">
              {history.length === 0 && (
                <div style={{ padding: '24px 16px', textAlign: 'center', fontSize: 14, color: 'var(--text-muted)' }}>ไม่มีประวัติ</div>
              )}
              {history.map(r => (
                <div key={r.id} style={{ padding: '12px 16px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', fontFamily: "'Sarabun', sans-serif" }}>
                      {new Date(r.date + 'T00:00:00').toLocaleDateString('th-TH', { timeZone: SCHOOL_TZ, weekday: 'short', day: 'numeric', month: 'short' })}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                      <LocBadge mode={r.location_mode} />
                      <span style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                        {r.check_in_at ? new Date(r.check_in_at).toLocaleTimeString('th-TH', { timeZone: SCHOOL_TZ, hour: '2-digit', minute: '2-digit', hour12: false }) : '—'}
                        {' → '}
                        {r.check_out_at ? new Date(r.check_out_at).toLocaleTimeString('th-TH', { timeZone: SCHOOL_TZ, hour: '2-digit', minute: '2-digit', hour12: false }) : '—'}
                      </span>
                    </div>
                  </div>
                  <div style={{ flexShrink: 0 }}>
                    {r.status === 'present' && <Chip variant="ok"   label="ปกติ" />}
                    {r.status === 'late'    && <Chip variant="warn" label="สาย" />}
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </div>
    </AppShell>
  )
}
