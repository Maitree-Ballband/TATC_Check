'use client'
import { signIn } from 'next-auth/react'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

function SignInContent() {
  const params = useSearchParams()
  const error  = params.get('error')

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-base)' }}>
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--line)', borderRadius: 16, padding: '40px 36px', width: '100%', maxWidth: 380, textAlign: 'center' }}>
        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 32 }}>
          <div style={{ width: 36, height: 36, background: 'var(--accent)', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 500, color: 'var(--bg-base)', letterSpacing: -0.5 }}>TA</span>
          </div>
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>TOAS</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '.04em' }}>Attendance</div>
          </div>
        </div>

        <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 8 }}>เข้าสู่ระบบ</div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 28 }}>ระบบเช็คการเข้า-ออกครูออนไลน์</div>

        {/* Error */}
        {error && (
          <div style={{ background: 'var(--danger-dim)', border: '1px solid rgba(224,90,90,.2)', borderRadius: 8, padding: '10px 14px', marginBottom: 20, fontSize: 13, color: 'var(--danger-text)', textAlign: 'left' }}>
            {error === 'not_registered'
              ? 'บัญชีนี้ไม่มีสิทธิ์เข้าใช้ระบบ กรุณาติดต่อผู้ดูแล'
              : 'เกิดข้อผิดพลาด กรุณาลองใหม่'}
          </div>
        )}

        <button
          onClick={() => signIn('line', { callbackUrl: '/' })}
          style={{
            width: '100%', padding: '12px', borderRadius: 8, border: 'none',
            background: '#06C755', color: '#fff', fontSize: 14, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'var(--font-sans)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            transition: 'opacity .15s',
          }}
          onMouseOver={e => (e.currentTarget.style.opacity = '.88')}
          onMouseOut={e  => (e.currentTarget.style.opacity = '1')}
        >
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
            <rect width="22" height="22" rx="5" fill="white" fillOpacity=".15"/>
            <path d="M11 4C7.134 4 4 6.686 4 10c0 2.954 2.618 5.427 6.168 5.903.24.052.567.158.65.363.075.186.049.478.024.667l-.105.631c-.032.194-.149.759.666.413.815-.345 4.398-2.59 6.001-4.43C18.594 12.317 19 11.207 19 10c0-3.314-3.134-6-8-6z" fill="white"/>
          </svg>
          เข้าสู่ระบบด้วย LINE
        </button>

        <div style={{ marginTop: 20, fontSize: 11, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
          เฉพาะบัญชีที่ลงทะเบียนแล้วเท่านั้น
        </div>
      </div>
    </div>
  )
}

export default function SignInPage() {
  return (
    <Suspense>
      <SignInContent />
    </Suspense>
  )
}
