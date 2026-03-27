'use client'
import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { AppShell } from '@/components/layout/AppShell'
import { Chip, LocBadge, LiveDot, Panel, PanelHeader } from '@/components/ui'
import type { TodayStatus, AttendanceRecord } from '@/types'

// ── Environment config ────────────────────────────────────────
const CUTOFF         = process.env.NEXT_PUBLIC_CHECKIN_CUTOFF           ?? '08:00'
const CHECKOUT_AFTER = process.env.NEXT_PUBLIC_CHECKOUT_AVAILABLE_AFTER ?? '16:30'
const SCHOOL_LAT     = parseFloat(process.env.NEXT_PUBLIC_SCHOOL_LAT     ?? '13.736717')
const SCHOOL_LNG     = parseFloat(process.env.NEXT_PUBLIC_SCHOOL_LNG     ?? '100.523186')
const RADIUS_M       = parseFloat(process.env.NEXT_PUBLIC_GEOFENCE_RADIUS ?? '500')
const SCHOOL_TZ      = process.env.NEXT_PUBLIC_SCHOOL_TZ                ?? 'Asia/Bangkok'

// ── Time helpers ──────────────────────────────────────────────
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

function isAfterCheckoutTime(): boolean {
  const [h, m] = CHECKOUT_AFTER.split(':').map(Number)
  return bkkMinutes(new Date()) >= h * 60 + m
}

function isAfterCutoff(): boolean {
  const [h, m] = CUTOFF.split(':').map(Number)
  return bkkMinutes(new Date()) > h * 60 + m
}

// ── Geolocation helper ────────────────────────────────────────
function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R    = 6371000
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a    = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// ── GPS error messages ────────────────────────────────────────
const GPS_ERROR: Record<number, { title: string; hint: string }> = {
  0: { title: 'เบราว์เซอร์ไม่รองรับ GPS',   hint: 'กรุณาเปิดเว็บใน Chrome หรือ Safari' },
  1: { title: 'ยังไม่ได้อนุญาตใช้ GPS',     hint: 'ไปที่ตั้งค่าเบราว์เซอร์ → ตำแหน่ง → อนุญาตสำหรับเว็บไซต์นี้' },
  2: { title: 'ระบุตำแหน่งไม่ได้ในขณะนี้',  hint: 'ลองออกไปที่โล่ง หรือเปิด Wi-Fi แล้วกด "ลองใหม่"' },
  3: { title: 'GPS ใช้เวลานานเกินไป',        hint: 'ลองย้ายไปที่โล่ง แล้วกด "ลองใหม่"' },
}

// ── Static style constants ────────────────────────────────────
const TOAST_COLOR: Record<string, string> = {
  ok: 'var(--ok)', warn: 'var(--warn)', danger: 'var(--danger)',
}

