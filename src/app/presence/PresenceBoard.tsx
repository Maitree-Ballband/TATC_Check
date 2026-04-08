'use client'
import { useState } from 'react'

export type BoardRow = {
  userId:          string
  name:            string
  dept:            string | null
  effectiveStatus: string
  locMode:         'campus' | 'wfh' | null
  locOutMode:      'campus' | 'wfh' | null
  checkIn:         string | null
  checkOut:        string | null
  lateReason:      string | null
  initials:        string
  avatarUrl:       string | null
}

interface Props {
  rows:             BoardRow[]
  hardCutoffPassed: boolean
  counts:           { present: number; late: number; wfh: number; wfh_late: number; absent: number; not_checked: number; not_registered: number }
  total:            number
  notPresentCount:  number
  date:             string
}

type FilterKey = 'present' | 'late' | 'wfh' | 'wfh_late' | 'absent' | 'not_registered' | null
type LocFilter  = 'campus' | 'wfh' | null
type SortMode   = 'name' | 'checkin_asc' | 'checkin_desc'

// ── Status display config ─────────────────────────────────────
const STATUS_COLOR: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  present:        { bg: 'var(--ok-dim)',      text: 'var(--ok-text)',        border: 'rgba(22,163,74,.2)',  dot: 'var(--ok)'       },
  wfh:            { bg: 'var(--blue-dim)',    text: 'var(--blue-text)',      border: 'rgba(37,99,235,.2)',  dot: 'var(--blue)'     },
  late:           { bg: 'var(--warn-dim)',    text: 'var(--warn-text)',      border: 'rgba(217,119,6,.2)',  dot: 'var(--warn)'     },
  wfh_late:       { bg: 'var(--warn-dim)',    text: 'var(--warn-text)',      border: 'rgba(217,119,6,.2)',  dot: 'var(--warn)'     },
  absent:         { bg: 'var(--danger-dim)',  text: 'var(--danger-text)',    border: 'rgba(220,38,38,.2)',  dot: 'var(--danger)'   },
  not_checked:    { bg: 'var(--neutral-dim)', text: 'var(--text-secondary)', border: 'var(--line)',         dot: 'var(--line-mid)' },
  not_registered: { bg: 'var(--bg-active)',   text: 'var(--text-muted)',     border: 'var(--line-mid)',     dot: 'var(--line-mid)' },
}
const STATUS_LABEL: Record<string, string> = {
  present: 'วิทยาลัย', wfh: 'WFH', late: 'สาย', wfh_late: 'สาย',
  absent: 'ขาด', not_checked: 'ยังไม่มา', not_registered: 'ยังไม่ลงทะเบียน',
}

// ── Icons ─────────────────────────────────────────────────────
function ExcelIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="8" y1="13" x2="16" y2="13"/>
      <line x1="8" y1="17" x2="16" y2="17"/>
      <line x1="10" y1="9" x2="8" y2="9"/>
    </svg>
  )
}

// ── Location pill ─────────────────────────────────────────────
function LocPill({ mode }: { mode: 'campus' | 'wfh' | null }) {
  if (!mode) return <span style={{ color: 'var(--text-dim)', fontSize: 13 }}>—</span>
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap',
      background: mode === 'wfh' ? 'var(--blue-dim)' : 'var(--ok-dim)',
      color:      mode === 'wfh' ? 'var(--blue-text)' : 'var(--ok-text)',
      border:     `1px solid ${mode === 'wfh' ? 'rgba(37,99,235,.2)' : 'rgba(22,163,74,.2)'}`,
    }}>
      {mode === 'wfh' ? 'WFH' : 'วิทยาลัย'}
    </span>
  )
}

