'use client'
import { useState } from 'react'

export type BoardRow = {
  userId:          string
  name:            string
  dept:            string | null
  effectiveStatus: string
  locMode:         'campus' | 'wfh' | null
  checkIn:         string | null
  checkOut:        string | null
  lateReason:      string | null
  initials:        string
  avatarUrl:       string | null
}

interface Props {
  rows:             BoardRow[]
  hardCutoffPassed: boolean
  counts:           { campus: number; wfh: number; late: number; absent: number; not_checked: number }
  total:            number
  seg:              { campus: number; wfh: number; late: number; absent: number; not_checked: number }
  notPresentCount:  number
}

type FilterKey = 'present' | 'wfh' | 'late' | 'absent' | null

type ChipVariant = 'ok' | 'warn' | 'danger' | 'blue' | 'neutral'
const CHIP_VARIANT: Record<string, ChipVariant> = {
  present: 'ok', wfh: 'blue', late: 'warn', wfh_late: 'warn',
  absent: 'danger', not_checked: 'neutral',
}
const CHIP_LABEL: Record<string, string> = {
  present: 'วิทยาลัย', wfh: 'WFH', late: 'สาย', wfh_late: 'WFH · สาย',
  absent: 'ขาด', not_checked: 'ยังไม่มา',
}
const chipColors: Record<ChipVariant, { bg: string; color: string; border: string }> = {
  ok:      { bg: 'var(--ok-dim)',      color: 'var(--ok-text)',       border: 'rgba(22,163,74,.2)'   },
  blue:    { bg: 'var(--blue-dim)',    color: 'var(--blue-text)',     border: 'rgba(37,99,235,.2)'   },
  warn:    { bg: 'var(--warn-dim)',    color: 'var(--warn-text)',     border: 'rgba(217,119,6,.2)'   },
  danger:  { bg: 'var(--danger-dim)', color: 'var(--danger-text)',   border: 'rgba(220,38,38,.2)'   },
  neutral: { bg: 'var(--neutral-dim)' as string, color: 'var(--text-secondary)', border: 'var(--line)' },
}

const GROUP_CONFIG = [
  {
    key: 'present' as FilterKey, label: 'มาปกติ', sublabel: 'เข้างานตรงเวลา',
    color: 'var(--ok)', dimColor: 'var(--ok-dim)', textColor: 'var(--ok-text)',
    borderColor: 'rgba(22,163,74,.2)',
    match: (es: string) => es === 'present',
  },
  {
    key: 'wfh' as FilterKey, label: 'Work From Home', sublabel: 'ทำงานจากที่บ้าน',
    color: 'var(--blue)', dimColor: 'var(--blue-dim)', textColor: 'var(--blue-text)',
    borderColor: 'rgba(37,99,235,.2)',
    match: (es: string) => es === 'wfh',
  },
  {
    key: 'late' as FilterKey, label: 'มาสาย',
    sublabel: `เช็คอินหลัง ${process.env.NEXT_PUBLIC_CHECKIN_CUTOFF ?? '08:00'} น.`,
    color: 'var(--warn)', dimColor: 'var(--warn-dim)', textColor: 'var(--warn-text)',
    borderColor: 'rgba(217,119,6,.2)',
    match: (es: string) => es === 'late' || es === 'wfh_late',
  },
]

