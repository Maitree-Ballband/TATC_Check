import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import * as db from '@/lib/db'
import { format, startOfMonth, endOfMonth, differenceInCalendarDays, parseISO } from 'date-fns'
import { todayDate } from '@/lib/attendance'
import { AppShell } from '@/components/layout/AppShell'
import { Chip } from '@/components/ui'
import { ReportControls } from './ReportControls'

export const dynamic   = 'force-dynamic'
export const revalidate = 0

interface Props {
  searchParams: { from?: string; to?: string }
}

export default async function ReportPage({ searchParams }: Props) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'admin') redirect('/checkin')

  const now = parseISO(todayDate())   // Bangkok's today, timezone-safe

  // Resolve date range — default to current month
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
    const late   = recs.filter(r => r.check_in_at && r.status === 'late').length
    const worked = campus + wfh
    const rate   = Math.round(worked / daysInRange * 100)
    return { user: u, campus, wfh, late, worked, rate }
  })

  /* ── Aggregates ────────────────────────────────────────────── */
  const agg = summaries.reduce(
    (a, s) => { a.campus += s.campus; a.wfh += s.wfh; a.late += s.late; a.worked += s.worked; return a },
    { campus: 0, wfh: 0, late: 0, worked: 0 }
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
            สรุปการเข้างาน
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            {rangeLabel} · {daysInRange} วัน
          </div>
        </div>

        {/* Date range picker + export */}
        <ReportControls from={from} to={to} />
      </div>

      {/* ── Aggregate Summary ───────────────────────────────── */}
      <div className="animate-fade-up-d1" style={{
        display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 20,
      }}>
        {[
          { label: 'วิทยาลัย (ครั้ง)',       value: agg.campus,    sub: 'รวมทุกคน', color: 'var(--ok)',     textColor: 'var(--ok-text)'     },
          { label: 'Work From Home (ครั้ง)', value: agg.wfh,       sub: 'รวมทุกคน', color: 'var(--blue)',   textColor: 'var(--blue-text)'   },
          { label: 'มาสาย (ครั้ง)',          value: agg.late,      sub: 'Campus + WFH', color: 'var(--warn)', textColor: 'var(--warn-text)'  },
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

      {/* ── Teacher Table ───────────────────────────────────── */}
      <div className="animate-fade-up-d2" style={{
        background: 'var(--bg-surface)', border: '1px solid var(--line)',
        borderRadius: 12, overflow: 'hidden',
        boxShadow: '0 1px 4px rgba(30,36,51,.05)',
      }}>
        <div style={{
          padding: '14px 20px', borderBottom: '1px solid var(--line)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
            {rangeLabel}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
              *อัตราเทียบจาก {daysInRange} วันปฏิทิน
            </span>
            <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: 'var(--bg-active)', color: 'var(--text-muted)', border: '1px solid var(--line)' }}>
              {teacherCount} คน
            </span>
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
                  { label: 'สาย',      align: 'right'  },
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
              {summaries.map((s, i) => (
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
                    <span style={{ fontSize: 14, fontWeight: 600, color: s.late > 0 ? 'var(--warn-text)' : 'var(--text-dim)' }}>{s.late}</span>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 3 }}>ครั้ง</span>
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

              {summaries.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ padding: '32px', textAlign: 'center', fontSize: 13, color: 'var(--text-muted)' }}>
                    ไม่มีข้อมูลในช่วงเวลาที่เลือก
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div style={{ padding: '10px 20px', borderTop: '1px solid var(--line)', background: 'var(--bg-raised)' }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            หมายเหตุ: <strong>สาย</strong> นับจากเช็คอินหลัง 08:00 น. รวม Campus และ WFH ·
            <strong> อัตรา</strong> เทียบจากวันปฏิทินทั้งหมดในช่วงที่เลือก (รวมวันหยุด)
          </div>
        </div>
      </div>

    </AppShell>
  )
}
