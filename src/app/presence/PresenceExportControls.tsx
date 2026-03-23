'use client'
import type { CSSProperties } from 'react'
import { useState } from 'react'

export function PresenceExportControls() {
  const today = new Date().toISOString().slice(0, 10)

  const [localFrom, setLocalFrom] = useState(today)
  const [localTo,   setLocalTo]   = useState(today)

  const [enableIn,  setEnableIn]  = useState(false)
  const [enableOut, setEnableOut] = useState(false)

  function doExport(fmt: 'csv' | 'txt') {
    const p = new URLSearchParams({ from: localFrom, to: localTo, format: fmt })
    if (enableIn)  { p.set('timeInFrom', '00:00');  p.set('timeInTo', '23:59') }
    if (enableOut) { p.set('timeOutFrom', '00:00'); p.set('timeOutTo', '23:59') }
    window.location.href = `/api/admin/export-raw?${p.toString()}`
  }

  const canExport = !!(localFrom && localTo && localFrom <= localTo)

  const inputS: CSSProperties = {
    padding: '7px 10px', borderRadius: 7, fontSize: 13,
    background: 'var(--bg-raised)', border: '1px solid var(--line-mid)',
    color: 'var(--text-primary)', fontFamily: "'Sarabun', sans-serif",
    cursor: 'pointer',
  }

  const labelS: CSSProperties = {
    fontSize: 10.5, fontWeight: 600, color: 'var(--text-muted)',
    letterSpacing: '.07em', textTransform: 'uppercase' as const,
    marginBottom: 4, display: 'block',
  }

  return (
    <div style={{
      background: 'var(--bg-surface)', border: '1px solid var(--line)',
      borderRadius: 12, padding: '14px 16px', marginBottom: 14,
      boxShadow: '0 1px 4px rgba(30,36,51,.05)',
    }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '.07em', textTransform: 'uppercase', marginBottom: 10 }}>
        Export CSV / TXT
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>

        {/* Date range */}
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
          <div style={{ paddingBottom: 7, fontSize: 14, color: 'var(--text-muted)' }}>—</div>
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
        </div>

        {/* Divider */}
        <div style={{ width: 1, alignSelf: 'stretch', background: 'var(--line)', margin: '0 2px' }} />

        {/* Column toggles */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '.07em', textTransform: 'uppercase' }}>
            คอลัมน์เวลา
          </div>
          <div style={{ display: 'flex', gap: 14 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500 }}>
              <input type="checkbox" checked={enableIn} onChange={e => setEnableIn(e.target.checked)}
                style={{ width: 14, height: 14, cursor: 'pointer', accentColor: 'var(--accent)' }} />
              เวลาเข้า
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500 }}>
              <input type="checkbox" checked={enableOut} onChange={e => setEnableOut(e.target.checked)}
                style={{ width: 14, height: 14, cursor: 'pointer', accentColor: 'var(--accent)' }} />
              เวลาออก
            </label>
          </div>
        </div>

        {/* Divider */}
        <div style={{ width: 1, alignSelf: 'stretch', background: 'var(--line)', margin: '0 2px' }} />

        {/* Export buttons */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={() => doExport('csv')}
            disabled={!canExport}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '8px 18px', borderRadius: 7, fontSize: 13, fontWeight: 600,
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
            CSV
          </button>
          <button
            onClick={() => doExport('txt')}
            disabled={!canExport}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '8px 18px', borderRadius: 7, fontSize: 13, fontWeight: 600,
              background: canExport ? 'var(--ok-dim)' : 'var(--bg-active)',
              color: canExport ? 'var(--ok-text)' : 'var(--text-muted)',
              border: `1px solid ${canExport ? 'rgba(22,163,74,.3)' : 'var(--line-mid)'}`,
              cursor: canExport ? 'pointer' : 'default',
              fontFamily: "'Sarabun', sans-serif",
              transition: 'all .15s',
            }}
          >
            <DownloadIcon />
            TXT
          </button>
        </div>

      </div>

      <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 8 }}>
        {!enableIn && !enableOut
          ? 'ไม่ได้เลือกคอลัมน์เวลา — จะ export ทั้งเวลาเข้าและเวลาออก'
          : `จะ export เฉพาะ${[enableIn ? 'เวลาเข้า' : null, enableOut ? 'เวลาออก' : null].filter(Boolean).join(' และ ')}`}
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
