import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import * as db from '@/lib/db'
import { todayDate, isPastHardAbsentCutoff } from '@/lib/attendance'
import { AppShell } from '@/components/layout/AppShell'
import { PresenceDatePicker } from './PresenceDatePicker'
import { PresenceBoard, type BoardRow } from './PresenceBoard'

export const dynamic   = 'force-dynamic'
export const revalidate = 0

interface Props {
  searchParams: { date?: string }
}

export default async function PresencePage({ searchParams }: Props) {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/auth/signin')
  if (session.user.role === 'teacher') redirect('/checkin')

  const today   = todayDate()
  const date    = searchParams.date ?? today
  const isToday = date === today

  const users   = await db.listActiveTeachers()
  const records = await db.getTodayRecordsForUsers(date, users.map(u => u.id))
  const recMap  = Object.fromEntries(records.map(r => [r.user_id, r]))

  const hardCutoffPassed = !isToday || isPastHardAbsentCutoff()

  const rows = users.map(u => {
    const r  = recMap[u.id] ?? null
    const es = r?.check_in_at
      ? (r.location_mode === 'wfh' ? (r.status === 'late' ? 'wfh_late' : 'wfh') : r.status)
      : hardCutoffPassed ? 'absent' : 'not_checked'
    return { user: u, record: r, effectiveStatus: es }
  })

  const counts = rows.reduce(
    (a, r) => {
      if      (r.effectiveStatus === 'wfh')                                     a.wfh++
      else if (r.effectiveStatus === 'present')                                  a.campus++
      else if (r.effectiveStatus === 'late' || r.effectiveStatus === 'wfh_late') a.late++
      else if (r.effectiveStatus === 'absent')                                   a.absent++
      else                                                                       a.not_checked++
      return a
    },
    { campus: 0, wfh: 0, late: 0, absent: 0, not_checked: 0 }
  )
  const notPresentCount = hardCutoffPassed ? counts.absent : counts.not_checked

  const total      = rows.length
  const presentAll = counts.campus + counts.wfh + counts.late
  const attendRate = total ? Math.round(presentAll / total * 100) : 0

  const seg = {
    campus:      total ? counts.campus      / total * 100 : 0,
    wfh:         total ? counts.wfh         / total * 100 : 0,
    late:        total ? counts.late        / total * 100 : 0,
    absent:      total ? counts.absent      / total * 100 : 0,
    not_checked: total ? counts.not_checked / total * 100 : 0,
  }

  const dateLabel = new Date(date + 'T00:00:00').toLocaleDateString('th-TH', {
    timeZone: 'Asia/Bangkok', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })

  // Serialize rows for client component (no class instances)
  const boardRows: BoardRow[] = rows.map(r => ({
    userId:          r.user.id,
    name:            r.user.full_name_th,
    dept:            r.user.department ?? null,
    effectiveStatus: r.effectiveStatus,
    locMode:         (r.record?.location_mode ?? null) as 'campus' | 'wfh' | null,
    checkIn: r.record?.check_in_at
      ? new Date(r.record.check_in_at).toLocaleTimeString('th-TH', {
          timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit', hour12: false,
        })
      : null,
    checkOut: r.record?.check_out_at
      ? new Date(r.record.check_out_at).toLocaleTimeString('th-TH', {
          timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit', hour12: false,
        })
      : null,
    lateReason: r.record?.late_reason ?? null,
    initials:   r.user.full_name_th.slice(0, 2),
  }))

  return (
    <AppShell>

      {/* ── Page Header ──────────────────────────────────────── */}
      <div className="animate-fade-up presence-header" style={{
        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
        marginBottom: 20, gap: 12, flexWrap: 'wrap',
      }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 500, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 6 }}>
            กระดานสถานะครู
          </div>
          <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-.01em', lineHeight: 1.2, marginBottom: 4 }}>
            สถานะการเข้างาน
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{dateLabel}</div>
        </div>

        <div className="presence-header-actions" style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {/* Date picker — large */}
          <PresenceDatePicker date={date} today={today} />

          {/* Attendance rate */}
          <div style={{
            padding: '10px 18px', borderRadius: 10,
            background: attendRate >= 80 ? 'var(--ok-dim)' : attendRate >= 50 ? 'var(--warn-dim)' : 'var(--danger-dim)',
            border: `1px solid ${attendRate >= 80 ? 'rgba(22,163,74,.25)' : attendRate >= 50 ? 'rgba(217,119,6,.25)' : 'rgba(220,38,38,.25)'}`,
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1,
          }}>
            <div style={{ fontSize: 24, fontWeight: 700, lineHeight: 1, color: attendRate >= 80 ? 'var(--ok-text)' : attendRate >= 50 ? 'var(--warn-text)' : 'var(--danger-text)' }}>
              {attendRate}%
            </div>
            <div style={{ fontSize: 10.5, color: 'var(--text-muted)', letterSpacing: '.05em' }}>
              {isToday ? 'เข้างานวันนี้' : 'เข้างานวันนั้น'}
            </div>
          </div>

          {/* Live / Past badge */}
          {isToday ? (
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '8px 14px', borderRadius: 8,
              background: 'var(--ok-dim)', border: '1px solid rgba(22,163,74,.2)',
              fontSize: 13, fontWeight: 700, color: 'var(--ok-text)',
            }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--ok)', boxShadow: '0 0 0 2px var(--ok-dim)' }} />
              LIVE
            </div>
          ) : (
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '8px 14px', borderRadius: 8,
              background: 'var(--bg-raised)', border: '1px solid var(--line-mid)',
              fontSize: 13, fontWeight: 600, color: 'var(--text-muted)',
            }}>
              ย้อนหลัง
            </div>
          )}
        </div>
      </div>

      {/* ── Board (client component: summary, filter, cards) ── */}
      <div className="animate-fade-up-d1">
        <PresenceBoard
          rows={boardRows}
          hardCutoffPassed={hardCutoffPassed}
          counts={counts}
          total={total}
          seg={seg}
          notPresentCount={notPresentCount}
        />
      </div>

    </AppShell>
  )
}
