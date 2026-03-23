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
  notPresentCount:  number
}

type FilterKey = 'present' | 'wfh' | 'late' | 'absent' | null

// ── Status display config ─────────────────────────────────────
const STATUS_COLOR: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  present:     { bg: 'var(--ok-dim)',      text: 'var(--ok-text)',      border: 'rgba(22,163,74,.2)',  dot: 'var(--ok)'      },
  wfh:         { bg: 'var(--blue-dim)',    text: 'var(--blue-text)',    border: 'rgba(37,99,235,.2)',  dot: 'var(--blue)'    },
  late:        { bg: 'var(--warn-dim)',    text: 'var(--warn-text)',    border: 'rgba(217,119,6,.2)',  dot: 'var(--warn)'    },
  wfh_late:    { bg: 'var(--warn-dim)',    text: 'var(--warn-text)',    border: 'rgba(217,119,6,.2)',  dot: 'var(--warn)'    },
  absent:      { bg: 'var(--danger-dim)',  text: 'var(--danger-text)',  border: 'rgba(220,38,38,.2)',  dot: 'var(--danger)'  },
  not_checked: { bg: 'var(--neutral-dim)', text: 'var(--text-secondary)', border: 'var(--line)',      dot: 'var(--line-mid)' },
}
const STATUS_LABEL: Record<string, string> = {
  present: 'วิทยาลัย', wfh: 'WFH', late: 'สาย', wfh_late: 'WFH · สาย',
  absent: 'ขาด', not_checked: 'ยังไม่มา',
}

