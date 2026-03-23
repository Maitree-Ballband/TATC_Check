'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  from: string  // YYYY-MM-DD
  to:   string  // YYYY-MM-DD
}

export function ReportControls({ from, to }: Props) {
  const router = useRouter()
  const [localFrom, setLocalFrom] = useState(from)
  const [localTo,   setLocalTo]   = useState(to)

  const [enableIn,    setEnableIn]    = useState(false)
  const [enableOut,   setEnableOut]   = useState(false)
  const [timeInFrom,  setTimeInFrom]  = useState('06:00')
  const [timeInTo,    setTimeInTo]    = useState('09:00')
  const [timeOutFrom, setTimeOutFrom] = useState('15:00')
  const [timeOutTo,   setTimeOutTo]   = useState('18:00')

  function apply() {
    if (!localFrom || !localTo || localFrom > localTo) return
    router.push(`/report?from=${localFrom}&to=${localTo}`)
  }

  function buildExportUrl(fmt: 'csv' | 'txt') {
    const p = new URLSearchParams({ from, to, format: fmt })
    if (enableIn)  { p.set('timeInFrom', timeInFrom);  p.set('timeInTo', timeInTo) }
    if (enableOut) { p.set('timeOutFrom', timeOutFrom); p.set('timeOutTo', timeOutTo) }
    return `/api/admin/export-raw?${p.toString()}`
  }

  const inputS: React.CSSProperties = {
    padding: '7px 10px', borderRadius: 7, fontSize: 13,
    background: 'var(--bg-raised)', border: '1px solid var(--line-mid)',
    color: 'var(--text-primary)', fontFamily: "'Sarabun', sans-serif",
    cursor: 'pointer',
  }

  const timeInputS: React.CSSProperties = {
    ...inputS, padding: '5px 8px', fontSize: 12, width: 90,
  }

  const disabledTimeInputS: React.CSSProperties = {
    ...timeInputS, opacity: .4, pointerEvents: 'none',
  }

  const labelS: React.CSSProperties = {
    display: 'block', fontSize: 10.5, fontWeight: 600,
    color: 'var(--text-muted)', letterSpacing: '.07em',
    textTransform: 'uppercase', marginBottom: 4,
  }

  const canApply = localFrom && localTo && localFrom <= localTo

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>

      {/* ── Row 1: Date range + apply ── */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, flexWrap: 'wrap' }}>
        <div>
          <label style={labelS}>ตั้งแต่วันที่</label>
          <input
            type="date"
            value={localFrom}
            onChange={e => setLocalFrom(e.target.value)}
            style={inputS}
          />
        </div>

        <div style={{ paddingBottom: 8, fontSize: 13, color: 'var(--text-muted)' }}>—</div>

        <div>
          <label style={labelS}>ถึงวันที่</label>
          <input
            type="date"
            value={localTo}
            min={localFrom}
            onChange={e => setLocalTo(e.target.value)}
            style={inputS}
          />
        </div>

        <button
          onClick={apply}
          disabled={!canApply}
          style={{
            padding: '7px 18px', borderRadius: 7, fontSize: 13, fontWeight: 600,
            background: canApply ? 'var(--accent)' : 'var(--bg-raised)',
            color: canApply ? '#fff' : 'var(--text-muted)',
            border: `1px solid ${canApply ? 'var(--accent)' : 'var(--line-mid)'}`,
            cursor: canApply ? 'pointer' : 'default',
            fontFamily: "'Sarabun', sans-serif",
            transition: 'all .15s',
            boxShadow: canApply ? '0 2px 6px rgba(61,90,241,.2)' : 'none',
          }}
        >
          ดูรายงาน
        </button>
      </div>

      {/* ── Row 2: Time filter + export ── */}
      <div style={{
        background: 'var(--bg-raised)', border: '1px solid var(--line)',
        borderRadius: 10, padding: '12px 16px',
        display: 'flex', flexDirection: 'column', gap: 10,
        alignItems: 'flex-start', width: '100%',
      }}>
        <div style={{
          fontSize: 10.5, fontWeight: 600, color: 'var(--text-muted)',
          letterSpacing: '.07em', textTransform: 'uppercase',
        }}>
          กรองเวลา &amp; Export
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', width: '100%' }}>

          {/* Check-in filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', fontSize: 12.5, color: 'var(--text-secondary)', fontWeight: 500, whiteSpace: 'nowrap' }}>
              <input
                type="checkbox"
                checked={enableIn}
                onChange={e => setEnableIn(e.target.checked)}
                style={{ width: 14, height: 14, cursor: 'pointer', accentColor: 'var(--accent)' }}
              />
              ช่วงเข้า
            </label>
            <input type="time" value={timeInFrom} onChange={e => setTimeInFrom(e.target.value)}
              style={enableIn ? timeInputS : disabledTimeInputS} tabIndex={enableIn ? 0 : -1} />
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>—</span>
            <input type="time" value={timeInTo} onChange={e => setTimeInTo(e.target.value)}
              style={enableIn ? timeInputS : disabledTimeInputS} tabIndex={enableIn ? 0 : -1} />
          </div>

          {/* Check-out filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', fontSize: 12.5, color: 'var(--text-secondary)', fontWeight: 500, whiteSpace: 'nowrap' }}>
              <input
                type="checkbox"
                checked={enableOut}
                onChange={e => setEnableOut(e.target.checked)}
                style={{ width: 14, height: 14, cursor: 'pointer', accentColor: 'var(--accent)' }}
              />
              ช่วงออก
            </label>
            <input type="time" value={timeOutFrom} onChange={e => setTimeOutFrom(e.target.value)}
              style={enableOut ? timeInputS : disabledTimeInputS} tabIndex={enableOut ? 0 : -1} />
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>—</span>
            <input type="time" value={timeOutTo} onChange={e => setTimeOutTo(e.target.value)}
              style={enableOut ? timeInputS : disabledTimeInputS} tabIndex={enableOut ? 0 : -1} />
          </div>

          {/* Export buttons */}
          <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
            <a href={buildExportUrl('csv')} download style={{ textDecoration: 'none' }}>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '7px 16px', borderRadius: 7, fontSize: 13, fontWeight: 600,
                background: 'var(--accent)', color: '#fff',
                border: '1px solid var(--accent)', cursor: 'pointer',
                fontFamily: "'Sarabun', sans-serif",
                boxShadow: '0 2px 6px rgba(61,90,241,.2)',
              }}>
                <svg width="12" height="12" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M6.5 1v8M3.5 6l3 3 3-3M1 10v1.5A1.5 1.5 0 002.5 13h8a1.5 1.5 0 001.5-1.5V10"/>
                </svg>
                CSV
              </span>
            </a>

            <a href={buildExportUrl('txt')} download style={{ textDecoration: 'none' }}>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '7px 16px', borderRadius: 7, fontSize: 13, fontWeight: 600,
                background: 'var(--ok)', color: 'var(--ok-text)',
                border: '1px solid var(--ok)', cursor: 'pointer',
                fontFamily: "'Sarabun', sans-serif",
                boxShadow: '0 2px 6px rgba(0,0,0,.08)',
              }}>
                <svg width="12" height="12" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M6.5 1v8M3.5 6l3 3 3-3M1 10v1.5A1.5 1.5 0 002.5 13h8a1.5 1.5 0 001.5-1.5V10"/>
                </svg>
                TXT
              </span>
            </a>
          </div>

        </div>

        <div style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>
          หากไม่เลือกกรองเวลา จะ export เวลาเช็คอินทั้งหมดในช่วงวันที่
        </div>
      </div>

    </div>
  )
}
