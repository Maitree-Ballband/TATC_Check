// ── Chip ─────────────────────────────────────────────────────
type ChipVariant = 'ok' | 'warn' | 'danger' | 'neutral' | 'blue'

const chipStyles: Record<ChipVariant, React.CSSProperties> = {
  ok:      { background: 'var(--ok-dim)',      color: 'var(--ok-text)',       border: '1px solid rgba(22,163,74,.2)'   },
  warn:    { background: 'var(--warn-dim)',     color: 'var(--warn-text)',     border: '1px solid rgba(217,119,6,.2)'   },
  danger:  { background: 'var(--danger-dim)',   color: 'var(--danger-text)',   border: '1px solid rgba(220,38,38,.2)'   },
  neutral: { background: 'var(--neutral-dim)',  color: 'var(--text-secondary)', border: '1px solid var(--line)'         },
  blue:    { background: 'var(--blue-dim)',      color: 'var(--blue-text)',     border: '1px solid rgba(37,99,235,.2)'  },
}
const dotColor: Record<ChipVariant, string> = {
  ok: 'var(--ok)', warn: 'var(--warn)', danger: 'var(--danger)', neutral: 'var(--neutral)', blue: 'var(--blue)',
}

export function Chip({ variant, label }: { variant: ChipVariant; label: string }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '5px 12px', borderRadius: 99,
      fontSize: 14, fontWeight: 600, fontFamily: "'Sarabun', sans-serif",
      whiteSpace: 'nowrap',
      ...chipStyles[variant],
    }}>
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: dotColor[variant], flexShrink: 0 }} />
      {label}
    </span>
  )
}

// ── Location badge ─────────────────────────────────────────────
export function LocBadge({ mode }: { mode: 'campus' | 'wfh' | null }) {
  if (mode === 'campus') return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 12px', borderRadius: 4, fontSize: 14, fontFamily: "'Sarabun', sans-serif", fontWeight: 600, background: 'var(--ok-dim)', color: 'var(--ok-text)', border: '1px solid rgba(22,163,74,.2)' }}>
      วิทยาลัย
    </span>
  )
  if (mode === 'wfh') return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 12px', borderRadius: 4, fontSize: 14, fontFamily: "'Sarabun', sans-serif", fontWeight: 600, background: 'var(--blue-dim)', color: 'var(--blue-text)', border: '1px solid rgba(37,99,235,.2)' }}>
      WFH
    </span>
  )
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 12px', borderRadius: 4, fontSize: 14, fontFamily: "'Sarabun', sans-serif", fontWeight: 600, background: 'var(--neutral-dim)', color: 'var(--text-dim)', border: '1px solid var(--line)' }}>
      —
    </span>
  )
}

// ── Stat card ─────────────────────────────────────────────────
type StatVariant = 'ok' | 'warn' | 'danger' | 'neutral' | 'blue'
const statNumColor: Record<StatVariant, string> = {
  ok: 'var(--ok-text)', warn: 'var(--warn-text)', danger: 'var(--danger-text)',
  neutral: 'var(--text-secondary)', blue: 'var(--blue-text)',
}
const statBarColor: Record<StatVariant, string> = {
  ok: 'var(--ok)', warn: 'var(--warn)', danger: 'var(--danger)',
  neutral: 'var(--neutral)', blue: 'var(--blue)',
}

export function StatCard({ variant, label, value, sub, pct }: {
  variant: StatVariant; label: string; value: number; sub: string; pct: number
}) {
  return (
    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--line)', borderRadius: 12, padding: '20px 22px', position: 'relative', overflow: 'hidden' }}>
      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '.03em', fontFamily: "'Sarabun', sans-serif", marginBottom: 10 }}>{label}</div>
      <div style={{ fontSize: 40, fontWeight: 700, letterSpacing: '-.03em', lineHeight: 1, marginBottom: 6, color: statNumColor[variant], fontFamily: "'Sarabun', sans-serif" }}>{value}</div>
      <div style={{ fontSize: 15, color: 'var(--text-muted)', fontFamily: "'Sarabun', sans-serif" }}>{sub}</div>
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, background: 'var(--line)' }}>
        <div style={{ height: '100%', width: `${Math.min(pct, 100)}%`, background: statBarColor[variant], borderRadius: '0 99px 99px 0', transition: 'width .8s cubic-bezier(.16,1,.3,1)' }} />
      </div>
    </div>
  )
}

// ── Panel ─────────────────────────────────────────────────────
export function Panel({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--line)', borderRadius: 12, overflow: 'hidden', ...style }}>
      {children}
    </div>
  )
}

export function PanelHeader({ title, meta }: { title: string; meta?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid var(--line)', gap: 10 }}>
      <span style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', flex: 1, fontFamily: "'Sarabun', sans-serif" }}>{title}</span>
      {meta && <span style={{ fontSize: 14, fontFamily: "'Sarabun', sans-serif", color: 'var(--text-muted)' }}>{meta}</span>}
    </div>
  )
}

// ── Live pulse dot ────────────────────────────────────────────
export function LiveDot({ label = 'Live' }: { label?: string }) {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 13, fontFamily: "'Sarabun', sans-serif", color: 'var(--text-muted)', letterSpacing: '.03em' }}>
      <span style={{ position: 'relative', display: 'inline-block', width: 8, height: 8 }}>
        <span style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'var(--ok)' }} />
        <span style={{ position: 'absolute', inset: -3, borderRadius: '50%', background: 'var(--ok)', opacity: 0.3, animation: 'pulse 2s ease infinite' }} />
      </span>
      {label}
    </div>
  )
}

// ── Toast ─────────────────────────────────────────────────────
// Used via useToast hook — rendered in AppShell
export type ToastType = 'ok' | 'warn' | 'danger' | 'blue'
