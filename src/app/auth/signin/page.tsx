'use client'
import { signIn } from 'next-auth/react'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import Image from 'next/image'

function SignInContent() {
  const params = useSearchParams()
  const error  = params.get('error')

  return (
    <div className="signin-wrap">

        {/* ── Left Brand Panel ── */}
        <div className="signin-brand">
          {/* dot-grid texture */}
          <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(rgba(255,255,255,.05) 1px, transparent 1px)', backgroundSize: '24px 24px', pointerEvents: 'none' }} />
          {/* accent glow */}
          <div style={{ position: 'absolute', top: -120, left: -80, width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, rgba(61,90,241,.18) 0%, transparent 70%)', pointerEvents: 'none' }} />

          {/* Top: Logo + name */}
          <div style={{ position: 'relative' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 48 }}>
              <Image
                src="/Logo/tatc.jpg"
                alt="TATC"
                width={56}
                height={56}
                style={{ borderRadius: 10, objectFit: 'cover', border: '1px solid rgba(255,255,255,.1)' }}
              />
              <div>
                <div style={{ fontSize: 20, fontWeight: 700, color: '#fff', letterSpacing: '.01em' }}>TATC Check</div>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,.4)', marginTop: 2 }}>ระบบบันทึกการเข้า ออก</div>
              </div>
            </div>

            <div style={{ fontSize: 34, fontWeight: 700, color: '#fff', lineHeight: 1.3, marginBottom: 16 }}>
              บริหารเวลา<br />อย่างมืออาชีพ
            </div>
            <div style={{ fontSize: 16, color: 'rgba(255,255,255,.5)', lineHeight: 1.9 }}>
              ระบบบันทึกการเข้า-ออกงานออนไลน์<br />
            </div>
          </div>

          {/* Mid: Feature list */}
          <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 20, padding: '36px 0' }}>
            {[
              { title: 'GPS Auto-Detect', desc: 'ตรวจสอบตำแหน่งอัตโนมัติ รองรับทั้ง On-site และ WFH' },
              { title: 'Real-time Dashboard', desc: 'ผู้ดูแลดูสถานะบุคลากรได้แบบ Real-time' },
              { title: 'Export รายงาน CSV', desc: 'สรุปการเข้า-ออกรายเดือน Export ได้ทันที' },
            ].map(f => (
              <div key={f.title} style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                <div style={{ width: 8, height: 8, borderRadius: 2, background: '#3d5af1', marginTop: 6, flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: 'rgba(255,255,255,.85)', marginBottom: 2 }}>{f.title}</div>
                  <div style={{ fontSize: 13, color: 'rgba(255,255,255,.38)', lineHeight: 1.6 }}>{f.desc}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Bottom: footer */}
          <div style={{ position: 'relative', fontSize: 12, color: 'rgba(255,255,255,.2)', letterSpacing: '.04em' }}>
            © 2025 TATC · All rights reserved
          </div>
        </div>

        {/* ── Right Form Panel ── */}
        <div className="signin-form-side">
          <div style={{ width: '100%', maxWidth: 340 }}>

            {/* Mobile-only brand header */}
            <div style={{ display: 'none' }} className="mobile-brand">
              <Image src="/Logo/tatc.jpg" alt="TATC" width={44} height={44} style={{ borderRadius: 8, objectFit: 'cover', marginBottom: 20 }} />
            </div>

            {/* Heading */}
            <div style={{ marginBottom: 40, textAlign: 'center' }}>
              <div style={{ fontSize: 30, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.2, marginBottom: 10 }}>
                เข้าสู่ระบบ
              </div>
              <div style={{ fontSize: 15, color: 'var(--text-muted)', lineHeight: 1.7 }}>
                กรุณาใช้บัญชี LINE ที่ได้รับการ<br />อนุมัติจากผู้ดูแลระบบ
              </div>
            </div>

            {/* Error */}
            {error && (
              <div style={{
                background: 'var(--danger-dim)', border: '1px solid rgba(224,90,90,.25)',
                borderRadius: 8, padding: '13px 16px', marginBottom: 24,
                fontSize: 14, color: 'var(--danger-text)', lineHeight: 1.6,
              }}>
                {error === 'not_registered'
                  ? 'บัญชีนี้ไม่มีสิทธิ์เข้าใช้ระบบ กรุณาติดต่อผู้ดูแล'
                  : 'เกิดข้อผิดพลาด กรุณาลองใหม่'}
              </div>
            )}

            {/* LINE button */}
            <button
              onClick={() => signIn('line', { callbackUrl: '/' })}
              style={{
                width: '100%', padding: '17px 20px', borderRadius: 10, border: 'none',
                background: '#06C755', color: '#fff', fontSize: 17, fontWeight: 700,
                cursor: 'pointer', fontFamily: "'Sarabun', sans-serif",
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
                transition: 'opacity .15s', marginBottom: 24,
                boxShadow: '0 4px 20px rgba(6,199,85,.25)',
              }}
              onMouseOver={e => (e.currentTarget.style.opacity = '.88')}
              onMouseOut={e  => (e.currentTarget.style.opacity = '1')}
            >
              <svg width="24" height="24" viewBox="0 0 22 22" fill="none">
                <rect width="22" height="22" rx="5" fill="white" fillOpacity=".15"/>
                <path d="M11 4C7.134 4 4 6.686 4 10c0 2.954 2.618 5.427 6.168 5.903.24.052.567.158.65.363.075.186.049.478.024.667l-.105.631c-.032.194-.149.759.666.413.815-.345 4.398-2.59 6.001-4.43C18.594 12.317 19 11.207 19 10c0-3.314-3.134-6-8-6z" fill="white"/>
              </svg>
              เข้าสู่ระบบด้วย LINE
            </button>

            {/* Info box */}
            <div style={{
              border: '1px solid var(--line)', borderRadius: 8,
              padding: '14px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, textAlign: 'center',
            }}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
                <circle cx="8" cy="8" r="7" stroke="var(--text-dim)" strokeWidth="1.4"/>
                <path d="M8 7v4M8 5.5v.5" stroke="var(--text-dim)" strokeWidth="1.4" strokeLinecap="round"/>
              </svg>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.75 }}>
                เฉพาะบุคคลที่ได้รับอนุมัติจากผู้ดูแลระบบเท่านั้น<br />
                หากยังไม่มีบัญชี กรุณาติดต่อผู้ดูแล<br />
                Line: ballband.com
              </div>
            </div>

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
