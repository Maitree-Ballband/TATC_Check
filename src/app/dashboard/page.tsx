import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import * as db from '@/lib/db'
import { todayDate, isPastHardAbsentCutoff } from '@/lib/attendance'
import { AppShell } from '@/components/layout/AppShell'
import { DashboardTable, type DashRow } from './DashboardTable'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)
  if (!session || (session.user.role !== 'admin' && session.user.role !== 'executive')) redirect('/checkin')

  const date    = todayDate()
  const staff   = await db.listAllStaffForPresence()
  const registeredIds = staff.filter(s => s.is_registered).map(s => s.id)
  const records = await db.getTodayRecordsForUsers(date, registeredIds)
  const recMap  = Object.fromEntries(records.map(r => [r.user_id, r]))

  // After 16:30 with no check-in = ขาด; before 16:30 = ยังไม่มา (not yet checked in)
  const hardCutoffPassed = isPastHardAbsentCutoff()

  const rows = staff.map(s => {
    if (!s.is_registered) return { user: s, record: null, effectiveStatus: 'not_registered' }
    const r  = recMap[s.id] ?? null
    const es = r?.check_in_at
      ? (r.location_mode === 'wfh' ? (r.status === 'late' ? 'wfh_late' : 'wfh') : r.status)
      : hardCutoffPassed ? 'absent' : 'not_checked'
    return { user: s, record: r, effectiveStatus: es }
  })

  const stats = rows.reduce(
    (a, r) => {
      const es = r.effectiveStatus
      if      (es === 'present' || es === 'late')       a.campus++
      else if (es === 'wfh'    || es === 'wfh_late')    a.wfh++
      else if (es === 'absent')                          a.absent++
      else if (es !== 'not_registered')                  a.not_checked++
      if (es === 'late' || es === 'wfh_late')            a.late++
      return a
    },
    { campus: 0, wfh: 0, late: 0, absent: 0, not_checked: 0 }
  )
  const total      = rows.length
  const presentAll = stats.campus + stats.wfh   // late is a subset of campus/wfh
  const attendRate = total ? Math.round(presentAll / total * 100) : 0

  const recentLogs = records
    .filter(r => r.check_in_at)
    .sort((a, b) => new Date(b.check_in_at!).getTime() - new Date(a.check_in_at!).getTime())
    .slice(0, 8)

  const dateLabel = new Date().toLocaleDateString('th-TH', {
    timeZone: 'Asia/Bangkok', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })

  // Combined "no check-in" for display
  const notPresentCount = hardCutoffPassed ? stats.absent : stats.not_checked


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
            padding: '5px 11px', borderRadius: 8,
            background: attendRate >= 80 ? 'var(--ok-dim)' : attendRate >= 50 ? 'var(--warn-dim)' : 'var(--danger-dim)',
            border: `1px solid ${attendRate >= 80 ? 'rgba(22,163,74,.2)' : attendRate >= 50 ? 'rgba(217,119,6,.2)' : 'rgba(220,38,38,.2)'}`,
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1,
          }}>
            <div style={{ fontSize: 17, fontWeight: 700, lineHeight: 1, color: attendRate >= 80 ? 'var(--ok-text)' : attendRate >= 50 ? 'var(--warn-text)' : 'var(--danger-text)' }}>
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
      <div className="animate-fade-up-d1 dash-kpi-grid" style={{ marginBottom: 16 }}>
        {[
          { label: 'มา (วิทยาลัย)', value: stats.campus,      sub: `${total ? Math.round(stats.campus/total*100) : 0}% ของทั้งหมด`, color: 'var(--ok)',      dimColor: 'var(--ok-dim)',      textColor: 'var(--ok-text)' },
          { label: 'Work From Home', value: stats.wfh,         sub: `${total ? Math.round(stats.wfh/total*100)    : 0}% ของทั้งหมด`, color: 'var(--blue)',    dimColor: 'var(--blue-dim)',    textColor: 'var(--blue-text)' },
          { label: 'มาสาย',          value: stats.late,        sub: `เกินเวลา ${process.env.NEXT_PUBLIC_CHECKIN_CUTOFF ?? '08:00'} น.`, color: 'var(--warn)',    dimColor: 'var(--warn-dim)',    textColor: 'var(--warn-text)' },
          {
            label: hardCutoffPassed ? 'ขาด' : 'ยังไม่มา',
            value: notPresentCount,
            sub:   hardCutoffPassed ? 'เกินเวลา ไม่มีการลงชื่อ' : 'ยังไม่ได้ลงชื่อ',
            color:     hardCutoffPassed ? 'var(--danger)' : 'var(--neutral)',
            dimColor:  hardCutoffPassed ? 'var(--danger-dim)' : 'var(--neutral-dim)',
            textColor: hardCutoffPassed ? 'var(--danger-text)' : 'var(--text-muted)',
          },
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

      {/* ── Table + Log ──────────────────────────────────────────── */}
      <div className="animate-fade-up-d2 dash-layout-grid">

        {/* Teacher Table */}
        <DashboardTable rows={rows.map((row): DashRow => ({
          userId:               row.user.id,
          name:                 row.user.full_name_th,
          dept:                 row.user.department ?? null,
          avatarUrl:            row.user.avatar_url ?? null,
          checkInAt:            row.record?.check_in_at ?? null,
          checkOutAt:           row.record?.check_out_at ?? null,
          locationMode:         row.record?.location_mode ?? null,
          checkOutLocationMode: (row.record?.check_out_location_mode ?? row.record?.location_mode) ?? null,
          effectiveStatus:      row.effectiveStatus,
        }))} />

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
              const user = staff.find(u => u.id === r.user_id)
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
