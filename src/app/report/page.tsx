import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import * as db from '@/lib/db'
import { format, startOfMonth, endOfMonth, differenceInCalendarDays, parseISO } from 'date-fns'
import { todayDate } from '@/lib/attendance'
import { AppShell } from '@/components/layout/AppShell'
import { MonthNav } from './MonthNav'
import { ReportTable } from './ReportTable'

export const dynamic   = 'force-dynamic'
export const revalidate = 0

interface Props {
  searchParams: { from?: string; to?: string }
}

export default async function ReportPage({ searchParams }: Props) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'admin') redirect('/checkin')

  const now = parseISO(todayDate())

  const from = searchParams.from ?? format(startOfMonth(now), 'yyyy-MM-dd')
  const to   = searchParams.to   ?? format(endOfMonth(now),   'yyyy-MM-dd')

  const fromDate    = parseISO(from)
  const toDate      = parseISO(to)
  const daysInRange = differenceInCalendarDays(toDate, fromDate) + 1

  const rangeLabel = from === to
    ? fromDate.toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok', day: 'numeric', month: 'long', year: 'numeric' })
    : `${fromDate.toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short', year: 'numeric' })} – ${toDate.toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short', year: 'numeric' })}`

  const users   = await db.listActiveTeachers()
  const records = await db.getAttendanceForReport(users.map(u => u.id), from, to)

  /* ── Per-user summary ──────────────────────────────────────── */
  const summaries = users.map(u => {
    const recs   = records.filter(r => r.user_id === u.id)
    const campus = recs.filter(r => r.location_mode === 'campus' && r.check_in_at).length
    const wfh    = recs.filter(r => r.location_mode === 'wfh'    && r.check_in_at).length
    const worked = campus + wfh
    const rate   = Math.round(worked / daysInRange * 100)
    return { user: u, campus, wfh, worked, rate }
  })

  /* ── Aggregates ────────────────────────────────────────────── */
  const agg = summaries.reduce(
    (a, s) => { a.campus += s.campus; a.wfh += s.wfh; a.worked += s.worked; return a },
    { campus: 0, wfh: 0, worked: 0 }
  )
  const teacherCount = summaries.length
  const avgRate = teacherCount
    ? Math.round(summaries.reduce((a, s) => a + s.rate, 0) / teacherCount)
    : 0

  return (
    <AppShell>

      {/* ── Page Header ──────────────────────────────────────── */}
      <div className="animate-fade-up" style={{
        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
        marginBottom: 24, gap: 16, flexWrap: 'wrap',
      }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 500, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 6 }}>
            รายงาน
          </div>
          <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-.01em', lineHeight: 1.2, marginBottom: 4 }}>
            ภาพรวมประจำเดือน
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            {rangeLabel} · {daysInRange} วัน
          </div>
        </div>

        <MonthNav from={from} />
      </div>

      {/* ── Aggregate Cards ─────────────────────────────────── */}
      <div className="animate-fade-up-d1" style={{
        display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 20,
      }}>
        {[
          { label: 'วิทยาลัย (ครั้ง)',       value: agg.campus,    sub: 'รวมทุกคน', color: 'var(--ok)',   textColor: 'var(--ok-text)'   },
          { label: 'Work From Home (ครั้ง)', value: agg.wfh,       sub: 'รวมทุกคน', color: 'var(--blue)', textColor: 'var(--blue-text)' },
          { label: 'อัตราเฉลี่ย',            value: `${avgRate}%`, sub: `จาก ${teacherCount} คน`,
            color:     avgRate >= 80 ? 'var(--ok)'     : avgRate >= 60 ? 'var(--warn)'     : 'var(--danger)',
            textColor: avgRate >= 80 ? 'var(--ok-text)': avgRate >= 60 ? 'var(--warn-text)': 'var(--danger-text)' },
        ].map(k => (
          <div key={k.label} style={{
            background: 'var(--bg-surface)', border: '1px solid var(--line)',
            borderRadius: 12, padding: '16px 18px', position: 'relative', overflow: 'hidden',
            boxShadow: '0 1px 4px rgba(30,36,51,.05)',
          }}>
            <div style={{ fontSize: 11.5, color: 'var(--text-muted)', fontWeight: 500, marginBottom: 8 }}>{k.label}</div>
            <div style={{ fontSize: 30, fontWeight: 700, color: k.textColor, lineHeight: 1, marginBottom: 4 }}>{k.value}</div>
            <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{k.sub}</div>
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, background: k.color, opacity: .65 }} />
          </div>
        ))}
      </div>

      {/* ── Teacher Table (client — has search) ──────────────── */}
      <div className="animate-fade-up-d2">
        <ReportTable summaries={summaries} daysInRange={daysInRange} rangeLabel={rangeLabel} from={from} to={to} />
      </div>

    </AppShell>
  )
}
