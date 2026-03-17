import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase'
import { format, startOfMonth, endOfMonth } from 'date-fns'
import { AppShell } from '@/components/layout/AppShell'
import { Chip, Panel, PanelHeader } from '@/components/ui'

export const dynamic   = 'force-dynamic'
export const revalidate = 0

export default async function ReportPage() {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'admin') redirect('/checkin')

  const db   = createServerClient()
  const now  = new Date()
  const from = format(startOfMonth(now), 'yyyy-MM-dd')
  const to   = format(endOfMonth(now),   'yyyy-MM-dd')

  const { data: users } = await db
    .from('users').select('id, full_name_th, department')
    .eq('is_active', true).eq('role', 'teacher').order('full_name_th')

  const { data: records } = await db
    .from('attendance_records').select('*')
    .gte('date', from).lte('date', to)
    .in('user_id', (users ?? []).map(u => u.id))

  // Build per-user summary
  const summaries = (users ?? []).map(u => {
    const recs = (records ?? []).filter(r => r.user_id === u.id)
    const campus  = recs.filter(r => r.location_mode === 'campus' && r.check_in_at).length
    const wfh     = recs.filter(r => r.location_mode === 'wfh'    && r.check_in_at).length
    const late    = recs.filter(r => r.status === 'late').length
    const absent  = recs.filter(r => r.status === 'absent' && !r.check_in_at).length
    const worked  = campus + wfh
    const total   = recs.length || 1
    const rate    = Math.round(worked / total * 100)
    return { user: u, campus, wfh, late, absent, worked, total: recs.length, rate }
  })

  return (
    <AppShell>
      {/* Header */}
      <div className="animate-fade-up" style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 22 }}>
        <div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 4 }}>รายงาน</div>
          <div style={{ fontSize: 22, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-.02em' }}>สรุปการเข้างานรายเดือน</div>
        </div>
        <a href={`/api/admin/export?from=${from}&to=${to}`} style={{ textDecoration: 'none' }}>
          <button style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 8, fontSize: 12.5, fontWeight: 500, cursor: 'pointer', background: 'transparent', color: 'var(--text-secondary)', border: '1px solid var(--line-mid)', fontFamily: 'var(--font-sans)' }}>
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M6.5 1v8M3.5 6l3 3 3-3M1 10v1.5A1.5 1.5 0 002.5 13h8a1.5 1.5 0 001.5-1.5V10"/>
            </svg>
            Export .xlsx
          </button>
        </a>
      </div>

      {/* Filter strip */}
      <div className="animate-fade-up-d1" style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--line)', borderRadius: 8, padding: '6px 14px', fontSize: 12.5, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
          {format(now, 'MMMM yyyy')} · {from} → {to}
        </div>
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--line)', borderRadius: 8, padding: '6px 14px', fontSize: 12.5, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
          {users?.length ?? 0} คน
        </div>
      </div>

      {/* Table */}
      <div className="animate-fade-up-d2">
        <Panel>
          <PanelHeader title={`รายงานเดือน ${format(now, 'MMMM yyyy')}`} meta={`${summaries.length} รายการ`} />
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['ครู', 'วันทำงาน', 'วิทยาลัย', 'WFH', 'สาย', 'ขาด', 'อัตรา'].map(h => (
                    <th key={h} style={{ padding: '9px 16px', fontSize: 10.5, fontWeight: 500, color: 'var(--text-muted)', textAlign: 'left', letterSpacing: '.08em', textTransform: 'uppercase', fontFamily: 'var(--font-mono)', borderBottom: '1px solid var(--line)', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {summaries.map((s, i) => (
                  <tr key={s.user.id} style={{ borderBottom: '1px solid var(--line)', background: i % 2 === 1 ? 'rgba(255,255,255,.01)' : 'transparent' }}>
                    <td style={{ padding: '10px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--bg-active)', border: '1px solid var(--line-mid)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 600, color: 'var(--text-secondary)', flexShrink: 0 }}>
                          {s.user.full_name_th.slice(0, 2)}
                        </div>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{s.user.full_name_th}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{s.user.department ?? '—'}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '10px 16px', fontFamily: 'var(--font-mono)', fontSize: 12.5, color: 'var(--text-secondary)' }}>{s.total}</td>
                    <td style={{ padding: '10px 16px', fontFamily: 'var(--font-mono)', fontSize: 12.5, color: 'var(--ok-text)' }}>{s.campus}</td>
                    <td style={{ padding: '10px 16px', fontFamily: 'var(--font-mono)', fontSize: 12.5, color: 'var(--blue-text)' }}>{s.wfh}</td>
                    <td style={{ padding: '10px 16px', fontFamily: 'var(--font-mono)', fontSize: 12.5, color: 'var(--warn-text)' }}>{s.late}</td>
                    <td style={{ padding: '10px 16px', fontFamily: 'var(--font-mono)', fontSize: 12.5, color: 'var(--danger-text)' }}>{s.absent}</td>
                    <td style={{ padding: '10px 16px' }}>
                      <Chip variant={s.rate >= 90 ? 'ok' : s.rate >= 75 ? 'warn' : 'danger'} label={`${s.rate}%`} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
    </AppShell>
  )
}
