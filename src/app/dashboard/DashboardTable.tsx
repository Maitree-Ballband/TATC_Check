'use client'
import { useState } from 'react'
import { Chip, LocBadge } from '@/components/ui'

type SortMode = 'name' | 'checkin_asc' | 'checkin_desc'

export type DashRow = {
  userId:               string
  name:                 string
  dept:                 string | null
  avatarUrl:            string | null
  checkInAt:            string | null
  checkOutAt:           string | null
  locationMode:         string | null
  checkOutLocationMode: string | null
  effectiveStatus:      string
}

const TZ = 'Asia/Bangkok'

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('th-TH', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false })
}

export function DashboardTable({ rows }: { rows: DashRow[] }) {
  const [sortMode, setSortMode] = useState<SortMode>('name')

  const sortedRows = sortMode === 'name' ? rows : [...rows].sort((a, b) => {
    const ta = a.checkInAt ?? ''
    const tb = b.checkInAt ?? ''
    if (!ta && !tb) return 0
    if (!ta) return 1
    if (!tb) return -1
    return sortMode === 'checkin_asc' ? ta.localeCompare(tb) : tb.localeCompare(ta)
  })

  return (
    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--line)', borderRadius: 12, boxShadow: '0 1px 4px rgba(30,36,51,.05)', overflow: 'hidden' }}>
      {/* Panel header */}
      <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>รายชื่อครู</div>
          <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: 'var(--bg-active)', color: 'var(--text-muted)', border: '1px solid var(--line)' }}>
            {rows.length} คน
          </span>
        </div>

        {/* Sort toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '.07em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
            เรียง
          </span>
          <div style={{ display: 'inline-flex', borderRadius: 7, border: '1px solid var(--line-mid)', overflow: 'hidden' }}>
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
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--bg-raised)' }}>
              {['#', 'ครู', 'เวลาเช็คอิน', 'สถานที่เข้า', 'เวลาเช็คเอาท์', 'สถานที่ออก', 'สถานะ'].map(h => (
                <th key={h} style={{
                  padding: '9px 14px', fontSize: 10.5, fontWeight: 500,
                  color: 'var(--text-muted)', textAlign: h === '#' ? 'center' : 'left',
                  letterSpacing: '.07em', textTransform: 'uppercase',
                  borderBottom: '1px solid var(--line)', whiteSpace: 'nowrap',
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((row, i) => (
              <tr key={row.userId} className="dash-row" style={{ borderBottom: '1px solid var(--line)' }}>
                <td style={{ padding: '10px 14px', textAlign: 'center', fontSize: 11.5, color: 'var(--text-dim)', fontWeight: 500, width: 36 }}>
                  {i + 1}
                </td>
                <td style={{ padding: '10px 14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {row.avatarUrl
                      ? <img src={row.avatarUrl} alt="" style={{ width: 30, height: 30, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: '1px solid rgba(61,90,241,.15)' }} />
                      : <div style={{
                          width: 30, height: 30, borderRadius: '50%',
                          background: 'var(--accent-dim)', border: '1px solid rgba(61,90,241,.15)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 10.5, fontWeight: 700, color: 'var(--accent)', flexShrink: 0,
                        }}>
                          {row.name.slice(0, 2)}
                        </div>
                    }
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', lineHeight: 1.3 }}>
                        {row.name}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        {row.dept ?? '—'}
                      </div>
                    </div>
                  </div>
                </td>
                <td style={{ padding: '10px 14px', fontSize: 12.5, fontWeight: 600, color: row.checkInAt ? 'var(--text-primary)' : 'var(--text-dim)', fontVariantNumeric: 'tabular-nums' }}>
                  {row.checkInAt ? fmtTime(row.checkInAt) : '—'}
                </td>
                <td style={{ padding: '10px 14px' }}>
                  {row.checkInAt
                    ? <LocBadge mode={row.locationMode as 'campus' | 'wfh' | null} />
                    : <span style={{ color: 'var(--text-dim)' }}>—</span>}
                </td>
                <td style={{ padding: '10px 14px', fontSize: 12.5, fontWeight: 600, color: row.checkOutAt ? 'var(--blue-text)' : 'var(--text-dim)', fontVariantNumeric: 'tabular-nums' }}>
                  {row.checkOutAt ? fmtTime(row.checkOutAt) : '—'}
                </td>
                <td style={{ padding: '10px 14px' }}>
                  {row.checkOutAt
                    ? <LocBadge mode={row.checkOutLocationMode as 'campus' | 'wfh' | null} />
                    : <span style={{ color: 'var(--text-dim)' }}>—</span>}
                </td>
                <td style={{ padding: '10px 14px' }}>
                  {row.effectiveStatus === 'wfh'            && <Chip variant="blue"    label="WFH"              />}
                  {row.effectiveStatus === 'present'        && <Chip variant="ok"      label="วิทยาลัย"         />}
                  {row.effectiveStatus === 'late'           && <Chip variant="warn"    label="สาย"              />}
                  {row.effectiveStatus === 'wfh_late'       && <Chip variant="warn"    label="WFH · สาย"        />}
                  {row.effectiveStatus === 'absent'         && <Chip variant="danger"  label="ขาด"              />}
                  {row.effectiveStatus === 'not_checked'    && <Chip variant="neutral" label="ยังไม่มา"         />}
                  {row.effectiveStatus === 'not_registered' && <Chip variant="neutral" label="ยังไม่ลงทะเบียน" />}
                </td>
              </tr>
            ))}
            {sortedRows.length === 0 && (
              <tr>
                <td colSpan={7} style={{ padding: '28px 14px', textAlign: 'center', fontSize: 13, color: 'var(--text-muted)' }}>
                  ไม่มีข้อมูลครู
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
