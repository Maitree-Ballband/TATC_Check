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

function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function isAfterCheckoutTime() {
  const [h, m] = CHECKOUT_AFTER.split(':').map(Number)
  const now = new Date()
  return now.getHours() * 60 + now.getMinutes() >= h * 60 + m
}

function isPastAbsentCutoff() {
  const [h, m] = ABSENT_CUTOFF.split(':').map(Number)
  const now = new Date()
  return now.getHours() * 60 + now.getMinutes() > h * 60 + m
}

export default function CheckinPage() {
  const { data: session } = useSession()
  const [today, setToday]       = useState<TodayStatus | null>(null)
  const [history, setHistory]   = useState<AttendanceRecord[]>([])
  const [gpsState, setGpsState] = useState<'loading' | 'ok' | 'error'>('loading')
  const [coords, setCoords]     = useState<{ lat: number; lng: number } | null>(null)
  const [distance, setDistance] = useState<number | null>(null)
  const [autoMode, setAutoMode] = useState<'campus' | 'wfh'>('campus')
  const [loading, setLoading]   = useState(false)
  const [clock, setClock]       = useState('')
  const [toast, setToast]       = useState<{ msg: string; type: string } | null>(null)

  // Live clock
  useEffect(() => {
    const tick = () => setClock(new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  // Auto-detect GPS on mount
  useEffect(() => {
    if (!navigator.geolocation) { setGpsState('error'); return }
    navigator.geolocation.getCurrentPosition(
      pos => {
        const { latitude, longitude } = pos.coords
        setCoords({ lat: latitude, lng: longitude })
        const dist = haversine(latitude, longitude, SCHOOL_LAT, SCHOOL_LNG)
        setDistance(dist)
        setAutoMode(dist <= RADIUS_M ? 'campus' : 'wfh')
        setGpsState('ok')
      },
      () => setGpsState('error'),
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }, [])

  const fetchToday = useCallback(async () => {
    const res = await fetch('/api/attendance/today')
    if (res.ok) setToday(await res.json())
  }, [])

  const fetchHistory = useCallback(async () => {
    const to   = new Date().toISOString().slice(0, 10)
    const from = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10)
    const res  = await fetch(`/api/attendance/history?from=${from}&to=${to}`)
    if (res.ok) { const d = await res.json(); setHistory(d.records ?? []) }
  }, [])

  useEffect(() => { fetchToday(); fetchHistory() }, [fetchToday, fetchHistory])

  const showToast = (msg: string, type = 'ok') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3200)
  }

  const handleCheckin = async () => {
    if (today?.checked_in) return
    if (isAbsent) { showToast(`พ้นเวลา ${ABSENT_CUTOFF} น. แล้ว — บันทึกว่า "ขาด"`, 'danger'); return }
    if (gpsState === 'loading') { showToast('กำลังตรวจสอบตำแหน่ง กรุณารอสักครู่', 'warn'); return }
    if (gpsState === 'error')   { showToast('ไม่พบ GPS กรุณาอนุญาตการเข้าถึงตำแหน่ง', 'danger'); return }
    setLoading(true)
    const body: Record<string, unknown> = { location_mode: autoMode }
    if (autoMode === 'campus' && coords) { body.lat = coords.lat; body.lng = coords.lng }

    const res  = await fetch('/api/attendance/checkin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const data = await res.json()
    setLoading(false)

    if (res.ok) {
      const label = autoMode === 'campus' ? 'วิทยาลัย' : 'WFH'
      showToast(`เช็คอินสำเร็จ — ${label} · ${new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', hour12: false })} น.`, 'ok')
      fetchToday(); fetchHistory()
    } else if (data.error === 'already_checked_in') {
      showToast('เช็คอินแล้วในวันนี้', 'warn')
    } else {
      showToast('เกิดข้อผิดพลาด กรุณาลองใหม่', 'danger')
    }
  }

  const handleCheckout = async () => {
    if (!today?.checked_in || today?.checked_out) return
    if (!isAfterCheckoutTime()) { showToast(`เช็คเอาท์ได้หลัง ${CHECKOUT_AFTER} น. เท่านั้น`, 'warn'); return }
    setLoading(true)
    const res = await fetch('/api/attendance/checkout', { method: 'POST' })
    setLoading(false)
    if (res.ok) {
      showToast(`เช็คเอาท์สำเร็จ · ${new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', hour12: false })} น.`, 'ok')
      fetchToday()
    }
  }

  const isAbsent = !today?.checked_in && isPastAbsentCutoff()

  const statusChip = () => {
    if (isAbsent)                              return <Chip variant="danger"  label="ขาด" />
    if (!today?.checked_in)                    return <Chip variant="neutral" label="ยังไม่ลงชื่อ" />
    if (today.record?.location_mode === 'wfh') return <Chip variant="blue"   label="WFH" />
    if (today.record?.status === 'late')       return <Chip variant="warn"   label="สาย" />
    return <Chip variant="ok" label="ลงชื่อแล้ว" />
  }

  const toastColor: Record<string, string> = { ok: 'var(--ok)', warn: 'var(--warn)', danger: 'var(--danger)' }
  const isCampus = autoMode === 'campus'

  // Location badge colors
  const locBg     = gpsState === 'error' ? 'var(--danger-dim)' : isCampus ? 'var(--ok-dim)'   : 'var(--blue-dim)'
  const locBorder = gpsState === 'error' ? '1px solid rgba(224,90,90,.2)' : isCampus ? '1px solid rgba(95,184,130,.2)' : '1px solid rgba(91,142,240,.2)'
  const locColor  = gpsState === 'error' ? 'var(--danger-text)' : isCampus ? 'var(--ok-text)' : 'var(--blue-text)'

  return (
    <AppShell>
      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, background: 'var(--bg-raised)', border: '1px solid var(--line-mid)', borderRadius: 8, padding: '11px 16px', fontSize: 13, color: 'var(--text-primary)', zIndex: 200, display: 'flex', alignItems: 'center', gap: 10, boxShadow: '0 8px 32px rgba(0,0,0,.5)', maxWidth: 340 }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: toastColor[toast.type] ?? 'var(--ok)', flexShrink: 0 }} />
          {toast.msg}
        </div>
      )}

      <div className="animate-fade-up" style={{ maxWidth: 440, margin: '0 auto' }}>
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
            <div style={{ fontSize: 48, fontWeight: 700, letterSpacing: '-.04em', color: 'var(--text-primary)', lineHeight: 1, marginBottom: 4, fontVariantNumeric: 'tabular-nums' }}>
              {clock}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              {new Date().toLocaleDateString('th-TH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </div>
          </div>

          {/* GPS location badge */}
          <div style={{ padding: '0 20px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, borderRadius: 10, padding: '12px 16px', background: locBg, border: locBorder }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: locColor, flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: locColor, fontFamily: 'var(--font-heading)' }}>
                  {gpsState === 'loading' ? 'กำลังตรวจสอบตำแหน่ง...'
                    : gpsState === 'error' ? 'ไม่พบ GPS — กรุณาอนุญาตตำแหน่ง'
                    : isCampus ? 'อยู่ในพื้นที่วิทยาลัย'
                    : 'อยู่นอกพื้นที่ (WFH)'}
                </div>
                <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', marginTop: 2 }}>
                  {gpsState === 'ok' && distance !== null
                    ? `ห่าง ${Math.round(distance)} เมตร · เกณฑ์ไม่เกิน ${RADIUS_M} เมตร จากวิทยาลัย`
                    : gpsState === 'loading' ? 'รอสักครู่...'
                    : 'โหลดหน้าใหม่หลังอนุญาต GPS'}
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
              <div>
                <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}>{session?.user?.nameTh}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{session?.user?.dept ?? 'ไม่ระบุแผนก'}</div>
              </div>
              <div style={{ marginLeft: 'auto' }}>{statusChip()}</div>
            </div>

            {/* Summary row after checked in */}
            {today?.checked_in && today.record && (
              <div style={{ background: 'var(--bg-raised)', border: '1px solid var(--line)', borderRadius: 8, padding: '10px 14px', marginTop: 12, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                {[
                  { label: 'ลงชื่อเข้า', val: today.record.check_in_at ? new Date(today.record.check_in_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', hour12: false }) : '—' },
                  { label: 'ลงชื่อออก', val: today.record.check_out_at ? new Date(today.record.check_out_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', hour12: false }) : '—' },
                  { label: 'สถานที่', val: today.record.location_mode === 'wfh' ? 'WFH' : 'วิทยาลัย' },
                ].map(f => (
                  <div key={f.label}>
                    <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 3 }}>{f.label}</div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{f.val}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Big action buttons — side by side */}
          <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', gap: 10 }}>

              {/* ลงชื่อเข้า */}
              <button
                onClick={handleCheckin}
                disabled={loading || !!today?.checked_in || isAbsent || gpsState !== 'ok'}
                style={{
                  flex: 1, padding: '22px 8px', borderRadius: 12, border: 'none',
                  fontSize: 18, fontWeight: 700, letterSpacing: '.01em',
                  fontFamily: 'var(--font-heading)',
                  cursor: (today?.checked_in || isAbsent || gpsState !== 'ok') ? 'not-allowed' : 'pointer',
                  background: today?.checked_in
                    ? 'var(--bg-active)'
                    : isAbsent
                    ? 'var(--danger-dim)'
                    : gpsState !== 'ok'
                    ? 'var(--bg-raised)'
                    : 'var(--text-primary)',
                  color: today?.checked_in
                    ? 'var(--text-muted)'
                    : isAbsent
                    ? 'var(--danger-text)'
                    : gpsState !== 'ok'
                    ? 'var(--text-dim)'
                    : 'var(--bg-base)',
                  transition: 'all .15s',
                  opacity: gpsState === 'loading' ? 0.5 : 1,
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
                }}
              >
                <span>{isAbsent ? 'ขาด' : 'ลงชื่อเข้า'}</span>
                <span style={{ fontSize: 12, fontWeight: 400, fontFamily: 'var(--font-mono)', opacity: 0.75 }}>
                  {today?.checked_in && today.record?.check_in_at
                    ? new Date(today.record.check_in_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', hour12: false }) + ' น.'
                    : isAbsent
                    ? `พ้นเวลา ${ABSENT_CUTOFF} น.`
                    : gpsState === 'loading' ? 'กำลังตรวจสอบ...'
                    : gpsState === 'error'   ? 'ไม่พบ GPS'
                    : isCampus ? 'วิทยาลัย' : 'WFH'}
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
                  background: today?.checked_out
                    ? 'var(--bg-active)'
                    : today?.checked_in
                    ? 'var(--blue-dim)'
                    : 'transparent',
                  color: today?.checked_out
                    ? 'var(--text-muted)'
                    : today?.checked_in
                    ? 'var(--blue-text)'
                    : 'var(--text-dim)',
                  border: today?.checked_in && !today?.checked_out
                    ? '2px solid rgba(91,142,240,.35)'
                    : '1px solid var(--line-mid)',
                  transition: 'all .15s',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
                }}
              >
                <span>ลงชื่อออก</span>
                <span style={{ fontSize: 12, fontWeight: 400, fontFamily: 'var(--font-mono)', opacity: 0.75 }}>
                  {today?.checked_out && today.record?.check_out_at
                    ? new Date(today.record.check_out_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', hour12: false }) + ' น.'
                    : 'หลัง ' + CHECKOUT_AFTER + ' น.'}
                </span>
              </button>
            </div>

            <div style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', textAlign: 'center' }}>
              ลงชื่อหลัง {CUTOFF} น. = สาย · ไม่ลงชื่อก่อน {ABSENT_CUTOFF} น. = ขาด · ลงชื่อออกได้หลัง {CHECKOUT_AFTER} น.
            </div>
          </div>
        </div>

        {/* History */}
        <div className="animate-fade-up-d2">
          <Panel>
            <PanelHeader title="ประวัติ 7 วันล่าสุด" />
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
                      {new Date(r.date).toLocaleDateString('th-TH', { weekday: 'short', day: '2-digit', month: 'short' })}
                    </td>
                    <td style={{ padding: '11px 14px' }}><LocBadge mode={r.location_mode} /></td>
                    <td style={{ padding: '11px 14px', fontSize: 15, fontWeight: 600, fontFamily: "'Sarabun', sans-serif", color: r.check_in_at ? 'var(--text-primary)' : 'var(--text-dim)' }}>
                      {r.check_in_at ? new Date(r.check_in_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', hour12: false }) + ' น.' : '—'}
                    </td>
                    <td style={{ padding: '11px 14px', fontSize: 15, fontWeight: 600, fontFamily: "'Sarabun', sans-serif", color: r.check_out_at ? 'var(--text-primary)' : 'var(--text-dim)' }}>
                      {r.check_out_at ? new Date(r.check_out_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', hour12: false }) + ' น.' : '—'}
                    </td>
                    <td style={{ padding: '11px 14px' }}>
                      {r.status === 'present' && <Chip variant="ok"   label="ปกติ" />}
                      {r.status === 'late'    && <Chip variant="warn" label="สาย" />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>
        </div>
      </div>
    </AppShell>
  )
}
