'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { signOut, useSession } from 'next-auth/react'
import { useEffect, useState } from 'react'
import { clsx } from 'clsx'

const NAV_TEACHER = [
  { href: '/checkin', label: 'เช็คอิน', icon: CheckIcon },
]

const NAV_EXECUTIVE = [
  { href: '/dashboard', label: 'Dashboard', icon: GridIcon  },
  { href: '/presence',  label: 'สถานะครู',  icon: UsersIcon },
  { href: '/checkin',   label: 'เช็คอิน',   icon: CheckIcon },
]

const NAV_ADMIN = [
  { href: '/dashboard',   label: 'Dashboard',    icon: GridIcon     },
  { href: '/presence',    label: 'สถานะครู',     icon: UsersIcon    },
  { href: '/checkin',     label: 'เช็คอิน',      icon: CheckIcon    },
  { href: '/admin/users', label: 'จัดการผู้ใช้', icon: UserMgmtIcon },
]

export function AppShell({ children }: { children: React.ReactNode }) {
  const { data: session, update } = useSession()
  const pathname = usePathname()
  const router   = useRouter()
  const role     = session?.user?.role
  const isAdmin  = role === 'admin'
  const navItems = role === 'admin' ? NAV_ADMIN : role === 'executive' ? NAV_EXECUTIVE : NAV_TEACHER

  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    if (!session?.user?.isPending) return
    // Re-fetch session from DB before redirecting — avoids race condition after
    // user completes registration (isPending cleared) and navigates here.
    update().then(fresh => {
      if (fresh?.user?.isPending) router.replace('/auth/pending')
    })
  }, [session?.user?.isPending]) // eslint-disable-line react-hooks/exhaustive-deps

  // Close sidebar on route change
  useEffect(() => { setSidebarOpen(false) }, [pathname])

  // Idle timeout — auto signOut after 15 minutes of inactivity
  useEffect(() => {
    const IDLE_MS = 15 * 60 * 1000
    let lastActivity = Date.now()
    const reset = () => { lastActivity = Date.now() }
    const events = ['mousedown', 'mousemove', 'keydown', 'touchstart', 'scroll']
    events.forEach(e => window.addEventListener(e, reset, { passive: true }))
    const timer = setInterval(() => {
      if (Date.now() - lastActivity >= IDLE_MS) {
        signOut({ callbackUrl: '/auth/signin' })
      }
    }, 60_000)
    return () => {
      events.forEach(e => window.removeEventListener(e, reset))
      clearInterval(timer)
    }
  }, [])

  const initials = session?.user?.nameTh
    ? session.user.nameTh.slice(0, 2)
    : '??'

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>

      {/* ── Mobile backdrop overlay ── */}
      <div
        className={clsx('appshell-overlay', sidebarOpen && 'sidebar-open')}
        onClick={() => setSidebarOpen(false)}
      />

      {/* ── Sidebar ── */}
      <aside className={clsx('appshell-sidebar', sidebarOpen && 'sidebar-open')} style={{
        width: 224, flexShrink: 0,
        background: 'var(--bg-surface)',
        borderRight: '1px solid var(--line)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        {/* Brand */}
        <div style={{ padding: '20px 18px 16px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, background: 'var(--accent)', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <span style={{ fontFamily: 'var(--font-heading)', fontSize: 13, fontWeight: 700, color: '#fff', letterSpacing: -0.5 }}>TA</span>
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-heading)', letterSpacing: '.02em' }}>TATC Check</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-body)', letterSpacing: '.02em' }}>ระบบบันทึกการเข้า ออก</div>
          </div>
        </div>

        {/* Nav */}
        <div style={{ padding: '12px 0', flex: 1 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-dim)', letterSpacing: '.08em', textTransform: 'uppercase', padding: '0 18px 8px', fontFamily: 'var(--font-body)' }}>
            {isAdmin ? 'เมนูหลัก' : 'เมนู'}
          </div>
          {navItems.map(item => {
            const active = pathname === item.href || pathname.startsWith(item.href + '/')
            return (
              <Link key={item.href} href={item.href} style={{ textDecoration: 'none' }} onClick={() => setSidebarOpen(false)}>
                <div className={clsx('nav-item', active && 'active')} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '9px 18px', fontSize: 15,
                  fontFamily: 'var(--font-body)', fontWeight: active ? 600 : 400,
                  color: active ? 'var(--accent)' : 'var(--text-secondary)',
                  background: active ? 'var(--accent-dim)' : 'transparent',
                  cursor: 'pointer', position: 'relative',
                  borderLeft: active ? '3px solid var(--accent)' : '3px solid transparent',
                  transition: 'all .12s',
                }}>
                  <item.icon size={17} style={{ opacity: active ? 1 : 0.65, flexShrink: 0 }} />
                  {item.label}
                </div>
              </Link>
            )
          })}
        </div>

        {/* User card */}
        <div style={{ borderTop: '1px solid var(--line)', padding: '14px 18px' }}>
          <div
            style={{ display: 'flex', alignItems: 'center', gap: 10, borderRadius: 8, padding: '7px 8px', margin: '-7px -8px' }}
          >
            {session?.user?.image
              ? <img src={session.user.image} alt="" style={{ width: 34, height: 34, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: '1px solid var(--line-mid)' }} />
              : <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--bg-active)', border: '1px solid var(--line-mid)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: 'var(--accent)', flexShrink: 0, fontFamily: 'var(--font-heading)' }}>
                  {initials}
                </div>
            }
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontFamily: 'var(--font-body)' }}>{session?.user?.nameTh ?? '—'}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-body)' }}>{role === 'admin' ? 'ผู้ดูแลระบบ' : role === 'executive' ? 'ผู้บริหาร' : 'ครู/บุคลากร'}</div>
            </div>
          </div>
        </div>
      </aside>

      {/* ── Main ── */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Topbar */}
        <div style={{
          height: 56, borderBottom: '1px solid var(--line)',
          display: 'flex', alignItems: 'center', padding: '0 16px',
          gap: 10, background: 'var(--bg-surface)', flexShrink: 0,
        }}>
          {/* Hamburger — visible only on mobile via CSS */}
          <button
            className="appshell-hamburger"
            onClick={() => setSidebarOpen(v => !v)}
            aria-label="เปิดเมนู"
            style={{
              width: 36, height: 36, borderRadius: 8, flexShrink: 0,
              background: 'transparent', border: '1px solid var(--line-mid)',
              cursor: 'pointer', color: 'var(--text-secondary)',
            }}
          >
            <HamburgerIcon size={16} />
          </button>

          <span style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}>
            {navItems.find(n => pathname.startsWith(n.href))?.label ?? 'TATC Check'}
          </span>
          <span className="appshell-topbar-sep" style={{ width: 1, height: 18, background: 'var(--line-mid)' }} />
          <span className="appshell-topbar-date" style={{ fontSize: 13.5, color: 'var(--text-secondary)', fontFamily: 'var(--font-body)' }}>
            {new Date().toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok', weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </span>

          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              onClick={() => signOut({ callbackUrl: '/auth/signin' })}
              style={logoutBtn}
              title="ออกจากระบบ"
            >
              <LogoutIcon size={14} />
              <span className="appshell-logout-text">ออกจากระบบ</span>
            </button>
          </div>
        </div>

        {/* Page content */}
        <div className="appshell-content" style={{ flex: 1, overflowY: 'auto', padding: '26px 26px' }}>
          {children}
        </div>
      </main>
    </div>
  )
}

// ── Button styles ──────────────────────────────────────────────
const logoutBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '7px 14px', borderRadius: 8, fontSize: 13.5, fontWeight: 600,
  cursor: 'pointer', background: 'var(--danger)', color: '#fff',
  border: '1px solid var(--danger)', fontFamily: 'var(--font-body)',
  boxShadow: '0 1px 4px rgba(220,38,38,.25)',
}

// ── Icon components ────────────────────────────────────────────
function HamburgerIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
      <path d="M2 4h12M2 8h12M2 12h12"/>
    </svg>
  )
}
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

function UserMgmtIcon({ size = 16, style }: { size?: number; style?: React.CSSProperties }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" style={style}>
      <circle cx="6" cy="5" r="2.5"/><path d="M1 14c0-2.8 2.2-4.5 5-4.5s5 1.7 5 4.5"/>
      <path d="M11 7l1.5 1.5L15 6"/>
    </svg>
  )
}
function LogoutIcon({ size = 16, style }: { size?: number; style?: React.CSSProperties }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" style={style}>
      <path d="M6 2H3a1 1 0 00-1 1v10a1 1 0 001 1h3"/>
      <path d="M11 11l3-3-3-3M14 8H6" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}