export function PresenceBoard({ rows, hardCutoffPassed, counts, total, seg, notPresentCount }: Props) {
  const [filter, setFilter] = useState<FilterKey>(null)

  function toggleFilter(key: FilterKey) {
    setFilter(f => f === key ? null : key)
  }

  // Build dynamic absent group config
  const absentConfig = {
    key: 'absent' as FilterKey,
    label:       hardCutoffPassed ? 'ขาด'              : 'ยังไม่มา',
    sublabel:    hardCutoffPassed ? 'ไม่มีการลงชื่อเข้า' : 'ยังไม่ได้ลงชื่อเข้า',
    color:       hardCutoffPassed ? 'var(--danger)'     : 'var(--neutral)',
    dimColor:    hardCutoffPassed ? 'var(--danger-dim)'  : 'var(--neutral-dim)',
    textColor:   hardCutoffPassed ? 'var(--danger-text)' : 'var(--text-muted)',
    borderColor: hardCutoffPassed ? 'rgba(220,38,38,.2)' : 'rgba(107,114,128,.2)',
    match: (es: string) => es === 'absent' || es === 'not_checked',
  }

  const allGroups = [...GROUP_CONFIG, absentConfig]

  const visibleGroups = allGroups
    .map(g => ({ ...g, rows: rows.filter(r => g.match(r.effectiveStatus)) }))
    .filter(g => g.rows.length > 0 && (filter === null || filter === g.key))

  // Stat pills data
  const pills = [
    { key: 'present' as FilterKey, label: 'วิทยาลัย', n: counts.campus,
      color: 'var(--ok-text)', bg: 'var(--ok-dim)', activeBorder: 'rgba(22,163,74,.4)' },
    { key: 'wfh'     as FilterKey, label: 'WFH',       n: counts.wfh,
      color: 'var(--blue-text)', bg: 'var(--blue-dim)', activeBorder: 'rgba(37,99,235,.4)' },
    { key: 'late'    as FilterKey, label: 'สาย',        n: counts.late,
      color: 'var(--warn-text)', bg: 'var(--warn-dim)', activeBorder: 'rgba(217,119,6,.4)' },
    {
      key: 'absent' as FilterKey,
      label: hardCutoffPassed ? 'ขาด' : 'ยังไม่มา',
      n: notPresentCount,
      color: hardCutoffPassed ? 'var(--danger-text)' : 'var(--text-muted)',
      bg:    hardCutoffPassed ? 'var(--danger-dim)'  : 'var(--neutral-dim)',
      activeBorder: hardCutoffPassed ? 'rgba(220,38,38,.4)' : 'rgba(107,114,128,.4)',
    },
  ]

  return (
    <div>
      {/* ── Summary strip (clickable pills) ────────────────── */}
      <div style={{
        background: 'var(--bg-surface)', border: '1px solid var(--line)',
        borderRadius: 12, padding: '14px 16px', marginBottom: 14,
        boxShadow: '0 1px 4px rgba(30,36,51,.05)',
      }}>
        {/* 4 stat pills — clickable to filter */}
        <div className="presence-stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 1, marginBottom: 14 }}>
          {pills.map((p, idx) => {
            const isActive = filter === p.key
            return (
              <div
                key={p.key}
                onClick={() => toggleFilter(p.key)}
                style={{
                  textAlign: 'center', padding: '10px 8px', cursor: 'pointer',
                  borderRight: idx < 3 ? '1px solid var(--line)' : 'none',
                  borderRadius: idx === 0 ? '8px 0 0 8px' : idx === 3 ? '0 8px 8px 0' : 'none',
                  background: isActive ? p.bg : 'transparent',
                  outline: isActive ? `2px solid ${p.activeBorder}` : 'none',
                  outlineOffset: -1,
                  transition: 'background .15s',
                  userSelect: 'none',
                }}
              >
                <div style={{ fontSize: 30, fontWeight: 700, color: p.color, lineHeight: 1 }}>{p.n}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4, fontWeight: isActive ? 700 : 400 }}>{p.label}</div>
              </div>
            )
          })}
        </div>

        {/* Segmented bar */}
        <div style={{ height: 6, borderRadius: 99, overflow: 'hidden', display: 'flex', background: 'var(--line)' }}>
          {seg.campus      > 0 && <div style={{ width: `${seg.campus}%`,      background: 'var(--ok)',       transition: 'width 1s cubic-bezier(.16,1,.3,1)' }} />}
          {seg.wfh         > 0 && <div style={{ width: `${seg.wfh}%`,         background: 'var(--blue)',     transition: 'width 1s cubic-bezier(.16,1,.3,1)' }} />}
          {seg.late        > 0 && <div style={{ width: `${seg.late}%`,        background: 'var(--warn)',     transition: 'width 1s cubic-bezier(.16,1,.3,1)' }} />}
          {seg.absent      > 0 && <div style={{ width: `${seg.absent}%`,      background: 'var(--danger)',   transition: 'width 1s cubic-bezier(.16,1,.3,1)' }} />}
          {seg.not_checked > 0 && <div style={{ width: `${seg.not_checked}%`, background: 'var(--line-mid)', transition: 'width 1s cubic-bezier(.16,1,.3,1)' }} />}
        </div>
        <div style={{ display: 'flex', gap: 14, marginTop: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          {[
            { label: 'วิทยาลัย', color: 'var(--ok)' },
            { label: 'WFH',      color: 'var(--blue)' },
            { label: 'สาย',      color: 'var(--warn)' },
            { label: hardCutoffPassed ? 'ขาด' : 'ยังไม่มา', color: hardCutoffPassed ? 'var(--danger)' : 'var(--line-mid)' },
          ].map(l => (
            <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 7, height: 7, borderRadius: 2, background: l.color, flexShrink: 0 }} />
              <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{l.label}</span>
            </div>
          ))}
          <div style={{ marginLeft: 'auto', fontSize: 11.5, color: 'var(--text-muted)' }}>
            ครูทั้งหมด {total} คน
          </div>
        </div>
      </div>

      {/* ── Filter buttons ──────────────────────────────────── */}
      <div className="presence-filter-bar" style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
        {([
          { key: null,       label: 'ทั้งหมด',  count: total,          color: 'var(--accent)' },
          { key: 'present',  label: 'วิทยาลัย', count: counts.campus,  color: 'var(--ok)' },
          { key: 'wfh',      label: 'WFH',       count: counts.wfh,     color: 'var(--blue)' },
          { key: 'late',     label: 'สาย',       count: counts.late,    color: 'var(--warn)' },
          { key: 'absent',   label: hardCutoffPassed ? 'ขาด' : 'ยังไม่มา', count: notPresentCount, color: hardCutoffPassed ? 'var(--danger)' : 'var(--neutral)' },
        ] as { key: FilterKey; label: string; count: number; color: string }[]).map(btn => {
          const isActive = filter === btn.key
          return (
            <button
              key={String(btn.key)}
              onClick={() => toggleFilter(btn.key)}
              style={{
                padding: '7px 16px', borderRadius: 99, fontSize: 13, fontWeight: 600,
                border: `1.5px solid ${isActive ? btn.color : 'var(--line-mid)'}`,
                background: isActive ? btn.color : 'var(--bg-surface)',
                color: isActive ? '#fff' : 'var(--text-secondary)',
                cursor: 'pointer', fontFamily: "'Sarabun', sans-serif",
                transition: 'all .15s', whiteSpace: 'nowrap',
              }}
            >
              {btn.label}
              <span style={{
                marginLeft: 6, fontSize: 11, fontWeight: 700,
                opacity: isActive ? 0.85 : 0.6,
                background: isActive ? 'rgba(255,255,255,.2)' : 'var(--bg-active)',
                color: isActive ? 'inherit' : 'var(--text-muted)',
                padding: '1px 6px', borderRadius: 99,
              }}>
                {btn.count}
              </span>
            </button>
          )
        })}
        {filter !== null && (
          <button
            onClick={() => setFilter(null)}
            style={{
              padding: '7px 14px', borderRadius: 99, fontSize: 12,
              border: '1.5px solid var(--line-mid)',
              background: 'transparent',
              color: 'var(--text-muted)',
              cursor: 'pointer', fontFamily: "'Sarabun', sans-serif",
              transition: 'all .15s',
            }}
          >
            ✕ ล้างตัวกรอง
          </button>
        )}
      </div>

      {/* ── Groups + compact card grid ──────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {visibleGroups.map(group => (
          <div key={String(group.key)}>
            {/* Group header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <div style={{ width: 10, height: 10, borderRadius: 3, background: group.color, flexShrink: 0 }} />
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{group.label}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{group.sublabel}</div>
              <div style={{
                marginLeft: 'auto', padding: '2px 10px', borderRadius: 99,
                background: group.dimColor, border: `1px solid ${group.borderColor}`,
                fontSize: 12, fontWeight: 700, color: group.textColor,
              }}>
                {group.rows.length} คน
              </div>
            </div>

            {/* Compact cards grid */}
            <div className="presence-grid">
              {group.rows.map(row => {
                const cv = CHIP_VARIANT[row.effectiveStatus] ?? 'neutral'
                const cc = chipColors[cv]
                return (
                  <div key={row.userId} style={{
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--line)',
                    borderLeft: `3px solid ${group.color}`,
                    borderRadius: 8,
                    padding: '10px 12px',
                    display: 'flex', flexDirection: 'column', gap: 7,
                    boxShadow: '0 1px 2px rgba(30,36,51,.03)',
                  }}>
                    {/* Avatar + Name */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {row.avatarUrl
                        ? <img src={row.avatarUrl} alt="" style={{ width: 30, height: 30, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: `1.5px solid ${group.borderColor}` }} />
                        : <div style={{
                            width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
                            background: group.dimColor, border: `1.5px solid ${group.borderColor}`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 10.5, fontWeight: 700, color: group.textColor,
                          }}>
                            {row.initials}
                          </div>
                      }
                      <div style={{ minWidth: 0 }}>
                        <div style={{
                          fontSize: 13, fontWeight: 600, color: 'var(--text-primary)',
                          lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {row.name}
                        </div>
                        <div style={{ fontSize: 10.5, color: 'var(--text-muted)', lineHeight: 1.2 }}>
                          {row.dept ?? '—'}
                        </div>
                      </div>
                    </div>

                    {/* Status chip + time */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        padding: '2px 8px', borderRadius: 99,
                        fontSize: 11.5, fontWeight: 700,
                        background: cc.bg, color: cc.color,
                        border: `1px solid ${cc.border}`,
                        whiteSpace: 'nowrap', flexShrink: 0,
                      }}>
                        <span style={{ width: 5, height: 5, borderRadius: '50%', background: cc.color, flexShrink: 0 }} />
                        {CHIP_LABEL[row.effectiveStatus]}
                      </span>
                      <div style={{
                        fontSize: 11.5, fontVariantNumeric: 'tabular-nums',
                        color: 'var(--text-muted)', textAlign: 'right',
                        lineHeight: 1.3, flexShrink: 0,
                      }}>
                        {row.checkIn
                          ? <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{row.checkIn}</span>
                          : <span>—</span>
                        }
                        {row.checkOut && (
                          <span style={{ color: 'var(--text-dim)' }}> › {row.checkOut}</span>
                        )}
                      </div>
                    </div>

                    {/* Late reason */}
                    {row.lateReason && (
                      <div style={{
                        fontSize: 11, color: 'var(--warn-text)',
                        background: 'var(--warn-dim)',
                        border: '1px solid rgba(217,119,6,.18)',
                        borderRadius: 5, padding: '3px 8px',
                        lineHeight: 1.45,
                      }}>
                        <span style={{ fontWeight: 700 }}>เหตุผล:</span> {row.lateReason}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))}

        {visibleGroups.length === 0 && (
          <div style={{
            background: 'var(--bg-surface)', border: '1px solid var(--line)',
            borderRadius: 12, padding: '40px', textAlign: 'center',
            fontSize: 13, color: 'var(--text-muted)',
          }}>
            ไม่มีข้อมูลในกลุ่มที่เลือก
          </div>
        )}
      </div>
    </div>
  )
}
