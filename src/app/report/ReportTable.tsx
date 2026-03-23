'use client'
import { useState } from 'react'
import { Chip } from '@/components/ui'

export type ReportSummary = {
  user: { id: string; full_name_th: string; department: string | null; avatar_url: string | null }
  campus: number
  wfh: number
  worked: number
  rate: number
}

interface Props {
  summaries:    ReportSummary[]
  daysInRange:  number
  rangeLabel:   string
  from:         string
  to:           string
}

export function ReportTable({ summaries, daysInRange, rangeLabel, from, to }: Props) {
  const [search, setSearch] = useState('')

  const q = search.trim().toLowerCase()
  const visible = q
    ? summaries.filter(s =>
        s.user.full_name_th.toLowerCase().includes(q) ||
        (s.user.department ?? '').toLowerCase().includes(q)
      )
    : summaries

  return (
    <div style={{
      background: 'var(--bg-surface)', border: '1px solid var(--line)',
      borderRadius: 12, overflow: 'hidden',
      boxShadow: '0 1px 4px rgba(30,36,51,.05)',
    }}>
      {/* Panel header */}
      <div style={{
        padding: '14px 20px', borderBottom: '1px solid var(--line)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap',
      }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', flexShrink: 0 }}>
          {rangeLabel}
        </div>

        {/* Search */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 180, maxWidth: 280 }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <svg style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)', pointerEvents: 'none' }}
              width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8">
              <circle cx="7" cy="7" r="5"/><path d="M12 12l2 2"/>
            </svg>
            <input
              type="text"
              placeholder="ค้นหาชื่อ / แผนก…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                width: '100%', padding: '6px 10px 6px 28px', borderRadius: 7, fontSize: 13,
                background: 'var(--bg-raised)', border: '1px solid var(--line-mid)',
                color: 'var(--text-primary)', fontFamily: "'Sarabun', sans-serif",
                outline: 'none', boxSizing: 'border-box',
              }}
            />
          </div>
          {search && (
            <button onClick={() => setSearch('')} style={{
              fontSize: 11, color: 'var(--text-muted)', background: 'none', border: 'none',
              cursor: 'pointer', padding: '4px 6px', borderRadius: 4,
            }}>✕</button>
          )}
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
          <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
            *อัตราเทียบจาก {daysInRange} วันปฏิทิน
          </span>
          <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: 'var(--bg-active)', color: 'var(--text-muted)', border: '1px solid var(--line)' }}>
            {visible.length} คน
          </span>
          <button
            onClick={() => { window.location.href = `/api/admin/export-report?from=${from}&to=${to}` }}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '6px 14px', borderRadius: 7, fontSize: 12, fontWeight: 600,
              background: 'var(--ok)', color: '#fff', border: '1px solid var(--ok)',
              cursor: 'pointer', fontFamily: "'Sarabun', sans-serif",
              boxShadow: '0 2px 6px rgba(22,163,74,.2)', transition: 'all .15s', whiteSpace: 'nowrap',
            }}
          >
            <ExcelIcon /> Export Excel
          </button>
        </div>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--bg-raised)' }}>
              {[
                { label: '#',        align: 'center' },
                { label: 'ครู',      align: 'left'   },
                { label: 'วิทยาลัย', align: 'right'  },
                { label: 'WFH',      align: 'right'  },
                { label: 'รวมมา',    align: 'right'  },
                { label: 'อัตรา',    align: 'left'   },
              ].map(h => (
                <th key={h.label} style={{
                  padding: '9px 14px', fontSize: 10.5, fontWeight: 500,
                  color: 'var(--text-muted)', textAlign: h.align as 'left' | 'right' | 'center',
                  letterSpacing: '.07em', textTransform: 'uppercase',
                  borderBottom: '1px solid var(--line)', whiteSpace: 'nowrap',
                }}>
                  {h.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((s, i) => (
              <tr key={s.user.id} className="dash-row" style={{ borderBottom: '1px solid var(--line)' }}>
                <td style={{ padding: '11px 14px', textAlign: 'center', fontSize: 11.5, color: 'var(--text-dim)', width: 36 }}>{i + 1}</td>
                <td style={{ padding: '11px 14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {s.user.avatar_url
                      ? <img src={s.user.avatar_url} alt="" style={{ width: 30, height: 30, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: '1px solid rgba(61,90,241,.15)' }} />
                      : <div style={{ width: 30, height: 30, borderRadius: '50%', flexShrink: 0, background: 'var(--accent-dim)', border: '1px solid rgba(61,90,241,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10.5, fontWeight: 700, color: 'var(--accent)' }}>
                          {s.user.full_name_th.slice(0, 2)}
                        </div>
                    }
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', lineHeight: 1.3 }}>{s.user.full_name_th}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{s.user.department ?? '—'}</div>
                    </div>
                  </div>
                </td>
                <td style={{ padding: '11px 14px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: s.campus > 0 ? 'var(--ok-text)' : 'var(--text-dim)' }}>{s.campus}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 3 }}>วัน</span>
                </td>
                <td style={{ padding: '11px 14px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: s.wfh > 0 ? 'var(--blue-text)' : 'var(--text-dim)' }}>{s.wfh}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 3 }}>วัน</span>
                </td>
                <td style={{ padding: '11px 14px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{s.worked}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 3 }}>/ {daysInRange} วัน</span>
                </td>
                <td style={{ padding: '11px 14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Chip variant={s.rate >= 80 ? 'ok' : s.rate >= 60 ? 'warn' : 'danger'} label={`${s.rate}%`} />
                    <div style={{ flex: 1, minWidth: 48, height: 4, background: 'var(--line)', borderRadius: 99, overflow: 'hidden' }}>
                      <div style={{ height: '100%', borderRadius: 99, width: `${Math.min(s.rate, 100)}%`, background: s.rate >= 80 ? 'var(--ok)' : s.rate >= 60 ? 'var(--warn)' : 'var(--danger)', transition: 'width .8s cubic-bezier(.16,1,.3,1)' }} />
                    </div>
                  </div>
                </td>
              </tr>
            ))}

            {visible.length === 0 && (
              <tr>
                <td colSpan={6} style={{ padding: '32px', textAlign: 'center', fontSize: 13, color: 'var(--text-muted)' }}>
                  {summaries.length === 0 ? 'ไม่มีข้อมูลในช่วงเวลาที่เลือก' : 'ไม่พบชื่อที่ค้นหา'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div style={{ padding: '10px 20px', borderTop: '1px solid var(--line)', background: 'var(--bg-raised)' }}>
        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
          <strong>อัตรา</strong> เทียบจากวันปฏิทินทั้งหมดในช่วงที่เลือก (รวมวันหยุด)
        </div>
      </div>
    </div>
  )
}

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
