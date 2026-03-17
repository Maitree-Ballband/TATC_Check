import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase'
import { todayDate } from '@/lib/attendance'
import { AppShell } from '@/components/layout/AppShell'
import { Chip, LocBadge, StatCard, Panel, PanelHeader } from '@/components/ui'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'admin') redirect('/checkin')

  const db   = createServerClient()
  const date = todayDate()

  const { data: users } = await db
    .from('users').select('id, full_name_th, department, avatar_url')
    .eq('is_active', true).eq('role', 'teacher').order('full_name_th')

  const { data: records } = await db
    .from('attendance_records').select('*')
    .eq('date', date)
    .in('user_id', (users ?? []).map(u => u.id))

  const recMap = Object.fromEntries((records ?? []).map(r => [r.user_id, r]))

  const rows = (users ?? []).map(u => {
    const r  = recMap[u.id] ?? null
    const es = r?.check_in_at
      ? (r.location_mode === 'wfh' ? 'wfh' : r.status)
      : 'absent'
    return { user: u, record: r, effectiveStatus: es }
  })

  const stats = rows.reduce(
    (a, r) => {
      if (r.effectiveStatus === 'wfh')      a.wfh++
      else if (r.effectiveStatus === 'present') a.campus++
      else if (r.effectiveStatus === 'late')    a.late++
      else                                      a.absent++
      return a
    },
    { campus: 0, wfh: 0, late: 0, absent: 0 }
  )
  const total = rows.length

  const recentLogs = (records ?? [])
    .filter(r => r.check_in_at)
    .sort((a, b) => new Date(b.check_in_at!).getTime() - new Date(a.check_in_at!).getTime())
    .slice(0, 6)

  const logType = (r: typeof records[0]) => {
    if (!r) return 'neutral'
    if (r.location_mode === 'wfh') return 'blue'
    if (r.status === 'late')       return 'warn'
    return 'ok'
  }

  const dotColor: Record<string, string> = {
    ok: 'var(--ok)', warn: 'var(--warn)', blue: 'var(--blue)', neutral: 'var(--text-dim)',
  }

  return (
    <AppShell>
      {/* Header */}
      <div className="animate-fade-up" style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 22 }}>
        <div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 4 }}>
            {new Date().toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </div>
          <div style={{ fontSize: 22, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-.02em' }}>ภาพรวมการเข้างานวันนี้</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 7px', borderRadius: 4, fontSize: 10.5, fontFamily: 'var(--font-mono)', background: 'var(--bg-active)', color: 'var(--text-muted)', border: '1px solid var(--line)' }}>Live</span>
        </div>
      </div>

      {/* Stat cards */}
      <div className="animate-fade-up-d1" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 16 }}>
        <StatCard variant="ok"      label="มา (วิทยาลัย)" value={stats.campus} sub={`จาก ${total} คน`}  pct={total ? stats.campus / total * 100 : 0} />
        <StatCard variant="blue"    label="WFH"           value={stats.wfh}    sub="ยืนยันแล้ว"         pct={total ? stats.wfh / total * 100 : 0}    />
        <StatCard variant="warn"    label="สาย"           value={stats.late}   sub="เกิน 08:30 น."      pct={total ? stats.late / total * 100 : 0}   />
        <StatCard variant="danger"  label="ยังไม่มา"      value={stats.absent} sub="ณ เวลานี้"          pct={total ? stats.absent / total * 100 : 0} />
      </div>

      {/* Progress bars */}
      <div className="animate-fade-up-d1" style={{ background: 'var(--bg-surface)', border: '1px solid var(--line)', borderRadius: 12, padding: '16px 18px', marginBottom: 14 }}>
        {[
          { label: 'อัตราการเข้างานวันนี้ (วิทยาลัย + WFH)', val: total ? Math.round((stats.campus + stats.wfh) / total * 100) : 0, color: 'var(--ok)' },
          { label: 'ยังไม่เช็คอิน', val: total ? Math.round(stats.absent / total * 100) : 0, color: 'var(--danger)' },
        ].map((b, i) => (
          <div key={b.label} style={{ marginBottom: i === 0 ? 10 : 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{b.label}</span>
              <span style={{ fontSize: 11.5, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>{b.val}%</span>
            </div>
            <div style={{ height: 4, background: 'var(--line)', borderRadius: 99, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${b.val}%`, background: b.color, borderRadius: 99, transition: 'width 1s cubic-bezier(.16,1,.3,1)' }} />
            </div>
          </div>
        ))}
      </div>

      {/* Table + log */}
      <div className="animate-fade-up-d2" style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 14, alignItems: 'start' }}>
        {/* Teacher table */}
        <Panel>
          <PanelHeader title="รายชื่อครูวันนี้" meta={`${rows.length} คน`} />
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>{['ครู', 'สถานที่', 'เช็คอิน', 'เช็คเอาท์', 'สถานะ'].map(h => (
                  <th key={h} style={{ padding: '9px 16px', fontSize: 10.5, fontWeight: 500, color: 'var(--text-muted)', textAlign: 'left', letterSpacing: '.08em', textTransform: 'uppercase', fontFamily: 'var(--font-mono)', borderBottom: '1px solid var(--line)', whiteSpace: 'nowrap' }}>{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={row.user.id} style={{ borderBottom: '1px solid var(--line)', background: i % 2 === 0 ? 'transparent' : 'transparent' }}>
                    <td style={{ padding: '10px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--bg-active)', border: '1px solid var(--line-mid)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 600, color: 'var(--text-secondary)', flexShrink: 0 }}>
                          {row.user.full_name_th.slice(0, 2)}
                        </div>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{row.user.full_name_th}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{row.user.department ?? '—'}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '10px 16px' }}><LocBadge mode={row.record?.location_mode ?? null} /></td>
                    <td style={{ padding: '10px 16px', fontFamily: 'var(--font-mono)', fontSize: 12.5, color: row.record?.check_in_at ? 'var(--text-secondary)' : 'var(--text-dim)' }}>
                      {row.record?.check_in_at ? new Date(row.record.check_in_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', hour12: false }) : '—'}
                    </td>
                    <td style={{ padding: '10px 16px', fontFamily: 'var(--font-mono)', fontSize: 12.5, color: 'var(--text-dim)' }}>
                      {row.record?.check_out_at ? new Date(row.record.check_out_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', hour12: false }) : '—'}
                    </td>
                    <td style={{ padding: '10px 16px' }}>
                      {row.effectiveStatus === 'wfh'     && <Chip variant="blue"   label="WFH"       />}
                      {row.effectiveStatus === 'present'  && <Chip variant="ok"     label="ปกติ"      />}
                      {row.effectiveStatus === 'late'     && <Chip variant="warn"   label="สาย"       />}
                      {row.effectiveStatus === 'absent'   && <Chip variant="danger" label="ยังไม่มา"  />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        {/* Activity log */}
        <Panel>
          <PanelHeader title="กิจกรรมล่าสุด" meta="วันนี้" />
          {recentLogs.map((r, i) => {
            const user = (users ?? []).find(u => u.id === r.user_id)
            const type = logType(r)
            return (
              <div key={r.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '11px 16px', borderBottom: i < recentLogs.length - 1 ? '1px solid var(--line)' : 'none' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, flexShrink: 0, paddingTop: 4 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', border: `1.5px solid ${dotColor[type]}`, flexShrink: 0 }} />
                  {i < recentLogs.length - 1 && <span style={{ width: 1, flex: 1, background: 'var(--line)', minHeight: 14 }} />}
                </div>
                <div>
                  <div style={{ fontSize: 12.5, color: 'var(--text-primary)', lineHeight: 1.4 }}>
                    <strong>{user?.full_name_th ?? '—'}</strong>
                    {' '}เช็คอิน — {r.location_mode === 'wfh' ? 'WFH' : 'วิทยาลัย'}
                    {r.status === 'late' && ' (สาย)'}
                  </div>
                  <div style={{ fontSize: 10.5, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', marginTop: 2 }}>
                    {new Date(r.check_in_at!).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', hour12: false })} น.
                  </div>
                </div>
              </div>
            )
          })}
          {recentLogs.length === 0 && (
            <div style={{ padding: '20px 16px', textAlign: 'center', fontSize: 12, color: 'var(--text-muted)' }}>ยังไม่มีกิจกรรม</div>
          )}
        </Panel>
      </div>
    </AppShell>
  )
}