// ── Location segment control ───────────────────────────────────
function LocSegment({
  value, onChange, campusCount, wfhCount, activeColor,
}: {
  value: LocFilter
  onChange: (v: LocFilter) => void
  campusCount: number
  wfhCount: number
  activeColor: string
}) {
  const opts: { key: LocFilter; label: string; count?: number }[] = [
    { key: null,     label: 'ทั้งหมด' },
    { key: 'campus', label: 'วิทยาลัย', count: campusCount },
    { key: 'wfh',    label: 'WFH',       count: wfhCount    },
  ]
  return (
    <div style={{ display: 'inline-flex', borderRadius: 7, border: '1px solid var(--line-mid)', overflow: 'hidden', flexShrink: 0 }}>
      {opts.map((opt, i) => {
        const isActive = value === opt.key
        return (
          <button
            key={String(opt.key)}
            onClick={() => onChange(value === opt.key ? null : opt.key)}
            style={{
              padding: '5px 11px', fontSize: 12.5, fontWeight: isActive ? 700 : 500,
              background: isActive ? activeColor : 'var(--bg-surface)',
              color: isActive ? '#fff' : 'var(--text-secondary)',
              border: 'none',
              borderLeft: i > 0 ? '1px solid var(--line-mid)' : 'none',
              cursor: 'pointer', transition: 'background .12s, color .12s',
              whiteSpace: 'nowrap', fontFamily: "'Sarabun', sans-serif",
              display: 'inline-flex', alignItems: 'center', gap: 5,
            }}
          >
            {opt.label}
            {opt.count !== undefined && (
              <span style={{
                fontSize: 10.5, fontWeight: 700, lineHeight: 1,
                padding: '1px 5px', borderRadius: 99,
                background: isActive ? 'rgba(255,255,255,.22)' : 'var(--bg-active)',
                color: isActive ? '#fff' : 'var(--text-muted)',
              }}>
                {opt.count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

// ── Active filter chip ─────────────────────────────────────────
function FilterChip({ label, onRemove, bg, color, border }: {
  label: string; onRemove: () => void
  bg: string; color: string; border: string
}) {
  return (
    <span
      onClick={onRemove}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        padding: '3px 9px 3px 10px', borderRadius: 99, fontSize: 12, fontWeight: 600,
        cursor: 'pointer', userSelect: 'none',
        background: bg, color, border: `1px solid ${border}`,
        transition: 'opacity .12s',
      }}
    >
      {label}
      <span style={{ fontSize: 10, opacity: 0.65, fontWeight: 800, marginLeft: 1 }}>✕</span>
    </span>
  )
}

export function PresenceBoard({ rows, hardCutoffPassed, counts, total, notPresentCount, date }: Props) {
  const [filter,       setFilter]       = useState<FilterKey>(null)
  const [search,       setSearch]       = useState('')
  const [locInFilter,  setLocInFilter]  = useState<LocFilter>(null)
  const [locOutFilter, setLocOutFilter] = useState<LocFilter>(null)
  const [sortMode,     setSortMode]     = useState<SortMode>('name')

  function toggleFilter(key: FilterKey) {
    setFilter(f => f === key ? null : key)
  }

  const matchesFilter = (es: string): boolean => {
    if (filter === null)             return true
    if (filter === 'present')        return es === 'present'
    if (filter === 'late')           return es === 'late'
    if (filter === 'wfh')            return es === 'wfh'
    if (filter === 'wfh_late')       return es === 'wfh_late'
    if (filter === 'absent')         return es === 'absent' || es === 'not_checked'
    if (filter === 'not_registered') return es === 'not_registered'
    return true
  }

  const statusFilteredRows = rows.filter(r => matchesFilter(r.effectiveStatus))
  const locInCampus  = statusFilteredRows.filter(r => r.checkIn  && r.locMode    === 'campus').length
  const locInWfh     = statusFilteredRows.filter(r => r.checkIn  && r.locMode    === 'wfh').length
  const locOutCampus = statusFilteredRows.filter(r => r.checkOut && r.locOutMode === 'campus').length
  const locOutWfh    = statusFilteredRows.filter(r => r.checkOut && r.locOutMode === 'wfh').length

  const q = search.trim().toLowerCase()
  const visibleRows = rows.filter(r => {
    if (!matchesFilter(r.effectiveStatus)) return false
    if (q && !r.name.toLowerCase().includes(q) && !(r.dept ?? '').toLowerCase().includes(q)) return false
    if (locInFilter  !== null && (r.checkIn  ? r.locMode    : null) !== locInFilter)  return false
    if (locOutFilter !== null && (r.checkOut ? r.locOutMode : null) !== locOutFilter) return false
    return true
  })

  const anyFilter = filter !== null || locInFilter !== null || locOutFilter !== null || q.length > 0

  const clearAll = () => { setFilter(null); setLocInFilter(null); setLocOutFilter(null); setSearch('') }

  const sortedRows = sortMode === 'name' ? visibleRows : [...visibleRows].sort((a, b) => {
    const ta = a.checkIn ?? ''
    const tb = b.checkIn ?? ''
    if (!ta && !tb) return 0
    if (!ta) return 1
    if (!tb) return -1
    return sortMode === 'checkin_asc' ? ta.localeCompare(tb) : tb.localeCompare(ta)
  })

  const STATUS_FILTER_LABEL: Record<string, string> = {
    present:        'วิทยาลัย ตรงเวลา',
    late:           'วิทยาลัย สาย',
    wfh:            'WFH ตรงเวลา',
    wfh_late:       'WFH สาย',
    absent:         hardCutoffPassed ? 'ขาด' : 'ยังไม่มา',
    not_registered: 'ยังไม่ลงทะเบียน',
  }

  // ── Summary pills ──────────────────────────────────────────
  const pills = [
    { key: 'present'        as FilterKey, label: 'วิทยาลัย',         sub: 'ตรงเวลา', n: counts.present,        color: 'var(--ok-text)',    bg: 'var(--ok-dim)',      activeBorder: 'rgba(22,163,74,.4)'   },
    { key: 'late'           as FilterKey, label: 'วิทยาลัย',         sub: 'สาย',     n: counts.late,           color: 'var(--warn-text)',  bg: 'var(--warn-dim)',    activeBorder: 'rgba(217,119,6,.4)'   },
    { key: 'wfh'            as FilterKey, label: 'WFH',               sub: 'ตรงเวลา', n: counts.wfh,            color: 'var(--blue-text)',  bg: 'var(--blue-dim)',    activeBorder: 'rgba(37,99,235,.4)'   },
    { key: 'wfh_late'       as FilterKey, label: 'WFH',               sub: 'สาย',     n: counts.wfh_late,       color: 'var(--warn-text)',  bg: 'var(--warn-dim)',    activeBorder: 'rgba(217,119,6,.4)'   },
    {
      key:   'absent' as FilterKey,
      label: hardCutoffPassed ? 'ขาด' : 'ยังไม่มา',
      sub:   '',
      n:     notPresentCount,
      color: hardCutoffPassed ? 'var(--danger-text)' : 'var(--text-muted)',
      bg:    hardCutoffPassed ? 'var(--danger-dim)'  : 'var(--neutral-dim)',
      activeBorder: hardCutoffPassed ? 'rgba(220,38,38,.4)' : 'rgba(107,114,128,.4)',
    },
    { key: 'not_registered' as FilterKey, label: 'ยังไม่ลงทะเบียน', sub: '', n: counts.not_registered, color: 'var(--text-muted)', bg: 'var(--bg-active)', activeBorder: 'rgba(107,114,128,.4)' },
  ]

  return (
    <div>

      {/* ── Zone 1: Summary stats (clickable → status filter) ── */}
      <div style={{
        background: 'var(--bg-surface)', border: '1px solid var(--line)',
        borderRadius: 12, padding: '14px 16px', marginBottom: 10,
        boxShadow: '0 1px 4px rgba(30,36,51,.05)',
      }}>
        <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '.09em', textTransform: 'uppercase', marginBottom: 10 }}>
          คลิกที่ตัวเลขเพื่อกรองสถานะ
        </div>
        <div className="presence-stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 1 }}>
          {pills.map((p, idx) => {
            const isActive = filter === p.key
            return (
              <div
                key={String(p.key)}
                onClick={() => toggleFilter(p.key)}
                style={{
                  textAlign: 'center', padding: '10px 8px', cursor: 'pointer',
                  borderRight: idx < 5 ? '1px solid var(--line)' : 'none',
                  borderRadius: idx === 0 ? '8px 0 0 8px' : idx === 5 ? '0 8px 8px 0' : 'none',
                  background: isActive ? p.bg : 'transparent',
                  outline: isActive ? `2px solid ${p.activeBorder}` : 'none',
                  outlineOffset: -1, transition: 'background .15s', userSelect: 'none',
                }}
              >
                <div style={{ fontSize: 26, fontWeight: 700, color: p.color, lineHeight: 1 }}>{p.n}</div>
                <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginTop: 4, fontWeight: 600 }}>{p.label}</div>
                {p.sub && <div style={{ fontSize: 10.5, color: isActive ? p.color : 'var(--text-muted)', marginTop: 2 }}>{p.sub}</div>}
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Zone 2: Unified Filter Toolbar ─────────────────────── */}
      <div style={{
        background: 'var(--bg-surface)', border: '1px solid var(--line)',
        borderRadius: 10, marginBottom: 12,
        boxShadow: '0 1px 3px rgba(0,0,0,.04)',
      }}>

        {/* ── Toolbar row ── */}
        <div className="presence-filter-toolbar" style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '10px 12px', flexWrap: 'wrap',
          borderBottom: anyFilter ? '1px solid var(--line)' : 'none',
        }}>

          {/* Search input */}
          <div style={{ position: 'relative', flex: '1 1 180px', maxWidth: 260 }}>
            <svg style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)', pointerEvents: 'none' }}
              width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8">
              <circle cx="7" cy="7" r="5"/><path d="M12 12l2 2"/>
            </svg>
            <input
              type="text"
              placeholder="ค้นหาชื่อ หรือ แผนก…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                width: '100%', padding: '7px 28px 7px 30px', borderRadius: 7, fontSize: 13,
                background: 'var(--bg-raised)',
                border: `1.5px solid ${search ? 'var(--accent)' : 'var(--line)'}`,
                color: 'var(--text-primary)', fontFamily: "'Sarabun', sans-serif",
                outline: 'none', boxSizing: 'border-box',
                boxShadow: search ? '0 0 0 3px rgba(61,90,241,.1)' : 'none',
                transition: 'border-color .15s, box-shadow .15s',
              }}
            />
            {search && (
              <button onClick={() => setSearch('')} style={{
                position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                fontSize: 11, color: 'var(--text-muted)', background: 'var(--bg-active)',
                border: '1px solid var(--line)', borderRadius: 4,
                cursor: 'pointer', padding: '1px 5px', lineHeight: 1.5,
              }}>✕</button>
            )}
          </div>

          <div style={{ width: 1, height: 26, background: 'var(--line)', flexShrink: 0 }} />

          {/* Location in segment */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '.07em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
              สถานที่เข้า
            </span>
            <LocSegment
              value={locInFilter}
              onChange={v => setLocInFilter(v)}
              campusCount={locInCampus}
              wfhCount={locInWfh}
              activeColor="var(--ok)"
            />
          </div>

          <div style={{ width: 1, height: 26, background: 'var(--line)', flexShrink: 0 }} />

          {/* Location out segment */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '.07em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
              สถานที่ออก
            </span>
            <LocSegment
              value={locOutFilter}
              onChange={v => setLocOutFilter(v)}
              campusCount={locOutCampus}
              wfhCount={locOutWfh}
              activeColor="var(--blue)"
            />
          </div>

          {/* Sort toggle */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '.07em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
              เรียง
            </span>
            <div style={{ display: 'inline-flex', borderRadius: 7, border: '1px solid var(--line-mid)', overflow: 'hidden', flexShrink: 0 }}>
              {([
                { key: 'name'         as SortMode, label: 'ชื่อ' },
                { key: 'checkin_asc'  as SortMode, label: 'เข้า ↑' },
                { key: 'checkin_desc' as SortMode, label: 'เข้า ↓' },
              ]).map((opt, i) => {
                const isActive = sortMode === opt.key
                return (
                  <button key={opt.key} onClick={() => setSortMode(opt.key)} style={{
                    padding: '5px 10px', fontSize: 12, fontWeight: isActive ? 700 : 500,
                    background: isActive ? 'var(--accent)' : 'var(--bg-surface)',
                    color: isActive ? '#fff' : 'var(--text-secondary)',
                    border: 'none', borderLeft: i > 0 ? '1px solid var(--line-mid)' : 'none',
                    cursor: 'pointer', transition: 'background .12s, color .12s',
                    whiteSpace: 'nowrap', fontFamily: "'Sarabun', sans-serif",
                  }}>
                    {opt.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Right: result count + export */}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 10, alignItems: 'center', flexShrink: 0 }}>
            <span style={{ fontSize: 12.5, color: 'var(--text-muted)', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
              <span style={{ fontWeight: 700, color: anyFilter ? 'var(--accent)' : 'var(--text-secondary)' }}>{visibleRows.length}</span>
              <span style={{ margin: '0 3px', opacity: 0.4 }}>/</span>
              {total} คน
            </span>
            <button
              onClick={() => { window.location.href = `/api/admin/export-presence?date=${date}` }}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                padding: '6px 14px', borderRadius: 7, fontSize: 13, fontWeight: 600,
                background: 'var(--ok)', color: '#fff',
                border: '1px solid var(--ok)',
                cursor: 'pointer', fontFamily: "'Sarabun', sans-serif",
                boxShadow: '0 1px 4px rgba(22,163,74,.2)', transition: 'all .15s', whiteSpace: 'nowrap',
              }}
            >
              <ExcelIcon />
              Export
            </button>
          </div>
        </div>

        {/* ── Active filter chips (only when filtering) ── */}
        {anyFilter && (
          <div style={{
            padding: '8px 12px', display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center',
            background: 'var(--bg-raised)',
          }}>
            <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '.07em', textTransform: 'uppercase', marginRight: 2 }}>
              กรอง
            </span>

            {filter && (
              <FilterChip
                label={`สถานะ: ${STATUS_FILTER_LABEL[filter]}`}
                onRemove={() => setFilter(null)}
                bg="rgba(61,90,241,.08)" color="var(--accent)" border="rgba(61,90,241,.2)"
              />
            )}
            {locInFilter && (
              <FilterChip
                label={`เข้า: ${locInFilter === 'campus' ? 'วิทยาลัย' : 'WFH'}`}
                onRemove={() => setLocInFilter(null)}
                bg="var(--ok-dim)" color="var(--ok-text)" border="rgba(22,163,74,.25)"
              />
            )}
            {locOutFilter && (
              <FilterChip
                label={`ออก: ${locOutFilter === 'campus' ? 'วิทยาลัย' : 'WFH'}`}
                onRemove={() => setLocOutFilter(null)}
                bg="var(--blue-dim)" color="var(--blue-text)" border="rgba(37,99,235,.25)"
              />
            )}
            {q && (
              <FilterChip
                label={`"${search.length > 18 ? search.slice(0, 18) + '…' : search}"`}
                onRemove={() => setSearch('')}
                bg="var(--bg-active)" color="var(--text-secondary)" border="var(--line-mid)"
              />
            )}

            <button
              onClick={clearAll}
              style={{
                marginLeft: 4, fontSize: 12, color: 'var(--text-muted)', background: 'transparent',
                border: 'none', cursor: 'pointer', padding: '2px 4px',
                fontFamily: "'Sarabun', sans-serif",
                textDecoration: 'underline', textDecorationStyle: 'dotted',
              }}
            >
              ล้างทั้งหมด
            </button>
          </div>
        )}
      </div>

      {/* ── Desktop table ──────────────────────────────────────── */}
      <div className="presence-board-desktop" style={{
        background: 'var(--bg-surface)', border: '1px solid var(--line)',
        borderRadius: 12, overflow: 'hidden',
        boxShadow: '0 1px 4px rgba(30,36,51,.04)',
      }}>
      <div className="presence-table-wrap">
        {/* Table header */}
        <div className="presence-table-row" style={{
          display: 'grid',
          gridTemplateColumns: '28px minmax(0,1fr) 64px 90px 64px 90px 88px',
          gap: '0 10px',
          padding: '8px 14px',
          background: 'var(--bg-raised)',
          borderBottom: '1px solid var(--line)',
        }}>
          {([
            { h: '#',             center: true  },
            { h: 'ชื่อ-สกุล / แผนก', center: false },
            { h: 'เข้างาน',       center: true  },
            { h: 'สถานที่เข้า',   center: true  },
            { h: 'ออกงาน',        center: true  },
            { h: 'สถานที่ออก',    center: true  },
            { h: 'สถานะ',         center: true  },
          ]).map(({ h, center }) => (
            <div key={h} style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '.07em', textTransform: 'uppercase', textAlign: center ? 'center' : 'left' }}>
              {h}
            </div>
          ))}
        </div>

        {/* Rows */}
        {sortedRows.length === 0 && (
          <div style={{ padding: '40px 32px', textAlign: 'center' }}>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 6 }}>ไม่มีข้อมูลตรงกับเงื่อนไขที่เลือก</div>
            {anyFilter && (
              <button onClick={clearAll} style={{
                fontSize: 12, color: 'var(--accent)', background: 'transparent',
                border: 'none', cursor: 'pointer', fontFamily: "'Sarabun', sans-serif",
                textDecoration: 'underline',
              }}>ล้างตัวกรองทั้งหมด</button>
            )}
          </div>
        )}

        {sortedRows.map((row, idx) => {
          const sc = STATUS_COLOR[row.effectiveStatus] ?? STATUS_COLOR.not_checked
          const locInMode  = row.checkIn  ? row.locMode    : null
          const locOutMode = row.checkOut ? row.locOutMode : null
          return (
            <div
              key={row.userId}
              className="presence-table-row"
              style={{
                display: 'grid',
                gridTemplateColumns: '28px minmax(0,1fr) 64px 90px 64px 90px 88px',
                gap: '0 10px',
                padding: '9px 14px',
                borderBottom: idx < sortedRows.length - 1 ? '1px solid var(--line)' : 'none',
                alignItems: 'center',
                borderLeft: `3px solid ${sc.dot}`,
              }}
            >
              {/* # */}
              <div style={{ fontSize: 11.5, color: 'var(--text-dim)', fontWeight: 500, textAlign: 'center' }}>
                {idx + 1}
              </div>

              {/* Name + dept */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
                {row.avatarUrl
                  ? <img src={row.avatarUrl} alt="" style={{ width: 30, height: 30, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: `1.5px solid ${sc.border}` }} />
                  : <div style={{
                      width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
                      background: sc.bg, border: `1.5px solid ${sc.border}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 10.5, fontWeight: 700, color: sc.text,
                    }}>
                      {row.initials}
                    </div>
                }
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {row.name}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>
                    {row.dept ?? '—'}
                  </div>
                  {row.lateReason && (
                    <div style={{ fontSize: 11, color: 'var(--warn-text)', fontStyle: 'italic', marginTop: 2 }}>
                      เหตุสาย: {row.lateReason}
                    </div>
                  )}
                </div>
              </div>

              {/* Check-in time */}
              <div style={{ fontSize: 13, fontWeight: 600, color: row.checkIn ? 'var(--text-primary)' : 'var(--text-dim)', fontVariantNumeric: 'tabular-nums', textAlign: 'center' }}>
                {row.checkIn ?? '—'}
              </div>

              {/* Location in */}
              <div style={{ textAlign: 'center' }}><LocPill mode={locInMode} /></div>

              {/* Check-out time */}
              <div style={{ fontSize: 13, fontWeight: 600, color: row.checkOut ? 'var(--text-primary)' : 'var(--text-dim)', fontVariantNumeric: 'tabular-nums', textAlign: 'center' }}>
                {row.checkOut ?? '—'}
              </div>

              {/* Location out */}
              <div style={{ textAlign: 'center' }}><LocPill mode={locOutMode} /></div>

              {/* Status chip */}
              <div style={{ textAlign: 'center' }}>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  padding: '3px 9px', borderRadius: 99,
                  fontSize: 11.5, fontWeight: 700,
                  background: sc.bg, color: sc.text,
                  border: `1px solid ${sc.border}`,
                  whiteSpace: 'nowrap',
                }}>
                  <span style={{ width: 5, height: 5, borderRadius: '50%', background: sc.dot, flexShrink: 0 }} />
                  {STATUS_LABEL[row.effectiveStatus] ?? row.effectiveStatus}
                </span>
              </div>
            </div>
          )
        })}
      </div>{/* /presence-table-wrap */}
      </div>{/* /table outer */}

      {/* ── Mobile card list ────────────────────────────────────── */}
      <div className="presence-board-mobile" style={{
        background: 'var(--bg-surface)', border: '1px solid var(--line)',
        borderRadius: 12, overflow: 'hidden',
        boxShadow: '0 1px 4px rgba(30,36,51,.04)',
      }}>
        {sortedRows.length === 0 && (
          <div style={{ padding: '40px 32px', textAlign: 'center' }}>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 6 }}>ไม่มีข้อมูลตรงกับเงื่อนไขที่เลือก</div>
            {anyFilter && (
              <button onClick={clearAll} style={{
                fontSize: 12, color: 'var(--accent)', background: 'transparent',
                border: 'none', cursor: 'pointer', fontFamily: "'Sarabun', sans-serif",
                textDecoration: 'underline',
              }}>ล้างตัวกรองทั้งหมด</button>
            )}
          </div>
        )}
        {sortedRows.map((row, idx) => {
          const sc = STATUS_COLOR[row.effectiveStatus] ?? STATUS_COLOR.not_checked
          return (
            <div key={row.userId} style={{
              padding: '12px 14px',
              borderBottom: idx < sortedRows.length - 1 ? '1px solid var(--line)' : 'none',
              borderLeft: `3px solid ${sc.dot}`,
              display: 'flex', alignItems: 'center', gap: 10,
            }}>
              {/* Avatar */}
              {row.avatarUrl
                ? <img src={row.avatarUrl} alt="" style={{ width: 34, height: 34, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: `1.5px solid ${sc.border}` }} />
                : <div style={{
                    width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
                    background: sc.bg, border: `1.5px solid ${sc.border}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, fontWeight: 700, color: sc.text,
                  }}>
                    {row.initials}
                  </div>
              }
              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>
                  {row.name}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: row.lateReason ? 2 : 4 }}>
                  {row.dept ?? '—'}
                </div>
                {row.lateReason && (
                  <div style={{ fontSize: 11, color: 'var(--warn-text)', fontStyle: 'italic', marginBottom: 4 }}>
                    เหตุสาย: {row.lateReason}
                  </div>
                )}
                {row.effectiveStatus !== 'not_registered' && (
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>เข้า</span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: row.checkIn ? 'var(--text-primary)' : 'var(--text-dim)', fontVariantNumeric: 'tabular-nums' }}>
                        {row.checkIn ?? '—'}
                      </span>
                      {row.checkIn && <LocPill mode={row.locMode} />}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>ออก</span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: row.checkOut ? 'var(--text-primary)' : 'var(--text-dim)', fontVariantNumeric: 'tabular-nums' }}>
                        {row.checkOut ?? '—'}
                      </span>
                      {row.checkOut && <LocPill mode={row.locOutMode} />}
                    </div>
                  </div>
                )}
              </div>
              {/* Status chip */}
              <div style={{ flexShrink: 0 }}>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  padding: '3px 8px', borderRadius: 99,
                  fontSize: 11, fontWeight: 700,
                  background: sc.bg, color: sc.text,
                  border: `1px solid ${sc.border}`,
                  whiteSpace: 'nowrap',
                }}>
                  <span style={{ width: 5, height: 5, borderRadius: '50%', background: sc.dot, flexShrink: 0 }} />
                  {STATUS_LABEL[row.effectiveStatus] ?? row.effectiveStatus}
                </span>
              </div>
            </div>
          )
        })}
      </div>

    </div>
  )
}
