import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import * as db from '@/lib/db'
import { todayDate } from '@/lib/attendance'
import { AppShell } from '@/components/layout/AppShell'
import { Chip, LocBadge } from '@/components/ui'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)
  if (!session || (session.user.role !== 'admin' && session.user.role !== 'executive')) redirect('/checkin')

  const date    = todayDate()
  const users   = await db.listActiveTeachers()
  const records = await db.getTodayRecordsForUsers(date, users.map(u => u.id))
  const recMap  = Object.fromEntries(records.map(r => [r.user_id, r]))

  const rows = (users ?? []).map(u => {
    const r  = recMap[u.id] ?? null
    const es = r?.check_in_at
      ? (r.location_mode === 'wfh' ? (r.status === 'late' ? 'wfh_late' : 'wfh') : r.status)
      : 'absent'
    return { user: u, record: r, effectiveStatus: es }
  })

  const stats = rows.reduce(
    (a, r) => {
      if      (r.effectiveStatus === 'wfh')                                     a.wfh++
      else if (r.effectiveStatus === 'present')                                  a.campus++
      else if (r.effectiveStatus === 'late' || r.effectiveStatus === 'wfh_late') a.late++
      else                                                                       a.absent++
      return a
    },
    { campus: 0, wfh: 0, late: 0, absent: 0 }
  )
  const total      = rows.length
  const presentAll = stats.campus + stats.wfh + stats.late
  const attendRate = total ? Math.round(presentAll / total * 100) : 0

  const recentLogs = records
    .filter(r => r.check_in_at)
    .sort((a, b) => new Date(b.check_in_at!).getTime() - new Date(a.check_in_at!).getTime())
    .slice(0, 8)

  const dateLabel = new Date().toLocaleDateString('th-TH', {
    timeZone: 'Asia/Bangkok', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })

  /* segment bar widths */
  const seg = {
    campus: total ? (stats.campus / total * 100) : 0,
    wfh:    total ? (stats.wfh    / total * 100) : 0,
    late:   total ? (stats.late   / total * 100) : 0,
    absent: total ? (stats.absent / total * 100) : 0,
  }

  return (
    <AppShell>

      {/* ── Page Header ─────────────────────────────────────────── */}
      <div className="animate-fade-up" style={{
        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
        marginBottom: 24, gap: 16, flexWrap: 'wrap',
      }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 500, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 6 }}>
            ภาพรวมประจำวัน
          </div>
          <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-.01em', lineHeight: 1.2, marginBottom: 4 }}>
            รายงานการเข้างาน
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{dateLabel}</div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          {/* Attendance rate badge */}
          <div style={{
            padding: '8px 16px', borderRadius: 8,
            background: attendRate >= 80 ? 'var(--ok-dim)' : attendRate >= 50 ? 'var(--warn-dim)' : 'var(--danger-dim)',
            border: `1px solid ${attendRate >= 80 ? 'rgba(22,163,74,.2)' : attendRate >= 50 ? 'rgba(217,119,6,.2)' : 'rgba(220,38,38,.2)'}`,
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1,
          }}>
            <div style={{ fontSize: 22, fontWeight: 700, lineHeight: 1, color: attendRate >= 80 ? 'var(--ok-text)' : attendRate >= 50 ? 'var(--warn-text)' : 'var(--danger-text)' }}>
              {attendRate}%
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '.05em' }}>อัตราเข้างาน</div>
          </div>

          {/* Live badge */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '6px 12px', borderRadius: 6,
            background: 'var(--ok-dim)', border: '1px solid rgba(22,163,74,.2)',
            fontSize: 12, fontWeight: 600, color: 'var(--ok-text)',
          }}>
            <span style={{
              width: 6, height: 6, borderRadius: '50%', background: 'var(--ok)',
              boxShadow: '0 0 0 2px var(--ok-dim)',
            }} />
            LIVE
          </div>
        </div>
      </div>

      {/* ── KPI Cards ───────────────────────────────────────────── */}
      <div className="animate-fade-up-d1" style={{
        display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 16,
      }}>
        {[
          { label: 'มา (วิทยาลัย)', value: stats.campus, sub: `${total ? Math.round(stats.campus/total*100) : 0}% ของทั้งหมด`, color: 'var(--ok)',     dimColor: 'var(--ok-dim)',     textColor: 'var(--ok-text)' },
          { label: 'Work From Home', value: stats.wfh,    sub: `${total ? Math.round(stats.wfh/total*100)    : 0}% ของทั้งหมด`, color: 'var(--blue)',   dimColor: 'var(--blue-dim)',   textColor: 'var(--blue-text)' },
          { label: 'มาสาย',          value: stats.late,   sub: `เกิน 08:30 น.`,                                                  color: 'var(--warn)',   dimColor: 'var(--warn-dim)',   textColor: 'var(--warn-text)' },
          { label: 'ยังไม่มา',       value: stats.absent, sub: `ณ เวลานี้`,                                                     color: 'var(--danger)', dimColor: 'var(--danger-dim)', textColor: 'var(--danger-text)' },
        ].map(k => (
          <div key={k.label} style={{
            background: 'var(--bg-surface)', border: '1px solid var(--line)',
            borderRadius: 12, padding: '18px 20px',
            boxShadow: '0 1px 4px rgba(30,36,51,.05)',
            display: 'flex', flexDirection: 'column', gap: 8,
            position: 'relative', overflow: 'hidden',
          }}>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>{k.label}</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span style={{ fontSize: 36, fontWeight: 700, lineHeight: 1, color: 'var(--text-primary)' }}>{k.value}</span>
              <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>คน</span>
            </div>
            <div style={{ fontSize: 11.5, color: k.textColor }}>{k.sub}</div>
            {/* colored bottom bar */}
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, background: k.color, opacity: .7 }} />
          </div>
        ))}
      </div>

      {/* ── Segmented Attendance Bar ─────────────────────────────── */}
      <div className="animate-fade-up-d1" style={{
        background: 'var(--bg-surface)', border: '1px solid var(--line)',
        borderRadius: 12, padding: '18px 20px', marginBottom: 16,
        boxShadow: '0 1px 4px rgba(30,36,51,.05)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>สัดส่วนการเข้างานวันนี้</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>ครูทั้งหมด {total} คน</div>
        </div>

        {/* Segmented bar */}
        <div style={{ height: 10, borderRadius: 99, overflow: 'hidden', display: 'flex', marginBottom: 14, background: 'var(--line)' }}>
          {seg.campus > 0 && <div style={{ width: `${seg.campus}%`, background: 'var(--ok)',     transition: 'width 1s cubic-bezier(.16,1,.3,1)' }} />}
          {seg.wfh    > 0 && <div style={{ width: `${seg.wfh}%`,    background: 'var(--blue)',   transition: 'width 1s cubic-bezier(.16,1,.3,1)' }} />}
          {seg.late   > 0 && <div style={{ width: `${seg.late}%`,   background: 'var(--warn)',   transition: 'width 1s cubic-bezier(.16,1,.3,1)' }} />}
          {seg.absent > 0 && <div style={{ width: `${seg.absent}%`, background: 'var(--danger)', transition: 'width 1s cubic-bezier(.16,1,.3,1)' }} />}
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
          {[
            { label: 'วิทยาลัย', count: stats.campus, color: 'var(--ok)' },
            { label: 'WFH',      count: stats.wfh,    color: 'var(--blue)' },
            { label: 'มาสาย',    count: stats.late,   color: 'var(--warn)' },
            { label: 'ขาด',      count: stats.absent, color: 'var(--danger)' },
          ].map(l => (
            <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: l.color, flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{l.label}</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{l.count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Table + Log ──────────────────────────────────────────── */}
      <div className="animate-fade-up-d2" style={{
        display: 'grid', gridTemplateColumns: '1fr 340px', gap: 14, alignItems: 'start',
      }}>

        {/* Teacher Table */}
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--line)', borderRadius: 12, boxShadow: '0 1px 4px rgba(30,36,51,.05)', overflow: 'hidden' }}>
          {/* Panel header */}
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>รายชื่อครู</div>
            <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: 'var(--bg-active)', color: 'var(--text-muted)', border: '1px solid var(--line)' }}>
              {rows.length} คน
            </span>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--bg-raised)' }}>
                  {['#', 'ครู', 'สถานที่', 'เช็คอิน', 'เช็คเอาท์', 'สถานะ'].map(h => (
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
                {rows.map((row, i) => (
                  <tr key={row.user.id} className="dash-row" style={{ borderBottom: '1px solid var(--line)' }}>
                    {/* Row number */}
                    <td style={{ padding: '10px 14px', textAlign: 'center', fontSize: 11.5, color: 'var(--text-dim)', fontWeight: 500, width: 36 }}>
                      {i + 1}
                    </td>
                    {/* Avatar + name */}
                    <td style={{ padding: '10px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                          width: 30, height: 30, borderRadius: '50%',
                          background: 'var(--accent-dim)', border: '1px solid rgba(61,90,241,.15)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 10.5, fontWeight: 700, color: 'var(--accent)', flexShrink: 0,
                        }}>
                          {row.user.full_name_th.slice(0, 2)}
                        </div>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', lineHeight: 1.3 }}>
                            {row.user.full_name_th}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                            {row.user.department ?? '—'}
                          </div>
                        </div>
                      </div>
                    </td>
                    {/* Location */}
                    <td style={{ padding: '10px 14px' }}>
                      <LocBadge mode={row.record?.location_mode ?? null} />
                    </td>
                    {/* Check-in */}
                    <td style={{ padding: '10px 14px', fontSize: 12.5, color: row.record?.check_in_at ? 'var(--text-secondary)' : 'var(--text-dim)', fontVariantNumeric: 'tabular-nums' }}>
                      {row.record?.check_in_at
                        ? new Date(row.record.check_in_at).toLocaleTimeString('th-TH', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit', hour12: false })
                        : '—'}
                    </td>
                    {/* Check-out */}
                    <td style={{ padding: '10px 14px', fontSize: 12.5, color: row.record?.check_out_at ? 'var(--text-secondary)' : 'var(--text-dim)', fontVariantNumeric: 'tabular-nums' }}>
                      {row.record?.check_out_at
                        ? new Date(row.record.check_out_at).toLocaleTimeString('th-TH', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit', hour12: false })
                        : '—'}
                    </td>
                    {/* Status */}
                    <td style={{ padding: '10px 14px' }}>
                      {row.effectiveStatus === 'wfh'      && <Chip variant="blue"   label="WFH"         />}
                      {row.effectiveStatus === 'present'  && <Chip variant="ok"     label="ปกติ"         />}
                      {row.effectiveStatus === 'late'     && <Chip variant="warn"   label="สาย"          />}
                      {row.effectiveStatus === 'wfh_late' && <Chip variant="warn"   label="WFH · สาย"    />}
                      {row.effectiveStatus === 'absent'   && <Chip variant="danger" label="ยังไม่มา"     />}
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ padding: '28px 14px', textAlign: 'center', fontSize: 13, color: 'var(--text-muted)' }}>
                      ไม่มีข้อมูลครู
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Activity Log */}
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--line)', borderRadius: 12, boxShadow: '0 1px 4px rgba(30,36,51,.05)', overflow: 'hidden' }}>
          {/* Panel header */}
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>กิจกรรมล่าสุด</div>
            <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: 'var(--bg-active)', color: 'var(--text-muted)', border: '1px solid var(--line)' }}>
              วันนี้
            </span>
          </div>

          <div style={{ padding: '8px 0' }}>
            {recentLogs.map((r, i) => {
              const user = users.find(u => u.id === r.user_id)
              const isWfh     = r.location_mode === 'wfh'
              const isLate    = r.status === 'late'
              const isWfhLate = isWfh && isLate
              const dotC   = isWfhLate ? 'var(--warn)' : isWfh ? 'var(--blue)' : isLate ? 'var(--warn)' : 'var(--ok)'
              const dotBg  = isWfhLate ? 'var(--warn-dim)' : isWfh ? 'var(--blue-dim)' : isLate ? 'var(--warn-dim)' : 'var(--ok-dim)'
              const timeStr = new Date(r.check_in_at!).toLocaleTimeString('th-TH', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit', hour12: false })

              return (
                <div key={r.id} style={{ display: 'flex', gap: 12, padding: '10px 20px' }}>
                  {/* Timeline dot + line */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0, flexShrink: 0 }}>
                    <div style={{
                      width: 10, height: 10, borderRadius: '50%',
                      background: dotC, border: `2px solid ${dotBg}`,
                      boxShadow: `0 0 0 2px ${dotC}22`,
                      marginTop: 4, flexShrink: 0,
                    }} />
                    {i < recentLogs.length - 1 && (
                      <div style={{ width: 1, flex: 1, minHeight: 20, background: 'var(--line)', marginTop: 3 }} />
                    )}
                  </div>

                  {/* Content */}
                  <div style={{ flex: 1, paddingBottom: i < recentLogs.length - 1 ? 8 : 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                      <div style={{ fontSize: 12.5, color: 'var(--text-primary)', lineHeight: 1.4 }}>
                        <span style={{ fontWeight: 600 }}>{user?.full_name_th ?? '—'}</span>
                        <span style={{ color: 'var(--text-muted)' }}>
                          {' '}เช็คอิน{isWfh ? ' WFH' : ' วิทยาลัย'}{isLate ? ' · สาย' : ''}
                        </span>
                      </div>
                      <span style={{
                        flexShrink: 0, fontSize: 10.5, padding: '1px 6px', borderRadius: 4,
                        background: 'var(--bg-active)', color: 'var(--text-muted)',
                        fontVariantNumeric: 'tabular-nums',
                      }}>
                        {timeStr}
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}

            {recentLogs.length === 0 && (
              <div style={{ padding: '28px 20px', textAlign: 'center', fontSize: 13, color: 'var(--text-muted)' }}>
                ยังไม่มีกิจกรรม
              </div>
            )}
          </div>
        </div>

      </div>
    </AppShell>
  )
}
