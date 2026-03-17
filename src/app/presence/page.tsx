import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase'
import { todayDate } from '@/lib/attendance'
import { AppShell } from '@/components/layout/AppShell'
import { Chip, LocBadge, Panel } from '@/components/ui'

export const dynamic   = 'force-dynamic'
export const revalidate = 0

export default async function PresencePage() {
  const session = await getServerSession(authOptions)
  if (!session) return null

  const db   = createServerClient()
  const date = todayDate()

  const { data: users } = await db
    .from('users').select('id, full_name_th, department')
    .eq('is_active', true).eq('role', 'teacher').order('full_name_th')

  const { data: records } = await db
    .from('attendance_records').select('*').eq('date', date)
    .in('user_id', (users ?? []).map(u => u.id))

  const recMap = Object.fromEntries((records ?? []).map(r => [r.user_id, r]))

  const rows = (users ?? []).map(u => {
    const r  = recMap[u.id] ?? null
    const es = r?.check_in_at ? (r.location_mode === 'wfh' ? 'wfh' : r.status) : 'absent'
    return { user: u, record: r, effectiveStatus: es }
  })

  const counts = rows.reduce(
    (a, r) => {
      if (r.effectiveStatus === 'wfh')          a.wfh++
      else if (r.effectiveStatus === 'present')  a.campus++
      else if (r.effectiveStatus === 'late')     a.late++
      else                                       a.absent++
      return a
    },
    { campus: 0, wfh: 0, late: 0, absent: 0 }
  )

  const borderColor: Record<string, string> = {
    present: 'var(--ok)', late: 'var(--warn)', absent: 'var(--danger)', wfh: 'var(--blue)',
  }

  const pills = [
    { label: 'วิทยาลัย', n: counts.campus, color: 'var(--ok)' },
    { label: 'WFH',       n: counts.wfh,    color: 'var(--blue)' },
    { label: 'สาย',       n: counts.late,   color: 'var(--warn)' },
    { label: 'ยังไม่มา',  n: counts.absent, color: 'var(--danger)' },
  ]

  return (
    <AppShell>
      {/* Header */}
      <div className="animate-fade-up" style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 22 }}>
        <div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 4 }}>
            สถานะครูทั้งหมด · {new Date().toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' })}
          </div>
          <div style={{ fontSize: 22, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-.02em' }}>กระดานสถานะปัจจุบัน</div>
        </div>
      </div>

      {/* Summary pills */}
      <div className="animate-fade-up-d1" style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {pills.map(p => (
          <div key={p.label} style={{ background: 'var(--bg-surface)', border: '1px solid var(--line)', borderRadius: 8, padding: '7px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: p.color, flexShrink: 0 }} />
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{p.label}</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 600, color: p.color }}>{p.n}</span>
          </div>
        ))}
      </div>

      {/* Grid */}
      <div className="animate-fade-up-d2">
        <Panel>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(176px, 1fr))', gap: 10, padding: 16 }}>
            {rows.map(row => (
              <div key={row.user.id} style={{
                background: 'var(--bg-raised)', borderRadius: 8,
                border: '1px solid var(--line)',
                borderLeft: `2px solid ${borderColor[row.effectiveStatus] ?? 'var(--neutral)'}`,
                padding: 14, display: 'flex', flexDirection: 'column', gap: 8, cursor: 'default',
              }}>
                {/* Name */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--bg-active)', border: '1px solid var(--line-mid)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', flexShrink: 0 }}>
                    {row.user.full_name_th.slice(0, 2)}
                  </div>
                  <div>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.3 }}>{row.user.full_name_th}</div>
                    <div style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>{row.user.department ?? '—'}</div>
                  </div>
                </div>

                {/* Status + location */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  {row.effectiveStatus === 'wfh'     && <Chip variant="blue"   label="WFH"       />}
                  {row.effectiveStatus === 'present'  && <Chip variant="ok"     label="ปกติ"      />}
                  {row.effectiveStatus === 'late'     && <Chip variant="warn"   label="สาย"       />}
                  {row.effectiveStatus === 'absent'   && <Chip variant="danger" label="ยังไม่มา"  />}
                  <LocBadge mode={row.record?.location_mode ?? null} />
                </div>

                {/* Time */}
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: row.record?.check_in_at ? 'var(--text-secondary)' : 'var(--text-muted)' }}>
                  {row.record?.check_in_at
                    ? 'เช็คอิน ' + new Date(row.record.check_in_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', hour12: false })
                    : 'ยังไม่เช็คอิน'}
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </AppShell>
  )
}
