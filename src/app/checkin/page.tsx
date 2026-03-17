'use client'
import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { AppShell } from '@/components/layout/AppShell'
import { Chip, LocBadge, LiveDot, Panel, PanelHeader } from '@/components/ui'
import type { LocationMode, TodayStatus, AttendanceRecord } from '@/types'

const CUTOFF = '08:30'

export default function CheckinPage() {
  const { data: session } = useSession()
  const [mode, setMode]         = useState<LocationMode>('campus')
  const [today, setToday]       = useState<TodayStatus | null>(null)
  const [history, setHistory]   = useState<AttendanceRecord[]>([])
  const [gpsOk, setGpsOk]       = useState<boolean | null>(null)
  const [coords, setCoords]     = useState<{ lat: number; lng: number } | null>(null)
  const [loading, setLoading]   = useState(false)
  const [clock, setClock]       = useState('')
  const [toast, setToast]       = useState<{ msg: string; type: string } | null>(null)

  // Live clock
  useEffect(() => {
    const tick = () => setClock(new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }))
    tick(); const id = setInterval(tick, 1000); return () => clearInterval(id)
  }, [])

  // GPS on campus mode
  useEffect(() => {
    if (mode !== 'campus') { setGpsOk(true); return }
    navigator.geolocation?.getCurrentPosition(
      pos => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        setGpsOk(true)
      },
      () => setGpsOk(false),
      { enableHighAccuracy: true, timeout: 8000 }
    )
  }, [mode])

  // Fetch today status
  const fetchToday = useCallback(async () => {
    const res = await fetch('/api/attendance/today')
    if (res.ok) setToday(await res.json())
  }, [])

  // Fetch history
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
    setLoading(true)
    const body: Record<string, unknown> = { location_mode: mode }
    if (mode === 'campus' && coords) { body.lat = coords.lat; body.lng = coords.lng }

    const res = await fetch('/api/attendance/checkin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const data = await res.json()
    setLoading(false)

    if (res.ok) {
      showToast(`เช็คอินสำเร็จ — ${mode === 'campus' ? 'วิทยาลัย' : 'WFH'} · ${new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', hour12: false })} น.`, 'ok')
      fetchToday(); fetchHistory()
    } else if (data.error === 'outside_geofence') {
      showToast('อยู่นอกพื้นที่วิทยาลัย — ไม่สามารถเช็คอินได้', 'danger')
    } else if (data.error === 'already_checked_in') {
      showToast('เช็คอินแล้วในวันนี้', 'warn')
    } else {
      showToast('เกิดข้อผิดพลาด กรุณาลองใหม่', 'danger')
    }
  }

  const handleCheckout = async () => {
    if (!today?.checked_in || today?.checked_out) return
    setLoading(true)
    const res = await fetch('/api/attendance/checkout', { method: 'POST' })
    setLoading(false)
    if (res.ok) {
      showToast(`เช็คเอาท์สำเร็จ · ${new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', hour12: false })} น.`, 'ok')
      fetchToday()
    }
  }

  const statusChip = () => {
    if (!today?.checked_in)  return <Chip variant="neutral" label="ยังไม่เช็คอิน" />
    if (today.record?.location_mode === 'wfh') return <Chip variant="blue" label="WFH" />
    if (today.record?.status === 'late')       return <Chip variant="warn"    label="สาย" />
    return <Chip variant="ok" label="เช็คอินแล้ว" />
  }

  const toastColor: Record<string, string> = { ok: 'var(--ok)', warn: 'var(--warn)', danger: 'var(--danger)', blue: 'var(--blue)' }

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
          <div style={{ fontSize: 22, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-.02em' }}>ยืนยันการเข้างาน</div>
        </div>

        {/* Check-in card */}
        <div className="animate-fade-up-d1" style={{ background: 'var(--bg-surface)', border: '1px solid var(--line)', borderRadius: 12, overflow: 'hidden', marginBottom: 14 }}>
          {/* Top: clock + mode */}
          <div style={{ padding: 20, borderBottom: '1px solid var(--line)' }}>
            <div style={{ marginBottom: 14 }}><LiveDot label="ระบบออนไลน์" /></div>
            <div style={{ fontSize: 40, fontWeight: 600, letterSpacing: '-.04em', color: 'var(--text-primary)', lineHeight: 1, marginBottom: 4, fontVariantNumeric: 'tabular-nums' }}>{clock}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              {new Date().toLocaleDateString('th-TH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </div>

            {/* Location mode toggle */}
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 10.5, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 8 }}>ฉันปฏิบัติงานที่</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                {(['campus', 'wfh'] as LocationMode[]).map(m => (
                  <button key={m} onClick={() => setMode(m)} style={{
                    padding: '9px 10px', borderRadius: 8, fontSize: 12, fontWeight: 500,
                    fontFamily: 'var(--font-sans)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, transition: 'all .15s',
                    background: mode === m ? (m === 'campus' ? 'var(--ok-dim)' : 'var(--blue-dim)') : 'transparent',
                    color:      mode === m ? (m === 'campus' ? 'var(--ok-text)' : 'var(--blue-text)') : 'var(--text-secondary)',
                    border:     mode === m ? (m === 'campus' ? '1px solid rgba(95,184,130,.25)' : '1px solid rgba(91,142,240,.25)') : '1px solid var(--line-mid)',
                  }}>
                    {m === 'campus' ? '🏫 วิทยาลัย' : '🏠 WFH'}
                  </button>
                ))}
              </div>
            </div>

            {/* GPS status */}
            <div style={{
              display: 'flex', alignItems: 'flex-start', gap: 8, borderRadius: 8, padding: '9px 12px', marginTop: 10,
              background: mode === 'wfh' ? 'var(--blue-dim)' : gpsOk === false ? 'var(--danger-dim)' : 'var(--ok-dim)',
              border: mode === 'wfh' ? '1px solid rgba(91,142,240,.15)' : gpsOk === false ? '1px solid rgba(224,90,90,.15)' : '1px solid rgba(95,184,130,.15)',
            }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 500, color: mode === 'wfh' ? 'var(--blue-text)' : gpsOk === false ? 'var(--danger-text)' : 'var(--ok-text)' }}>
                  {mode === 'wfh' ? 'ทำงานจากที่บ้าน (WFH)' : gpsOk === false ? 'ไม่พบ GPS หรืออยู่นอกพื้นที่' : 'อยู่ในพื้นที่วิทยาลัย'}
                </div>
                <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', marginTop: 1 }}>
                  {mode === 'wfh' ? 'ยืนยันตำแหน่งอัตโนมัติ' : coords ? `${coords.lat.toFixed(4)}° N, ${coords.lng.toFixed(4)}° E` : 'กำลังหาตำแหน่ง...'}
                </div>
              </div>
            </div>
          </div>

          {/* Profile + selfie */}
          <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--line)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
              <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--bg-active)', border: '1px solid var(--line-mid)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 600, color: 'var(--accent)', flexShrink: 0 }}>
                {session?.user?.nameTh?.slice(0, 2) ?? '??'}
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{session?.user?.nameTh}</div>
                <div style={{ fontSize: 11.5, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{session?.user?.dept ?? 'ไม่ระบุแผนก'}</div>
              </div>
              <div style={{ marginLeft: 'auto' }}>{statusChip()}</div>
            </div>

            {/* Status display if already checked in */}
            {today?.checked_in && today.record && (
              <div style={{ background: 'var(--bg-raised)', border: '1px solid var(--line)', borderRadius: 8, padding: 12 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                  {[
                    { label: 'เช็คอิน', val: today.record.check_in_at ? new Date(today.record.check_in_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', hour12: false }) : '—' },
                    { label: 'เช็คเอาท์', val: today.record.check_out_at ? new Date(today.record.check_out_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', hour12: false }) : '—' },
                    { label: 'สถานที่', val: today.record.location_mode === 'wfh' ? 'WFH' : 'วิทยาลัย' },
                  ].map(f => (
                    <div key={f.label}>
                      <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 3 }}>{f.label}</div>
                      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{f.val}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
          <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button
              onClick={handleCheckin}
              disabled={loading || !!today?.checked_in}
              style={{
                width: '100%', padding: 11, borderRadius: 8, border: 'none', fontSize: 13, fontWeight: 600,
                cursor: today?.checked_in ? 'not-allowed' : 'pointer',
                background: today?.checked_in ? 'var(--bg-active)' : 'var(--text-primary)',
                color: today?.checked_in ? 'var(--text-muted)' : 'var(--bg-base)',
                fontFamily: 'var(--font-sans)', letterSpacing: '.01em', transition: 'all .15s',
              }}
            >
              {today?.checked_in ? `เช็คอินแล้ว ${today.record?.check_in_at ? new Date(today.record.check_in_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', hour12: false }) + ' น.' : ''}` : loading ? 'กำลังบันทึก...' : 'ยืนยันเช็คอิน'}
            </button>
            <button
              onClick={handleCheckout}
              disabled={loading || !today?.checked_in || !!today?.checked_out}
              style={{
                width: '100%', padding: 11, borderRadius: 8, fontSize: 13, fontWeight: 500,
                cursor: (!today?.checked_in || today?.checked_out) ? 'not-allowed' : 'pointer',
                background: 'transparent', color: 'var(--text-secondary)',
                border: '1px solid var(--line-mid)', fontFamily: 'var(--font-sans)', transition: 'all .15s',
              }}
            >
              {today?.checked_out ? 'เช็คเอาท์แล้ว' : 'ยืนยันเช็คเอาท์'}
            </button>
          </div>
        </div>

        {/* History */}
        <div className="animate-fade-up-d2">
          <Panel>
            <PanelHeader title="ประวัติ 7 วันล่าสุด" />
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>{['วันที่', 'สถานที่', 'เข้า', 'สถานะ'].map(h => (
                  <th key={h} style={{ padding: '8px 14px', fontSize: 10.5, color: 'var(--text-muted)', textAlign: 'left', borderBottom: '1px solid var(--line)', letterSpacing: '.07em', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {history.length === 0 && (
                  <tr><td colSpan={4} style={{ padding: '20px 14px', textAlign: 'center', fontSize: 12, color: 'var(--text-muted)' }}>ไม่มีประวัติ</td></tr>
                )}
                {history.map(r => (
                  <tr key={r.id} style={{ borderBottom: '1px solid var(--line)' }}>
                    <td style={{ padding: '9px 14px', fontSize: 12.5, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                      {new Date(r.date).toLocaleDateString('th-TH', { day: '2-digit', month: 'short' })}
                    </td>
                    <td style={{ padding: '9px 14px' }}><LocBadge mode={r.location_mode} /></td>
                    <td style={{ padding: '9px 14px', fontSize: 12.5, fontFamily: 'var(--font-mono)', color: r.check_in_at ? 'var(--text-primary)' : 'var(--text-dim)' }}>
                      {r.check_in_at ? new Date(r.check_in_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', hour12: false }) : '—'}
                    </td>
                    <td style={{ padding: '9px 14px' }}>
                      {r.status === 'present' && <Chip variant="ok"      label="ปกติ" />}
                      {r.status === 'late'    && <Chip variant="warn"    label="สาย" />}
                      {r.status === 'absent'  && <Chip variant="danger"  label="ขาด" />}
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