export function PresenceBoard({ rows, hardCutoffPassed, counts, total, notPresentCount }: Props) {
  const [filter, setFilter] = useState<FilterKey>(null)

  function toggleFilter(key: FilterKey) {
    setFilter(f => f === key ? null : key)
  }

  // Filter logic: map FilterKey → effectiveStatus values
  const matchesFilter = (es: string): boolean => {
    if (filter === null)      return true
    if (filter === 'present') return es === 'present'
    if (filter === 'wfh')     return es === 'wfh'
    if (filter === 'late')    return es === 'late' || es === 'wfh_late'
    if (filter === 'absent')  return es === 'absent' || es === 'not_checked'
    return true
  }

  const visibleRows = rows.filter(r => matchesFilter(r.effectiveStatus))

  // Summary pills
  const pills = [
    { key: 'present' as FilterKey, label: 'วิทยาลัย', n: counts.campus,   color: 'var(--ok-text)',      bg: 'var(--ok-dim)',      activeBorder: 'rgba(22,163,74,.4)'   },
    { key: 'wfh'     as FilterKey, label: 'WFH',       n: counts.wfh,      color: 'var(--blue-text)',    bg: 'var(--blue-dim)',    activeBorder: 'rgba(37,99,235,.4)'   },
    { key: 'late'    as FilterKey, label: 'สาย',        n: counts.late,     color: 'var(--warn-text)',    bg: 'var(--warn-dim)',    activeBorder: 'rgba(217,119,6,.4)'   },
    {
      key:   'absent' as FilterKey,
      label: hardCutoffPassed ? 'ขาด' : 'ยังไม่มา',
      n:     notPresentCount,
      color: hardCutoffPassed ? 'var(--danger-text)' : 'var(--text-muted)',
      bg:    hardCutoffPassed ? 'var(--danger-dim)'  : 'var(--neutral-dim)',
      activeBorder: hardCutoffPassed ? 'rgba(220,38,38,.4)' : 'rgba(107,114,128,.4)',
    },
  ]

  return (
    <div>
      {/* ── Summary pills ─────────────────────────────────────── */}
      <div style={{
        background: 'var(--bg-surface)', border: '1px solid var(--line)',
        borderRadius: 12, padding: '14px 16px', marginBottom: 14,
        boxShadow: '0 1px 4px rgba(30,36,51,.05)',
      }}>
        <div className="presence-stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 1 }}>
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
                  outlineOffset: -1, transition: 'background .15s', userSelect: 'none',
                }}
              >
                <div style={{ fontSize: 28, fontWeight: 700, color: p.color, lineHeight: 1 }}>{p.n}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4, fontWeight: isActive ? 700 : 400 }}>{p.label}</div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Filter buttons ─────────────────────────────────────── */}
      <div className="presence-filter-bar" style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
        {([
          { key: null,      label: 'ทั้งหมด',                               count: total,          color: 'var(--accent)' },
          { key: 'present', label: 'วิทยาลัย',                              count: counts.campus,  color: 'var(--ok)' },
          { key: 'wfh',     label: 'WFH',                                   count: counts.wfh,     color: 'var(--blue)' },
          { key: 'late',    label: 'สาย',                                   count: counts.late,    color: 'var(--warn)' },
          { key: 'absent',  label: hardCutoffPassed ? 'ขาด' : 'ยังไม่มา',   count: notPresentCount, color: hardCutoffPassed ? 'var(--danger)' : 'var(--neutral)' },
        ] as { key: FilterKey; label: string; count: number; color: string }[]).map(btn => {
          const isActive = filter === btn.key
          return (
            <button
              key={String(btn.key)}
              onClick={() => toggleFilter(btn.key)}
              style={{
                padding: '6px 14px', borderRadius: 99, fontSize: 13, fontWeight: 600,
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
              padding: '6px 12px', borderRadius: 99, fontSize: 12,
              border: '1.5px solid var(--line-mid)', background: 'transparent',
              color: 'var(--text-muted)', cursor: 'pointer',
              fontFamily: "'Sarabun', sans-serif", transition: 'all .15s',
            }}
          >
            ✕ ล้างตัวกรอง
          </button>
        )}
      </div>

      {/* ── Horizontal list ────────────────────────────────────── */}
      <div style={{
        background: 'var(--bg-surface)', border: '1px solid var(--line)',
        borderRadius: 12, overflow: 'hidden',
        boxShadow: '0 1px 4px rgba(30,36,51,.04)',
      }}>
        {/* Table header */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '36px 1fr 90px 80px 80px',
          gap: 0,
          padding: '8px 16px',
          background: 'var(--bg-raised)',
          borderBottom: '1px solid var(--line)',
        }}>
          {['#', 'ชื่อ-สกุล / แผนก', 'สถานะ', 'เข้างาน', 'ออกงาน'].map(h => (
            <div key={h} style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '.07em', textTransform: 'uppercase' }}>
              {h}
            </div>
          ))}
        </div>

        {/* Rows */}
        {visibleRows.length === 0 && (
          <div style={{ padding: '32px', textAlign: 'center', fontSize: 13, color: 'var(--text-muted)' }}>
            ไม่มีข้อมูลในกลุ่มที่เลือก
          </div>
        )}

        {visibleRows.map((row, idx) => {
          const sc = STATUS_COLOR[row.effectiveStatus] ?? STATUS_COLOR.not_checked
          return (
            <div
              key={row.userId}
              style={{
                display: 'grid',
                gridTemplateColumns: '36px 1fr 90px 80px 80px',
                gap: 0,
                padding: '9px 16px',
                borderBottom: idx < visibleRows.length - 1 ? '1px solid var(--line)' : 'none',
                alignItems: 'center',
                borderLeft: `3px solid ${sc.dot}`,
              }}
            >
              {/* # */}
              <div style={{ fontSize: 11.5, color: 'var(--text-dim)', fontWeight: 500 }}>
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
                    {row.lateReason && (
                      <span style={{ marginLeft: 6, color: 'var(--warn-text)', fontStyle: 'italic' }}>
                        · {row.lateReason.length > 28 ? row.lateReason.slice(0, 28) + '…' : row.lateReason}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Status chip */}
              <div>
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

              {/* Check-in time */}
              <div style={{ fontSize: 13, fontWeight: 600, color: row.checkIn ? 'var(--text-primary)' : 'var(--text-dim)', fontVariantNumeric: 'tabular-nums' }}>
                {row.checkIn ?? '—'}
              </div>

              {/* Check-out time */}
              <div style={{ fontSize: 13, fontWeight: 600, color: row.checkOut ? 'var(--blue-text)' : 'var(--text-dim)', fontVariantNumeric: 'tabular-nums' }}>
                {row.checkOut ?? '—'}
              </div>
            </div>
          )
        })}
      </div>

      {/* Row count */}
      {visibleRows.length > 0 && (
        <div style={{ fontSize: 11.5, color: 'var(--text-muted)', textAlign: 'right', marginTop: 8 }}>
          แสดง {visibleRows.length} จาก {total} คน
        </div>
      )}
    </div>
  )
}
