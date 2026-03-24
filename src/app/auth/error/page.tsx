'use client'
import { useSearchParams } from 'next/navigation'
import { signIn } from 'next-auth/react'
import { Suspense } from 'react'

const ERROR_MESSAGE: Record<string, { title: string; detail: string }> = {
  OAuthCallback:       { title: 'เกิดข้อผิดพลาดระหว่างเข้าสู่ระบบ', detail: 'กรุณาปิดแล้วเปิดเบราว์เซอร์ใหม่ แล้วลองอีกครั้ง' },
  OAuthSignin:         { title: 'ไม่สามารถเชื่อมต่อ LINE ได้', detail: 'กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ต แล้วลองใหม่' },
  OAuthCreateAccount:  { title: 'ไม่สามารถสร้างบัญชีได้', detail: 'กรุณาติดต่อผู้ดูแลระบบ' },
  account_disabled:    { title: 'บัญชีนี้ถูกระงับการใช้งาน', detail: 'กรุณาติดต่อผู้ดูแลระบบเพื่อเปิดใช้งาน' },
  AccessDenied:        { title: 'ไม่มีสิทธิ์เข้าใช้งาน', detail: 'บัญชีนี้ไม่ได้รับอนุญาต กรุณาติดต่อผู้ดูแลระบบ' },
  Verification:        { title: 'ลิงก์หมดอายุ', detail: 'กรุณาลองเข้าสู่ระบบใหม่อีกครั้ง' },
}

function ErrorContent() {
  const params = useSearchParams()
  const errorCode = params.get('error') ?? params.get('reason') ?? ''
  const err = ERROR_MESSAGE[errorCode] ?? {
    title:  'เกิดข้อผิดพลาดที่ไม่คาดคิด',
    detail: 'กรุณาลองเข้าสู่ระบบใหม่ หากยังพบปัญหากรุณาติดต่อผู้ดูแลระบบ',
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg-base)', padding: '24px 16px',
    }}>
      <div style={{
        width: '100%', maxWidth: 400,
        background: 'var(--bg-surface)', border: '1px solid var(--line)',
        borderRadius: 16, padding: '40px 32px', textAlign: 'center',
        boxShadow: '0 4px 24px rgba(0,0,0,.08)',
      }}>
        {/* Icon */}
        <div style={{
          width: 56, height: 56, borderRadius: '50%',
          background: 'var(--danger-dim)', border: '1px solid rgba(220,38,38,.2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 20px',
        }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--danger-text)" strokeWidth="2" strokeLinecap="round">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
        </div>

        {/* Title */}
        <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 10 }}>
          {err.title}
        </div>
        <div style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.7, marginBottom: 28 }}>
          {err.detail}
        </div>

        {/* Error code badge */}
        {errorCode && (
          <div style={{
            display: 'inline-block', fontSize: 11, color: 'var(--text-dim)',
            background: 'var(--bg-raised)', border: '1px solid var(--line)',
            borderRadius: 4, padding: '2px 8px', marginBottom: 28,
            fontFamily: 'monospace', letterSpacing: '.03em',
          }}>
            {errorCode}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button
            onClick={() => signIn('line', { callbackUrl: '/' })}
            style={{
              width: '100%', padding: '13px', borderRadius: 10, border: 'none',
              background: '#06C755', color: '#fff', fontSize: 15, fontWeight: 700,
              cursor: 'pointer', fontFamily: "'Sarabun', sans-serif",
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              boxShadow: '0 2px 10px rgba(6,199,85,.25)', transition: 'opacity .15s',
            }}
            onMouseOver={e => (e.currentTarget.style.opacity = '.88')}
            onMouseOut={e  => (e.currentTarget.style.opacity = '1')}
          >
            <svg width="20" height="20" viewBox="0 0 22 22" fill="none">
              <rect width="22" height="22" rx="5" fill="white" fillOpacity=".15"/>
              <path d="M11 4C7.134 4 4 6.686 4 10c0 2.954 2.618 5.427 6.168 5.903.24.052.567.158.65.363.075.186.049.478.024.667l-.105.631c-.032.194-.149.759.666.413.815-.345 4.398-2.59 6.001-4.43C18.594 12.317 19 11.207 19 10c0-3.314-3.134-6-8-6z" fill="white"/>
            </svg>
            ลองเข้าสู่ระบบใหม่
          </button>
        </div>
      </div>
    </div>
  )
}

export default function AuthErrorPage() {
  return (
    <Suspense>
      <ErrorContent />
    </Suspense>
  )
}
