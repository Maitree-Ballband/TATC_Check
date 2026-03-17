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

  function apply() {
    if (!localFrom || !localTo || localFrom > localTo) return
    router.push(`/report?from=${localFrom}&to=${localTo}`)
  }

  const exportUrl = `/api/admin/export?from=${from}&to=${to}`

  const inputS: React.CSSProperties = {
    padding: '7px 10px', borderRadius: 7, fontSize: 13,
    background: 'var(--bg-raised)', border: '1px solid var(--line-mid)',
    color: 'var(--text-primary)', fontFamily: "'Sarabun', sans-serif",
    cursor: 'pointer',
  }

  const labelS: React.CSSProperties = {
    display: 'block', fontSize: 10.5, fontWeight: 600,
    color: 'var(--text-muted)', letterSpacing: '.07em',
    textTransform: 'uppercase', marginBottom: 4,
  }

  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, flexWrap: 'wrap' }}>

      {/* From */}
      <div>
        <label style={labelS}>ตั้งแต่วันที่</label>
        <input
          type="date"
          value={localFrom}
          onChange={e => setLocalFrom(e.target.value)}
          style={inputS}
        />
      </div>

      {/* Separator */}
      <div style={{ paddingBottom: 8, fontSize: 13, color: 'var(--text-muted)' }}>—</div>

      {/* To */}
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

      {/* Apply */}
      <button
        onClick={apply}
        disabled={!localFrom || !localTo || localFrom > localTo}
        style={{
          padding: '7px 16px', borderRadius: 7, fontSize: 13, fontWeight: 600,
          background: 'var(--bg-raised)', color: 'var(--text-secondary)',
          border: '1px solid var(--line-mid)', cursor: 'pointer',
          fontFamily: "'Sarabun', sans-serif",
          opacity: (!localFrom || !localTo || localFrom > localTo) ? .45 : 1,
        }}
      >
        ดูรายงาน
      </button>

      {/* Divider */}
      <div style={{ width: 1, height: 30, background: 'var(--line-mid)', alignSelf: 'center' }} />

      {/* Export Excel */}
      <a href={exportUrl} download style={{ textDecoration: 'none' }}>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 7,
          padding: '7px 16px', borderRadius: 7, fontSize: 13, fontWeight: 600,
          background: 'var(--accent)', color: '#fff', border: '1px solid var(--accent)',
          cursor: 'pointer', fontFamily: "'Sarabun', sans-serif",
          boxShadow: '0 2px 6px rgba(61,90,241,.2)',
        }}>
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M6.5 1v8M3.5 6l3 3 3-3M1 10v1.5A1.5 1.5 0 002.5 13h8a1.5 1.5 0 001.5-1.5V10"/>
          </svg>
          Export Excel
        </span>
      </a>

    </div>
  )
}
