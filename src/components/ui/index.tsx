import { clsx } from 'clsx'

// ── Chip ─────────────────────────────────────────────────────
type ChipVariant = 'ok' | 'warn' | 'danger' | 'neutral' | 'blue'

const chipStyles: Record<ChipVariant, React.CSSProperties> = {
  ok:      { background: 'var(--ok-dim)',      color: 'var(--ok-text)',      border: '1px solid rgba(95,184,130,.18)' },
  warn:    { background: 'var(--warn-dim)',     color: 'var(--warn-text)',    border: '1px solid rgba(232,164,74,.18)'  },
  danger:  { background: 'var(--danger-dim)',   color: 'var(--danger-text)',  border: '1px solid rgba(224,90,90,.18)'   },
  neutral: { background: 'var(--neutral-dim)',  color: 'var(--text-secondary)',border: '1px solid var(--line)'          },
  blue:    { background: 'var(--blue-dim)',      color: 'var(--blue-text)',    border: '1px solid rgba(91,142,240,.18)'  },
}
const dotColor: Record<ChipVariant, string> = {
  ok: 'var(--ok)', warn: 'var(--warn)', danger: 'var(--danger)', neutral: 'var(--neutral)', blue: 'var(--blue)',
}

export function Chip({ variant, label }: { variant: ChipVariant; label: string }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 9px', borderRadius: 99,
      fontSize: 10.5, fontWeight: 500, fontFamily: 'var(--font-mono)',
      letterSpacing: '.02em', whiteSpace: 'nowrap',
      ...chipStyles[variant],
    }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: dotColor[variant], flexShrink: 0 }} />
      {label}
    </span>
  )
}

// ── Location badge ─────────────────────────────────────────────
export function LocBadge({ mode }: { mode: 'campus' | 'wfh' | null }) {
  if (mode === 'campus') return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 4, fontSize: 10.5, fontFamily: 'var(--font-mono)', fontWeight: 500, background: '#0e1e1a', color: '#5fb882', border: '1px solid rgba(95,184,130,.2)' }}>
      วิทยาลัย
    </span>
  )
  if (mode === 'wfh') return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 4, fontSize: 10.5, fontFamily: 'var(--font-mono)', fontWeight: 500, background: 'var(--blue-dim)', color: 'var(--blue-text)', border: '1px solid rgba(91,142,240,.2)' }}>
      WFH
    </span>
  )
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 4, fontSize: 10.5, fontFamily: 'var(--font-mono)', fontWeight: 500, background: 'var(--neutral-dim)', color: 'var(--text-dim)', border: '1px solid var(--line)' }}>
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
    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--line)', borderRadius: 12, padding: '16px 18px', position: 'relative', overflow: 'hidden' }}>
      <div style={{ fontSize: 10.5, fontWeight: 500, color: 'var(--text-muted)', letterSpacing: '.06em', textTransform: 'uppercase', fontFamily: 'var(--font-mono)', marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 600, letterSpacing: '-.04em', lineHeight: 1, marginBottom: 4, color: statNumColor[variant] }}>{value}</div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{sub}</div>
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 2, background: 'var(--line)' }}>
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
    <div style={{ display: 'flex', alignItems: 'center', padding: '13px 18px', borderBottom: '1px solid var(--line)', gap: 10 }}>
      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', flex: 1 }}>{title}</span>
      {meta && <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>{meta}</span>}
    </div>
  )
}

// ── Live pulse dot ────────────────────────────────────────────
export function LiveDot({ label = 'Live' }: { label?: string }) {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 10.5, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', letterSpacing: '.06em', textTransform: 'uppercase' }}>
      <span style={{ position: 'relative', display: 'inline-block', width: 6, height: 6 }}>
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
