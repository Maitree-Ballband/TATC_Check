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

  function changeFrom(val: string) {
    setLocalFrom(val)
    if (val && localTo && val <= localTo) {
      router.push(`/report?from=${val}&to=${localTo}`)
    }
  }

  function changeTo(val: string) {
    setLocalTo(val)
    if (localFrom && val && localFrom <= val) {
      router.push(`/report?from=${localFrom}&to=${val}`)
    }
  }

  function doExport(fmt: 'csv' | 'txt') {
    const p = new URLSearchParams({ from: localFrom, to: localTo, format: fmt })
    if (enableIn)  { p.set('timeInFrom', timeInFrom);  p.set('timeInTo', timeInTo) }
    if (enableOut) { p.set('timeOutFrom', timeOutFrom); p.set('timeOutTo', timeOutTo) }
    window.location.href = `/api/admin/export-raw?${p.toString()}`
  }

  const canExport = !!(localFrom && localTo && localFrom <= localTo)

  /* ── Shared styles ─────────────────────────────────────────── */
  const inputS: React.CSSProperties = {
    padding: '7px 10px', borderRadius: 7, fontSize: 13,
    background: 'var(--bg-raised)', border: '1px solid var(--line-mid)',
    color: 'var(--text-primary)', fontFamily: "'Sarabun', sans-serif",
    cursor: 'pointer',
  }

  const timeInputS: React.CSSProperties = {
    ...inputS, padding: '5px 8px', fontSize: 12, width: 86,
  }

  const labelS: React.CSSProperties = {
    fontSize: 10.5, fontWeight: 600, color: 'var(--text-muted)',
    letterSpacing: '.07em', textTransform: 'uppercase' as const,
    marginBottom: 4, display: 'block',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'flex-end' }}>

      {/* ── Date range ─────────────────────────────────────────── */}
      <div style={{
        background: 'var(--bg-raised)', border: '1px solid var(--line)',
        borderRadius: 10, padding: '12px 16px',
        display: 'flex', alignItems: 'flex-end', gap: 10, flexWrap: 'wrap',
      }}>
        <div>
          <label style={labelS}>ตั้งแต่วันที่</label>
          <input
            type="date"
            value={localFrom}
            onChange={e => changeFrom(e.target.value)}
            style={inputS}
          />
        </div>

        <div style={{ paddingBottom: 7, fontSize: 14, color: 'var(--text-muted)' }}>—</div>

        <div>
          <label style={labelS}>ถึงวันที่</label>
          <input
            type="date"
            value={localTo}
            min={localFrom}
            onChange={e => changeTo(e.target.value)}
            style={inputS}
          />
        </div>
      </div>

      {/* ── Time filter + export ────────────────────────────────── */}
      <div style={{
        background: 'var(--bg-raised)', border: '1px solid var(--line)',
        borderRadius: 10, padding: '12px 16px',
        display: 'flex', flexDirection: 'column', gap: 10, width: '100%',
      }}>

        <div style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '.07em', textTransform: 'uppercase' }}>
          กรองเวลา
        </div>

        {/* Check-in row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <label style={{
            display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer',
            fontSize: 13, color: 'var(--text-secondary)', fontWeight: 500,
            minWidth: 80,
          }}>
            <input
              type="checkbox"
              checked={enableIn}
              onChange={e => setEnableIn(e.target.checked)}
              style={{ width: 15, height: 15, cursor: 'pointer', accentColor: 'var(--accent)' }}
            />
            ช่วงเข้า
          </label>
          <input type="time" value={timeInFrom} onChange={e => setTimeInFrom(e.target.value)}
            style={enableIn ? timeInputS : { ...timeInputS, opacity: .35, pointerEvents: 'none' }}
            tabIndex={enableIn ? 0 : -1} />
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>—</span>
          <input type="time" value={timeInTo} onChange={e => setTimeInTo(e.target.value)}
            style={enableIn ? timeInputS : { ...timeInputS, opacity: .35, pointerEvents: 'none' }}
            tabIndex={enableIn ? 0 : -1} />
        </div>

        {/* Check-out row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <label style={{
            display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer',
            fontSize: 13, color: 'var(--text-secondary)', fontWeight: 500,
            minWidth: 80,
          }}>
            <input
              type="checkbox"
              checked={enableOut}
              onChange={e => setEnableOut(e.target.checked)}
              style={{ width: 15, height: 15, cursor: 'pointer', accentColor: 'var(--accent)' }}
            />
            ช่วงออก
          </label>
          <input type="time" value={timeOutFrom} onChange={e => setTimeOutFrom(e.target.value)}
            style={enableOut ? timeInputS : { ...timeInputS, opacity: .35, pointerEvents: 'none' }}
            tabIndex={enableOut ? 0 : -1} />
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>—</span>
          <input type="time" value={timeOutTo} onChange={e => setTimeOutTo(e.target.value)}
            style={enableOut ? timeInputS : { ...timeInputS, opacity: .35, pointerEvents: 'none' }}
            tabIndex={enableOut ? 0 : -1} />
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: 'var(--line)', margin: '2px 0' }} />

        {/* Export buttons */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            onClick={() => doExport('csv')}
            disabled={!canExport}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '8px 20px', borderRadius: 7, fontSize: 13, fontWeight: 600,
              background: canExport ? 'var(--accent)' : 'var(--bg-active)',
              color: canExport ? '#fff' : 'var(--text-muted)',
              border: `1px solid ${canExport ? 'var(--accent)' : 'var(--line-mid)'}`,
              cursor: canExport ? 'pointer' : 'default',
              fontFamily: "'Sarabun', sans-serif",
              boxShadow: canExport ? '0 2px 6px rgba(61,90,241,.2)' : 'none',
              transition: 'all .15s',
            }}
          >
            <DownloadIcon />
            Export CSV
          </button>

          <button
            onClick={() => doExport('txt')}
            disabled={!canExport}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '8px 20px', borderRadius: 7, fontSize: 13, fontWeight: 600,
              background: canExport ? 'var(--ok)' : 'var(--bg-active)',
              color: canExport ? 'var(--ok-text)' : 'var(--text-muted)',
              border: `1px solid ${canExport ? 'var(--ok)' : 'var(--line-mid)'}`,
              cursor: canExport ? 'pointer' : 'default',
              fontFamily: "'Sarabun', sans-serif",
              boxShadow: canExport ? '0 2px 6px rgba(0,0,0,.08)' : 'none',
              transition: 'all .15s',
            }}
          >
            <DownloadIcon />
            Export TXT
          </button>
        </div>

        <div style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>
          หากไม่เปิดกรองเวลา จะ export ข้อมูลทั้งหมดในช่วงวันที่ที่เลือก
        </div>
      </div>

    </div>
  )
}

function DownloadIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M6.5 1v8M3.5 6l3 3 3-3M1 10v1.5A1.5 1.5 0 002.5 13h8a1.5 1.5 0 001.5-1.5V10"/>
    </svg>
  )
}
