import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import * as db from '@/lib/db'
import { todayDate } from '@/lib/attendance'
import { AppShell } from '@/components/layout/AppShell'
import { Chip, LocBadge } from '@/components/ui'

export const dynamic   = 'force-dynamic'
export const revalidate = 0

export default async function PresencePage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/auth/signin')
  if (session.user.role === 'teacher') redirect('/checkin')

  const date    = todayDate()
  const users   = await db.listActiveTeachers()
  const records = await db.getTodayRecordsForUsers(date, users.map(u => u.id))
  const recMap  = Object.fromEntries(records.map(r => [r.user_id, r]))

  const rows = users.map(u => {
    const r  = recMap[u.id] ?? null
    const es = r?.check_in_at
      ? (r.location_mode === 'wfh' ? (r.status === 'late' ? 'wfh_late' : 'wfh') : r.status)
      : 'absent'
    return { user: u, record: r, effectiveStatus: es }
  })

  const counts = rows.reduce(
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
  const presentAll = counts.campus + counts.wfh + counts.late
  const attendRate = total ? Math.round(presentAll / total * 100) : 0

  const dateLabel = new Date().toLocaleDateString('th-TH', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })

  /* ── Status groups (priority order) ──────────────────────── */
  const groups = [
    {
      key: 'present', label: 'มาปกติ', sublabel: 'เข้างานตรงเวลา',
      color: 'var(--ok)', dimColor: 'var(--ok-dim)', textColor: 'var(--ok-text)',
      borderColor: 'rgba(22,163,74,.2)',
      rows: rows.filter(r => r.effectiveStatus === 'present'),
    },
    {
      key: 'wfh', label: 'Work From Home', sublabel: 'ทำงานจากที่บ้าน',
      color: 'var(--blue)', dimColor: 'var(--blue-dim)', textColor: 'var(--blue-text)',
      borderColor: 'rgba(37,99,235,.2)',
      rows: rows.filter(r => r.effectiveStatus === 'wfh'),
    },
    {
      key: 'late', label: 'มาสาย', sublabel: 'เช็คอินหลัง 08:00 น.',
      color: 'var(--warn)', dimColor: 'var(--warn-dim)', textColor: 'var(--warn-text)',
      borderColor: 'rgba(217,119,6,.2)',
      rows: rows.filter(r => r.effectiveStatus === 'late' || r.effectiveStatus === 'wfh_late'),
    },
    {
      key: 'absent', label: 'ยังไม่มา', sublabel: 'ยังไม่มีการเช็คอิน',
      color: 'var(--danger)', dimColor: 'var(--danger-dim)', textColor: 'var(--danger-text)',
      borderColor: 'rgba(220,38,38,.2)',
      rows: rows.filter(r => r.effectiveStatus === 'absent'),
    },
  ].filter(g => g.rows.length > 0)

  const chipVariant: Record<string, 'ok' | 'warn' | 'danger' | 'blue'> = {
    present: 'ok', wfh: 'blue', late: 'warn', wfh_late: 'warn', absent: 'danger',
  }
  const chipLabel: Record<string, string> = {
    present: 'ปกติ', wfh: 'WFH', late: 'สาย', wfh_late: 'WFH · สาย', absent: 'ยังไม่มา',
  }

  /* ── Segmented bar widths ──────────────────────────────────── */
  const seg = {
    campus: total ? counts.campus / total * 100 : 0,
    wfh:    total ? counts.wfh    / total * 100 : 0,
    late:   total ? counts.late   / total * 100 : 0,
    absent: total ? counts.absent / total * 100 : 0,
  }

  return (
    <AppShell>

      {/* ── Page Header ──────────────────────────────────────── */}
      <div className="animate-fade-up" style={{
        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
        marginBottom: 24, gap: 16, flexWrap: 'wrap',
      }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 500, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 6 }}>
            กระดานสถานะครู
          </div>
          <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-.01em', lineHeight: 1.2, marginBottom: 4 }}>
            สถานะการเข้างาน
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
            <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '.05em' }}>เข้างานวันนี้</div>
          </div>

          {/* Live badge */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '6px 12px', borderRadius: 6,
            background: 'var(--ok-dim)', border: '1px solid rgba(22,163,74,.2)',
            fontSize: 12, fontWeight: 600, color: 'var(--ok-text)',
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--ok)', boxShadow: '0 0 0 2px var(--ok-dim)' }} />
            LIVE
          </div>
        </div>
      </div>

      {/* ── Summary Strip ────────────────────────────────────── */}
      <div className="animate-fade-up-d1" style={{
        background: 'var(--bg-surface)', border: '1px solid var(--line)',
        borderRadius: 12, padding: '16px 20px', marginBottom: 20,
        boxShadow: '0 1px 4px rgba(30,36,51,.05)',
      }}>
        {/* 4 stat pills */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 1, marginBottom: 14 }}>
          {[
            { label: 'วิทยาลัย',      n: counts.campus, color: 'var(--ok-text)',    bg: 'var(--ok-dim)' },
            { label: 'Work From Home', n: counts.wfh,    color: 'var(--blue-text)',  bg: 'var(--blue-dim)' },
            { label: 'มาสาย',         n: counts.late,   color: 'var(--warn-text)',  bg: 'var(--warn-dim)' },
            { label: 'ยังไม่มา',      n: counts.absent, color: 'var(--danger-text)', bg: 'var(--danger-dim)' },
          ].map((s, idx) => (
            <div key={s.label} style={{
              textAlign: 'center', padding: '10px 8px',
              borderRight: idx < 3 ? '1px solid var(--line)' : 'none',
            }}>
              <div style={{ fontSize: 28, fontWeight: 700, color: s.color, lineHeight: 1 }}>{s.n}</div>
              <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 4 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Segmented bar */}
        <div style={{ height: 6, borderRadius: 99, overflow: 'hidden', display: 'flex', background: 'var(--line)' }}>
          {seg.campus > 0 && <div style={{ width: `${seg.campus}%`, background: 'var(--ok)',     transition: 'width 1s cubic-bezier(.16,1,.3,1)' }} />}
          {seg.wfh    > 0 && <div style={{ width: `${seg.wfh}%`,    background: 'var(--blue)',   transition: 'width 1s cubic-bezier(.16,1,.3,1)' }} />}
          {seg.late   > 0 && <div style={{ width: `${seg.late}%`,   background: 'var(--warn)',   transition: 'width 1s cubic-bezier(.16,1,.3,1)' }} />}
          {seg.absent > 0 && <div style={{ width: `${seg.absent}%`, background: 'var(--danger)', transition: 'width 1s cubic-bezier(.16,1,.3,1)' }} />}
        </div>
        <div style={{ display: 'flex', gap: 16, marginTop: 10, flexWrap: 'wrap' }}>
          {[
            { label: 'วิทยาลัย', color: 'var(--ok)' },
            { label: 'WFH',      color: 'var(--blue)' },
            { label: 'สาย',      color: 'var(--warn)' },
            { label: 'ขาด',      color: 'var(--danger)' },
          ].map(l => (
            <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 7, height: 7, borderRadius: 2, background: l.color }} />
              <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{l.label}</span>
            </div>
          ))}
          <div style={{ marginLeft: 'auto', fontSize: 11.5, color: 'var(--text-muted)' }}>
            ครูทั้งหมด {total} คน
          </div>
        </div>
      </div>

      {/* ── Grouped Status Cards ─────────────────────────────── */}
      <div className="animate-fade-up-d2" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        {groups.map(group => (
          <div key={group.key}>

            {/* Group header */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12,
            }}>
              <div style={{
                width: 10, height: 10, borderRadius: 3,
                background: group.color, flexShrink: 0,
              }} />
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
                {group.label}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{group.sublabel}</div>
              <div style={{
                marginLeft: 'auto',
                padding: '2px 10px', borderRadius: 99,
                background: group.dimColor, border: `1px solid ${group.borderColor}`,
                fontSize: 12, fontWeight: 700, color: group.textColor,
              }}>
                {group.rows.length} คน
              </div>
            </div>

            {/* Cards grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))',
              gap: 10,
            }}>
              {group.rows.map(row => {
                const checkIn  = row.record?.check_in_at
                  ? new Date(row.record.check_in_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', hour12: false })
                  : null
                const checkOut = row.record?.check_out_at
                  ? new Date(row.record.check_out_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', hour12: false })
                  : null

                return (
                  <div key={row.user.id} style={{
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--line)',
                    borderLeft: `3px solid ${group.color}`,
                    borderRadius: 10,
                    padding: '14px 16px',
                    display: 'flex', flexDirection: 'column', gap: 10,
                    boxShadow: '0 1px 3px rgba(30,36,51,.04)',
                  }}>

                    {/* Avatar + Name */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{
                        width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
                        background: group.dimColor, border: `1.5px solid ${group.borderColor}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 11, fontWeight: 700, color: group.textColor,
                      }}>
                        {row.user.full_name_th.slice(0, 2)}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{
                          fontSize: 13, fontWeight: 600, color: 'var(--text-primary)',
                          lineHeight: 1.35, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {row.user.full_name_th}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>
                          {row.user.department ?? '—'}
                        </div>
                      </div>
                    </div>

                    {/* Divider */}
                    <div style={{ height: 1, background: 'var(--line)' }} />

                    {/* Status + Location row */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Chip variant={chipVariant[row.effectiveStatus]} label={chipLabel[row.effectiveStatus]} />
                      <LocBadge mode={row.record?.location_mode ?? null} />
                    </div>

                    {/* Times */}
                    <div style={{ display: 'flex', gap: 10 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 2 }}>
                          เช็คอิน
                        </div>
                        <div style={{
                          fontSize: 14, fontWeight: 600, fontVariantNumeric: 'tabular-nums',
                          color: checkIn ? 'var(--text-primary)' : 'var(--text-dim)',
                        }}>
                          {checkIn ? `${checkIn} น.` : '—'}
                        </div>
                      </div>
                      <div style={{ width: 1, background: 'var(--line)', flexShrink: 0 }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 2 }}>
                          เช็คเอาท์
                        </div>
                        <div style={{
                          fontSize: 14, fontWeight: 600, fontVariantNumeric: 'tabular-nums',
                          color: checkOut ? 'var(--text-secondary)' : 'var(--text-dim)',
                        }}>
                          {checkOut ? `${checkOut} น.` : '—'}
                        </div>
                      </div>
                    </div>

                  </div>
                )
              })}
            </div>
          </div>
        ))}

        {/* All teachers absent edge-case */}
        {rows.length === 0 && (
          <div style={{
            background: 'var(--bg-surface)', border: '1px solid var(--line)',
            borderRadius: 12, padding: '48px 20px', textAlign: 'center',
          }}>
            <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>ยังไม่มีข้อมูลครู</div>
          </div>
        )}
      </div>

    </AppShell>
  )
}