// ─────────────────────────────────────────────────────────────
export default function CheckinPage() {
  const { data: session } = useSession()

  const [today,           setToday]           = useState<TodayStatus | null>(null)
  const [history,         setHistory]         = useState<AttendanceRecord[]>([])
  const [gpsState,        setGpsState]        = useState<'loading' | 'ok' | 'error'>('loading')
  const [gpsErrCode,      setGpsErrCode]      = useState<number>(0)
  const [coords,          setCoords]          = useState<{ lat: number; lng: number } | null>(null)
  const [distance,        setDistance]        = useState<number | null>(null)
  const [accuracy,        setAccuracy]        = useState<number | null>(null)
  const [locMode,         setLocMode]         = useState<'campus' | 'wfh'>('wfh')
  const [loading,         setLoading]         = useState(false)
  const [clock,           setClock]           = useState('')
  const [toast,           setToast]           = useState<{ msg: string; type: string } | null>(null)
  const [showReasonModal, setShowReasonModal] = useState(false)
  const [lateReason,      setLateReason]      = useState('')
  const [pendingCheckin,  setPendingCheckin]  = useState(false)
  const [pendingCheckout, setPendingCheckout] = useState(false)

  // Live clock (ticks every second)
  useEffect(() => {
    const tick = () => setClock(new Date().toLocaleTimeString('th-TH', {
      timeZone: SCHOOL_TZ, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
    }))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  // GPS — extracted so the retry button can call it directly
  const detectGps = useCallback(() => {
    if (!navigator.geolocation) {
      setGpsState('error'); setGpsErrCode(0); return
    }
    setGpsState('loading')
    navigator.geolocation.getCurrentPosition(
      pos => {
        const { latitude, longitude, accuracy: accMeters } = pos.coords
        setCoords({ lat: latitude, lng: longitude })
        setAccuracy(accMeters)
        const dist = haversine(latitude, longitude, SCHOOL_LAT, SCHOOL_LNG)
        setDistance(dist)
        setLocMode(dist <= RADIUS_M ? 'campus' : 'wfh')
        setGpsState('ok')
      },
      err => { setGpsState('error'); setGpsErrCode(err.code) },
      { enableHighAccuracy: true, timeout: 10000 },
    )
  }, [])

  useEffect(() => { detectGps() }, [detectGps])

  // Data fetchers
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

  // Submit check-in (with optional late reason)
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
      const time  = new Date().toLocaleTimeString('th-TH', { timeZone: SCHOOL_TZ, hour: '2-digit', minute: '2-digit', hour12: false })
      showToast(`ลงชื่อเข้างานสำเร็จ — ${label} · ${time} น.`, 'ok')
      fetchToday(); fetchHistory()
    } else if (data.error === 'already_checked_in') {
      showToast('ลงชื่อเข้างานแล้วในวันนี้', 'warn')
    } else {
      showToast('เกิดข้อผิดพลาด กรุณาลองใหม่', 'danger')
    }
  }, [locMode, coords, fetchToday, fetchHistory]) // eslint-disable-line react-hooks/exhaustive-deps

  // หลัง GPS re-detect สำเร็จ → ส่ง checkin อัตโนมัติ
  useEffect(() => {
    if (!pendingCheckin) return
    if (gpsState === 'ok') {
      setPendingCheckin(false)
      if (isAfterCheckoutTime())  { showToast(`เลยกำหนดเวลา ${CHECKOUT_AFTER} น. แล้ว — บันทึกว่า "ขาด"`, 'danger') }
      else if (isAfterCutoff())   { setLateReason(''); setShowReasonModal(true) }
      else                        { doCheckin() }
    }
    if (gpsState === 'error') { setPendingCheckin(false); showToast('กรุณาแก้ไข GPS ก่อนลงชื่อ', 'danger') }
  }, [pendingCheckin, gpsState, doCheckin]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleCheckin = () => {
    if (today?.checked_in) return
    if (isAbsent) { showToast(`เลยกำหนดเวลา ${CHECKOUT_AFTER} น. แล้ว — บันทึกว่า "ขาด"`, 'danger'); return }
    setPendingCheckin(true)
    detectGps()
  }

  const doCheckout = useCallback(async () => {
    setPendingCheckout(false)
    setLoading(true)
    const res = await fetch('/api/attendance/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ location_mode: locMode }),
    })
    setLoading(false)
    if (res.ok) {
      const time  = new Date().toLocaleTimeString('th-TH', { timeZone: SCHOOL_TZ, hour: '2-digit', minute: '2-digit', hour12: false })
      const place = locMode === 'wfh' ? 'WFH' : 'วิทยาลัย'
      showToast(`ลงชื่อออกงานสำเร็จ — ${place} · ${time} น.`, 'ok')
      fetchToday(); fetchHistory()
    } else {
      showToast('เกิดข้อผิดพลาด กรุณาลองใหม่', 'danger')
    }
  }, [locMode, fetchToday, fetchHistory]) // eslint-disable-line react-hooks/exhaustive-deps

  // หลัง GPS re-detect สำเร็จ → ส่ง checkout อัตโนมัติ
  useEffect(() => {
    if (!pendingCheckout) return
    if (gpsState === 'ok')    { doCheckout() }
    if (gpsState === 'error') { setPendingCheckout(false); showToast('กรุณาแก้ไข GPS ก่อนลงชื่อออก', 'danger') }
  }, [pendingCheckout, gpsState, doCheckout]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleCheckout = () => {
    if (!today?.checked_in) return
    if (!isAfterCheckoutTime()) {
      showToast(`ลงชื่อออกได้หลัง ${CHECKOUT_AFTER} น. เท่านั้น`, 'warn')
      return
    }
    setPendingCheckout(true)
    detectGps()
  }

  // Derived state
  const isAbsent = !today?.checked_in && isAfterCheckoutTime()
  const isLate   = !today?.checked_in && isAfterCutoff() && !isAfterCheckoutTime()

  const statusChip = () => {
    if (isAbsent)                              return <Chip variant="danger"  label="ขาด" />
    if (!today?.checked_in)                    return <Chip variant="neutral" label="ยังไม่ลงชื่อ" />
    if (today.record?.location_mode === 'wfh') return <Chip variant="blue"   label="WFH" />
    if (today.record?.status === 'late')       return <Chip variant="warn"   label="สาย" />
    return <Chip variant="ok" label="ลงชื่อแล้ว" />
  }

  // GPS badge appearance
  const gpsInfo = (() => {
    if (gpsState === 'loading') return {
      bg: 'var(--bg-raised)', border: '1px solid var(--line-mid)', dot: 'var(--text-dim)',
      title: 'กำลังระบุตำแหน่ง GPS...', sub: 'กรุณารอสักครู่',
    }
    if (gpsState === 'error') {
      const e = GPS_ERROR[gpsErrCode] ?? GPS_ERROR[2]
      return {
        bg: 'var(--warn-dim)', border: '1px solid rgba(217,119,6,.25)', dot: 'var(--warn)',
        title: e.title, sub: e.hint, isError: true,
      }
    }
    const poorGps = accuracy !== null && accuracy > 150
    if (locMode === 'campus') return {
      bg: poorGps ? 'var(--warn-dim)' : 'var(--ok-dim)',
      border: poorGps ? '1px solid rgba(217,119,6,.25)' : '1px solid rgba(95,184,130,.2)',
      dot: poorGps ? 'var(--warn)' : 'var(--ok)',
      title: 'แสกน: วิทยาลัย',
      sub: distance !== null
        ? `ตรวจพบว่าอยู่ในพื้นที่ · ห่าง ${Math.round(distance)} ม.${accuracy !== null ? ` (±${Math.round(accuracy)} ม.)` : ''}${poorGps ? ' ⚠ GPS ไม่แม่น ลองออกไปที่โล่ง' : ''}`
        : 'ตรวจพบว่าอยู่ในพื้นที่วิทยาลัย',
    }
    return {
      bg: poorGps ? 'var(--warn-dim)' : 'var(--blue-dim)',
      border: poorGps ? '1px solid rgba(217,119,6,.25)' : '1px solid rgba(91,142,240,.2)',
      dot: poorGps ? 'var(--warn)' : 'var(--blue)',
      title: poorGps ? 'GPS ไม่แม่น — อาจส่งผลต่อการตรวจพื้นที่' : 'แสกน: Work From Home (WFH)',
      sub: distance !== null
        ? `อยู่นอกพื้นที่ ห่าง ${Math.round(distance)} ม.${accuracy !== null ? ` (±${Math.round(accuracy)} ม.)` : ''} · เกณฑ์ ≤ ${RADIUS_M} ม.${poorGps ? ' — ลองออกไปที่โล่งแล้วกด ↺ ลองใหม่' : ''}`
        : `อยู่นอกพื้นที่วิทยาลัย (เกณฑ์ ≤ ${RADIUS_M} ม.)`,
    }
  })()

  // Check-in button appearance
  const checkinBtnDisabled = loading || pendingCheckin || !!today?.checked_in || isAbsent || gpsState === 'loading'
  const checkinBtnBg = today?.checked_in  ? 'var(--ok-dim)'
    : isAbsent                            ? 'var(--danger-dim)'
    : pendingCheckin                      ? 'var(--bg-raised)'
    : isLate                              ? 'var(--warn-dim)'
    : gpsState === 'loading'              ? 'var(--bg-raised)'
    : 'var(--ok)'
  const checkinBtnColor = today?.checked_in ? 'var(--ok-text)'
    : isAbsent                              ? 'var(--danger-text)'
    : pendingCheckin                        ? 'var(--text-dim)'
    : isLate                                ? 'var(--warn-text)'
    : gpsState === 'loading'                ? 'var(--text-dim)'
    : '#fff'

  // Format timestamp to HH:MM น.
  const fmtTime = (iso: string) =>
    new Date(iso).toLocaleTimeString('th-TH', { timeZone: SCHOOL_TZ, hour: '2-digit', minute: '2-digit', hour12: false }) + ' น.'

  return (
    <AppShell>

      {/* ── Toast notification ── */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, right: 16, left: 16, zIndex: 200,
          background: 'var(--bg-raised)', border: '1px solid var(--line-mid)',
          borderRadius: 8, padding: '12px 16px', fontSize: 14,
          color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 10,
          boxShadow: '0 8px 32px rgba(0,0,0,.5)', maxWidth: 420, margin: '0 auto',
        }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: TOAST_COLOR[toast.type] ?? 'var(--ok)', flexShrink: 0 }} />
          {toast.msg}
        </div>
      )}

      {/* ── Late-reason modal (bottom sheet) ── */}
      {showReasonModal && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
          onClick={e => { if (e.target === e.currentTarget) setShowReasonModal(false) }}
        >
          <div style={{ background: 'var(--bg-surface)', borderRadius: '16px 16px 0 0', padding: '24px 20px 32px', width: '100%', maxWidth: 480, boxShadow: '0 -8px 40px rgba(0,0,0,.2)' }}>
            {/* Handle bar */}
            <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--line-mid)', margin: '0 auto 20px' }} />

            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-heading)', marginBottom: 6 }}>
              บันทึกการมาสาย
            </div>
            <div style={{ fontSize: 14, color: 'var(--text-muted)', fontFamily: 'var(--font-body)', marginBottom: 16, lineHeight: 1.6 }}>
              คุณลงชื่อหลัง {CUTOFF} น. — สถานะจะถูกบันทึกเป็น{' '}
              <strong style={{ color: 'var(--warn-text)' }}>มาสาย</strong><br />
              กรุณาระบุเหตุผล <strong>อย่างน้อย 10 ตัวอักษร</strong>
            </div>

            <textarea
              value={lateReason}
              onChange={e => setLateReason(e.target.value.replace(/[^\u0E00-\u0E7Fa-zA-Z0-9 ,.()\-\n]/g, ''))}
              placeholder="เช่น ติดภารกิจราชการ, รถติด, ไม่สบาย..."
              rows={3}
              maxLength={500}
              style={{
                width: '100%', padding: '10px 12px', borderRadius: 8,
                border: `1px solid ${lateReason.length > 0 && lateReason.trim().length < 10 ? 'var(--danger)' : 'var(--line-mid)'}`,
                background: 'var(--bg-raised)', color: 'var(--text-primary)',
                fontFamily: 'var(--font-body)', fontSize: 14,
                resize: 'none', lineHeight: 1.6, marginBottom: 4,
                boxSizing: 'border-box',
              }}
            />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              {lateReason.length > 0 && lateReason.trim().length < 10
                ? <span style={{ fontSize: 12, color: 'var(--danger-text)' }}>ต้องกรอกอย่างน้อย 10 ตัวอักษร ({lateReason.trim().length}/10)</span>
                : <span />
              }
              <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>{lateReason.length}/500</span>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => setShowReasonModal(false)}
                style={{ flex: 1, padding: '13px', borderRadius: 10, border: '1px solid var(--line-mid)', background: 'transparent', color: 'var(--text-secondary)', fontSize: 15, fontWeight: 600, fontFamily: 'var(--font-heading)', cursor: 'pointer' }}
              >
                ยกเลิก
              </button>
              <button
                onClick={() => doCheckin(lateReason)}
                disabled={lateReason.trim().length < 10 || loading}
                style={{
                  flex: 2, padding: '13px', borderRadius: 10, border: 'none',
                  background: lateReason.trim().length >= 10 ? 'var(--warn)' : 'var(--bg-active)',
                  color:      lateReason.trim().length >= 10 ? '#fff'         : 'var(--text-dim)',
                  fontSize: 15, fontWeight: 700, fontFamily: 'var(--font-heading)',
                  cursor: lateReason.trim().length >= 10 ? 'pointer' : 'not-allowed',
                }}
              >
                ยืนยันลงชื่อ (สาย)
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="animate-fade-up checkin-wrap">

        {/* ── Page header ── */}
        <div style={{ marginBottom: 22 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 4 }}>
            เช็คอิน · วันนี้
          </div>
          <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-heading)', letterSpacing: '-.01em' }}>
            ลงชื่อเข้า-ออกงาน
          </div>
        </div>

        {/* ── Main card ── */}
        <div className="animate-fade-up-d1" style={{ background: 'var(--bg-surface)', border: '1px solid var(--line)', borderRadius: 12, overflow: 'hidden', marginBottom: 14 }}>

          {/* Clock + status banner */}
          <div style={{ padding: '20px 20px 16px', textAlign: 'center' }}>
            <div style={{ marginBottom: 14, display: 'flex', justifyContent: 'center' }}>
              <LiveDot label="ระบบออนไลน์" />
            </div>
            <div className="checkin-clock" style={{ fontSize: 48, fontWeight: 700, letterSpacing: '-.04em', color: 'var(--text-primary)', lineHeight: 1, marginBottom: 6, fontVariantNumeric: 'tabular-nums' }}>
              {clock}
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', fontFamily: 'var(--font-body)' }}>
              {new Date().toLocaleDateString('th-TH', { timeZone: SCHOOL_TZ, weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </div>

            {/* Status banner: absent or late */}
            {(isAbsent || isLate) && (
              <div style={{ display: 'flex', justifyContent: 'center', marginTop: 10 }}>
                {isAbsent
                  ? <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: 'var(--danger-dim)', border: '1px solid rgba(220,38,38,.3)', borderRadius: 8, padding: '7px 16px', fontSize: 13, fontWeight: 600, color: 'var(--danger-text)', fontFamily: 'var(--font-body)' }}>
                      ⛔ เลยกำหนดเวลา {CHECKOUT_AFTER} น. แล้ว — สถานะบันทึกเป็น "ขาด"
                    </div>
                  : <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: 'var(--warn-dim)', border: '1px solid rgba(217,119,6,.3)', borderRadius: 8, padding: '7px 16px', fontSize: 13, fontWeight: 600, color: 'var(--warn-text)', fontFamily: 'var(--font-body)' }}>
                      ⚠ เกิน {CUTOFF} น. แล้ว — ต้องระบุเหตุผลก่อนลงชื่อ
                    </div>
                }
              </div>
            )}
          </div>

          {/* GPS badge */}
          <div style={{ padding: '0 20px 16px' }}>
            <div style={{ borderRadius: 10, padding: '12px 16px', background: gpsInfo.bg, border: gpsInfo.border }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: gpsInfo.dot, flexShrink: 0, marginTop: 6 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}>
                    {gpsInfo.title}
                  </div>
                  <div style={{ fontSize: 12, fontFamily: 'var(--font-body)', color: 'var(--text-muted)', marginTop: 3 }}>
                    {gpsInfo.sub}
                  </div>

                  {/* GPS error actions */}
                  {gpsInfo.isError && (
                    <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                        <button
                          onClick={detectGps}
                          style={{ padding: '6px 16px', borderRadius: 6, border: '1px solid var(--danger-text)', background: 'var(--danger-dim)', color: 'var(--danger-text)', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-body)' }}
                        >
                          ↺ ลองใหม่
                        </button>
                        <span style={{ fontSize: 13, color: 'var(--danger-text)', fontWeight: 600, fontFamily: 'var(--font-body)' }}>
                          ต้องแก้ไข GPS ก่อนจึงลงชื่อได้
                        </span>
                      </div>
                      {gpsErrCode !== 0 && (
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-body)', display: 'flex', alignItems: 'center', gap: 4 }}>
                          💡 แนะนำ: ใช้ <strong>Chrome</strong> หรือ <strong>Safari</strong> เพื่อผลลัพธ์ที่ดีกว่า
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Profile row */}
          <div style={{ padding: '14px 20px', borderTop: '1px solid var(--line)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {session?.user?.image
                ? <img src={session.user.image} alt="" style={{ width: 46, height: 46, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: '2px solid var(--line)' }} />
                : <div style={{ width: 46, height: 46, borderRadius: '50%', background: 'var(--bg-active)', border: '1px solid var(--line-mid)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 700, color: 'var(--accent)', flexShrink: 0 }}>
                    {session?.user?.nameTh?.slice(0, 2) ?? '??'}
                  </div>
              }
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-heading)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {session?.user?.nameTh}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-body)', marginTop: 1 }}>
                  {session?.user?.dept ?? 'ไม่ระบุแผนก'}
                </div>
                {today?.record?.late_reason && (
                  <div style={{ fontSize: 12, color: 'var(--warn-text)', fontFamily: 'var(--font-body)', marginTop: 4 }}>
                    ⚠ {today.record.late_reason}
                  </div>
                )}
              </div>
              <div style={{ marginLeft: 'auto', flexShrink: 0 }}>
                {statusChip()}
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div style={{ padding: '20px', borderTop: '1px solid var(--line)', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="checkin-btns" style={{ display: 'flex', gap: 10 }}>

              {/* ลงชื่อเข้า */}
              <button
                onClick={handleCheckin}
                disabled={checkinBtnDisabled}
                style={{
                  flex: 1, padding: '22px 8px', borderRadius: 12,
                  border: today?.checked_in ? '1px solid rgba(22,163,74,.3)'
                    : (!isAbsent && !isLate && gpsState === 'ok') ? '2px solid var(--ok-text)' : 'none',
                  fontSize: 18, fontWeight: 700, letterSpacing: '.01em',
                  fontFamily: 'var(--font-heading)',
                  cursor: checkinBtnDisabled ? 'not-allowed' : 'pointer',
                  background: checkinBtnBg,
                  color: checkinBtnColor,
                  opacity: gpsState === 'loading' || pendingCheckin ? 0.5 : 1,
                  transition: 'all .15s',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
                }}
              >
                <span style={{ lineHeight: 1.3, textAlign: 'center' }}>{today?.checked_in ? 'เข้าสำเร็จ' : isAbsent ? 'เลยกำหนดเวลา' : pendingCheckin ? 'กำลังระบุตำแหน่ง' : isLate ? 'ลงชื่อสาย' : 'ลงชื่อเข้างาน'}</span>
                <span style={{ fontSize: 12, fontWeight: 400, fontFamily: 'var(--font-mono)', opacity: 0.85, textAlign: 'center', lineHeight: 1.3 }}>
                  {today?.checked_in && today.record?.check_in_at
                    ? fmtTime(today.record.check_in_at)
                    : isAbsent           ? `>${CHECKOUT_AFTER} น.`
                    : pendingCheckin     ? 'รอสักครู่...'
                    : isLate             ? 'ระบุเหตุผล'
                    : gpsState === 'loading' ? 'กำลังระบุตำแหน่ง'
                    : gpsState === 'error'   ? 'แก้ไข GPS ก่อน'
                    : locMode === 'campus'   ? 'วิทยาลัย'
                    : 'WFH'}
                </span>
              </button>

              {/* ลงชื่อออก */}
              <button
                onClick={handleCheckout}
                disabled={loading || pendingCheckout || !today?.checked_in || !isAfterCheckoutTime()}
                style={{
                  flex: 1, padding: '22px 8px', borderRadius: 12,
                  fontSize: 18, fontWeight: 700, letterSpacing: '.01em',
                  fontFamily: 'var(--font-heading)',
                  cursor: today?.checked_in && isAfterCheckoutTime() && !pendingCheckout ? 'pointer' : 'not-allowed',
                  background: pendingCheckout ? 'var(--bg-raised)'
                    : !today?.checked_in || !isAfterCheckoutTime() ? 'transparent'
                    : today?.checked_out ? 'var(--ok-dim)' : 'var(--blue)',
                  color: pendingCheckout ? 'var(--text-dim)'
                    : !today?.checked_in || !isAfterCheckoutTime() ? 'var(--text-dim)'
                    : today?.checked_out ? 'var(--ok-text)' : '#fff',
                  border: today?.checked_in && isAfterCheckoutTime() && !today?.checked_out && !pendingCheckout
                    ? '2px solid var(--blue-text)'
                    : today?.checked_in && isAfterCheckoutTime() && today?.checked_out
                    ? '1px solid rgba(22,163,74,.3)'
                    : '1px solid var(--line-mid)',
                  opacity: pendingCheckout ? 0.6 : 1,
                  transition: 'all .15s',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
                }}
              >
                <span style={{ lineHeight: 1.3, textAlign: 'center' }}>{pendingCheckout ? 'กำลังระบุตำแหน่ง' : today?.checked_out ? 'ออกสำเร็จ' : 'ลงชื่อออกงาน'}</span>
                <span style={{ fontSize: 12, fontWeight: 400, fontFamily: 'var(--font-mono)', opacity: 0.85, textAlign: 'center', lineHeight: 1.3 }}>
                  {pendingCheckout ? 'รอสักครู่...'
                    : today?.checked_out && today.record?.check_out_at
                    ? fmtTime(today.record.check_out_at)
                    : `หลัง ${CHECKOUT_AFTER} น.`}
                </span>
              </button>
            </div>

            {/* Footer rule */}
            <div style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-body)', textAlign: 'center', lineHeight: 1.8 }}>
              เกิน {CUTOFF} น. = มาสาย (ต้องระบุเหตุผล) &nbsp;·&nbsp; ไม่ลงชื่อก่อน {CHECKOUT_AFTER} น. = ขาด
            </div>
          </div>
        </div>

        {/* ── History (7 days) ── */}
        <div className="animate-fade-up-d2">
          <Panel>
            <PanelHeader title="ประวัติ 7 วันล่าสุด" />

            {history.length === 0 && (
              <div style={{ padding: '28px 16px', textAlign: 'center', fontSize: 14, color: 'var(--text-muted)', fontFamily: 'var(--font-body)' }}>
                ยังไม่มีประวัติการลงชื่อ
              </div>
            )}
            {history.map(r => (
              <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderBottom: '1px solid var(--line)' }}>

                {/* วันที่ */}
                <div style={{ width: 72, flexShrink: 0, fontSize: 13, color: 'var(--text-secondary)', fontFamily: 'var(--font-body)', lineHeight: 1.3 }}>
                  {new Date(r.date + 'T00:00:00').toLocaleDateString('th-TH', { timeZone: SCHOOL_TZ, weekday: 'short', day: 'numeric', month: 'short' })}
                </div>

                {/* เข้างาน */}
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 5, minWidth: 0 }}>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-body)', flexShrink: 0 }}>เข้า</span>
                  <span style={{ fontSize: 13, fontWeight: 600, fontFamily: 'var(--font-mono)', color: r.check_in_at ? 'var(--text-primary)' : 'var(--text-dim)', flexShrink: 0 }}>
                    {r.check_in_at ? fmtTime(r.check_in_at) : '—'}
                  </span>
                  {r.check_in_at && <LocBadge mode={r.location_mode} />}
                </div>

                <div style={{ color: 'var(--line-mid)', fontSize: 12, flexShrink: 0 }}>·</div>

                {/* ออกงาน */}
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 5, minWidth: 0 }}>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-body)', flexShrink: 0 }}>ออก</span>
                  <span style={{ fontSize: 13, fontWeight: 600, fontFamily: 'var(--font-mono)', color: r.check_out_at ? 'var(--text-primary)' : 'var(--text-dim)', flexShrink: 0 }}>
                    {r.check_out_at ? fmtTime(r.check_out_at) : '—'}
                  </span>
                  {r.check_out_at && <LocBadge mode={r.check_out_location_mode ?? r.location_mode} />}
                </div>

              </div>
            ))}
          </Panel>
        </div>

      </div>
    </AppShell>
  )
}
