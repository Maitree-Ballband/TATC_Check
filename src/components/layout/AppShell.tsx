'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut, useSession } from 'next-auth/react'
import { clsx } from 'clsx'

const NAV_TEACHER = [
  { href: '/checkin',  label: 'เช็คอิน',   icon: CheckIcon },
  { href: '/presence', label: 'สถานะครู',  icon: UsersIcon },
]

const NAV_ADMIN = [
  { href: '/dashboard', label: 'Dashboard',  icon: GridIcon  },
  { href: '/presence',  label: 'สถานะครู',   icon: UsersIcon },
  { href: '/checkin',   label: 'เช็คอิน',    icon: CheckIcon },
  { href: '/report',    label: 'รายงาน',     icon: ReportIcon },
]

export function AppShell({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession()
  const pathname = usePathname()
  const isAdmin  = session?.user?.role === 'admin'
  const navItems = isAdmin ? NAV_ADMIN : NAV_TEACHER

  const initials = session?.user?.nameTh
    ? session.user.nameTh.slice(0, 2)
    : '??'

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>

      {/* ── Sidebar ── */}
      <aside style={{
        width: 224, flexShrink: 0,
        background: 'var(--bg-surface)',
        borderRight: '1px solid var(--line)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        {/* Brand */}
        <div style={{ padding: '20px 18px 16px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 28, height: 28, background: 'var(--accent)', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 500, color: 'var(--bg-base)', letterSpacing: -0.5 }}>TA</span>
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '.01em' }}>TOAS</div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', letterSpacing: '.04em', textTransform: 'uppercase' }}>Attendance</div>
          </div>
        </div>

        {/* Nav */}
        <div style={{ padding: '10px 0', flex: 1 }}>
          <div style={{ fontSize: 10, fontWeight: 500, color: 'var(--text-dim)', letterSpacing: '.1em', textTransform: 'uppercase', padding: '0 18px 6px', fontFamily: 'var(--font-mono)' }}>
            {isAdmin ? 'จัดการ' : 'เมนู'}
          </div>
          {navItems.map(item => {
            const active = pathname === item.href || pathname.startsWith(item.href + '/')
            return (
              <Link key={item.href} href={item.href} style={{ textDecoration: 'none' }}>
                <div className={clsx('nav-item', active && 'active')} style={{
                  display: 'flex', alignItems: 'center', gap: 9,
                  padding: '7px 18px', fontSize: 13.5,
                  color: active ? 'var(--accent)' : 'var(--text-secondary)',
                  background: active ? 'var(--accent-dim)' : 'transparent',
                  cursor: 'pointer', position: 'relative',
                  borderLeft: active ? '2px solid var(--accent)' : '2px solid transparent',
                  transition: 'all .12s',
                }}>
                  <item.icon size={16} style={{ opacity: active ? 1 : 0.7, flexShrink: 0 }} />
                  {item.label}
                </div>
              </Link>
            )
          })}
        </div>

        {/* User */}
        <div style={{ borderTop: '1px solid var(--line)', padding: '14px 18px' }}>
          <div
            style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', borderRadius: 8, padding: '6px 8px', margin: '-6px -8px', transition: 'background .12s' }}
            onClick={() => signOut({ callbackUrl: '/auth/signin' })}
            title="ออกจากระบบ"
          >
            <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--bg-active)', border: '1px solid var(--line-mid)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600, color: 'var(--accent)', flexShrink: 0 }}>
              {initials}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{session?.user?.nameTh ?? '—'}</div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{session?.user?.role ?? ''}</div>
            </div>
          </div>
        </div>
      </aside>

      {/* ── Main ── */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Topbar */}
        <div style={{ height: 52, borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', padding: '0 24px', gap: 16, background: 'var(--bg-surface)', flexShrink: 0 }}>
          <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>
            {navItems.find(n => pathname.startsWith(n.href))?.label ?? 'TOAS'}
          </span>
          <span style={{ width: 1, height: 16, background: 'var(--line-mid)' }} />
          <span style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            {new Date().toLocaleDateString('th-TH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </span>
          {isAdmin && (
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
              <a href="/api/admin/export" style={{ textDecoration: 'none' }}>
                <button style={ghostBtn}>
                  <DownloadIcon size={13} /> Export .xlsx
                </button>
              </a>
            </div>
          )}
        </div>

        {/* Page content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '26px 26px' }}>
          {children}
        </div>
      </main>
    </div>
  )
}

// ── Inline button style ──
const ghostBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '6px 12px', borderRadius: 8, fontSize: 12.5, fontWeight: 500,
  cursor: 'pointer', background: 'transparent',
  color: 'var(--text-secondary)', border: '1px solid var(--line-mid)',
  fontFamily: 'var(--font-sans)',
}

// ── Icon components ──
function GridIcon({ size = 16, style }: { size?: number; style?: React.CSSProperties }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" style={style}>
      <rect x="1" y="1" width="6" height="6" rx="1.5"/><rect x="9" y="1" width="6" height="6" rx="1.5"/>
      <rect x="1" y="9" width="6" height="6" rx="1.5"/><rect x="9" y="9" width="6" height="6" rx="1.5"/>
    </svg>
  )
}
function CheckIcon({ size = 16, style }: { size?: number; style?: React.CSSProperties }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" style={style}>
      <circle cx="8" cy="8" r="6.5"/><path d="M5.5 8l2 2 3-3"/>
    </svg>
  )
}
function UsersIcon({ size = 16, style }: { size?: number; style?: React.CSSProperties }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" style={style}>
      <circle cx="8" cy="5" r="3"/><path d="M2 14c0-3.3 2.7-5 6-5s6 1.7 6 5"/>
    </svg>
  )
}
function ReportIcon({ size = 16, style }: { size?: number; style?: React.CSSProperties }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" style={style}>
      <path d="M2 2h12v12H2z"/><path d="M5 6h6M5 9h4"/>
    </svg>
  )
}
function DownloadIcon({ size = 13, style }: { size?: number; style?: React.CSSProperties }) {
  return (
    <svg width={size} height={size} viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.5" style={style}>
      <path d="M6.5 1v8M3.5 6l3 3 3-3M1 10v1.5A1.5 1.5 0 002.5 13h8a1.5 1.5 0 001.5-1.5V10"/>
    </svg>
  )
}
