'use client'
import { useState, useEffect, useRef } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'


// ── Step indicator ──────────────────────────────────────────────
function StepBar({ current }: { current: 1 | 2 | 3 }) {
  const steps = [
    { n: 1, label: 'เข้าสู่ระบบ' },
    { n: 2, label: 'ยืนยันตัวตน' },
    { n: 3, label: 'รอการอนุมัติ' },
  ]
  return (
    <div style={{ display: 'flex', alignItems: 'center', marginBottom: 32 }}>
      {steps.map((s, i) => {
        const done    = s.n < current
        const active  = s.n === current
        const dotBg   = done ? 'var(--ok)' : active ? 'var(--accent)' : 'var(--line-mid)'
        const dotColor = done || active ? '#fff' : 'var(--text-dim)'
        const labelColor = active ? 'var(--text-primary)' : done ? 'var(--ok-text)' : 'var(--text-dim)'
        return (
          <div key={s.n} style={{ display: 'flex', alignItems: 'center', flex: i < steps.length - 1 ? 1 : 'none' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%', background: dotBg,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 700, color: dotColor, flexShrink: 0,
              }}>
                {done ? (
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                ) : s.n}
              </div>
              <div style={{ fontSize: 11, fontWeight: active ? 600 : 400, color: labelColor, whiteSpace: 'nowrap', fontFamily: "'Sarabun', sans-serif" }}>
                {s.label}
              </div>
            </div>
            {i < steps.length - 1 && (
              <div style={{ flex: 1, height: 1, background: done ? 'var(--ok)' : 'var(--line)', margin: '0 8px', marginBottom: 22 }} />
            )}
          </div>
        )
      })}
    </div>
  )
}

export default function PendingPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [suggestions, setSuggestions]     = useState<string[]>([])
  const [nationalId, setNationalId]       = useState('')
  const [nameSearch, setNameSearch]       = useState('')
  const [showDrop, setShowDrop]           = useState(false)
  const [saving, setSaving]               = useState(false)
  const [saved, setSaved]                 = useState(false)
  const [alreadySent, setAlreadySent]     = useState(false)
  const [error, setError]                 = useState<string | null>(null)
  const dropRef = useRef<HTMLDivElement>(null)

  // ค้นหาชื่อจาก API (debounced)
  useEffect(() => {
    if (nameSearch.length < 1) { setSuggestions([]); return }
    const t = setTimeout(() => {
      fetch(`/api/auth/suggest?q=${encodeURIComponent(nameSearch)}`)
        .then(r => r.json())
        .then(d => setSuggestions(d.names ?? []))
        .catch(() => setSuggestions([]))
    }, 200)
    return () => clearTimeout(t)
  }, [nameSearch])

  // ปิด dropdown เมื่อคลิกข้างนอก
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) setShowDrop(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // redirect guard
  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/auth/signin')
    if (status === 'authenticated' && !session.user.isPending) router.replace('/checkin')
  }, [status, session, router])

  // โหลดข้อมูลที่เคยบันทึกไว้
  useEffect(() => {
    if (status !== 'authenticated' || !session.user.isPending) return
    fetch('/api/auth/register')
      .then(r => r.json())
      .then(d => {
        if (d.national_id || d.full_name_th) {
          setNationalId(d.national_id ?? '')
          setNameSearch(d.full_name_th ?? '')
          if (d.national_id) setAlreadySent(true)
        }
      })
  }, [status, session])

  const handleSelectName = (name: string) => {
    setNameSearch(name)
    setSuggestions([])
    setShowDrop(false)
    setError(null)
  }

  const handleNationalIdChange = (val: string) => {
    setNationalId(val.replace(/\D/g, '').slice(0, 13))
  }

  const validate = (): string | null => {
    if (nationalId.length !== 13) return 'กรุณากรอกเลขบัตรประชาชนให้ครบ 13 หลัก'
    if (!nameSearch.trim()) return 'กรุณาเลือกชื่อ-นามสกุล'
    return null
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    const err = validate()
    if (err) { setError(err); return }
    setSaving(true); setError(null)
    const res = await fetch('/api/auth/register', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ full_name_th: nameSearch, national_id: nationalId }),
    })
    setSaving(false)
    if (res.ok) setSaved(true)
    else { const d = await res.json(); setError(d.error ?? 'เกิดข้อผิดพลาด') }
  }

  if (status === 'loading') return null

  const step: 1 | 2 | 3 = saved || alreadySent ? 3 : 2

  const inputBase: React.CSSProperties = {
    width: '100%', padding: '10px 14px', borderRadius: 6, fontSize: 15,
    background: 'var(--bg-raised)', border: '1px solid var(--line-mid)',
    color: 'var(--text-primary)', fontFamily: "'Sarabun', sans-serif",
    boxSizing: 'border-box', outline: 'none', transition: 'border-color .15s',
  }
  const labelBase: React.CSSProperties = {
    display: 'block', fontSize: 11, fontWeight: 600,
    color: 'var(--text-muted)', fontFamily: "'Sarabun', sans-serif",
    marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.07em',
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)', fontFamily: "'Sarabun', sans-serif", display: 'flex', flexDirection: 'column' }}>

      {/* ── Top nav bar ── */}
      <div style={{ height: 56, borderBottom: '1px solid var(--line)', background: 'var(--bg-surface)', display: 'flex', alignItems: 'center', padding: '0 24px', gap: 12 }}>
        <Image src="/Logo/tatc.jpg" alt="TATC" width={28} height={28} style={{ borderRadius: 5, objectFit: 'cover' }} />
        <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', flex: 1 }}>TATC Check</span>
        <button
          onClick={() => signOut({ callbackUrl: '/auth/signin' })}
          style={{ background: 'transparent', border: '1px solid var(--line)', borderRadius: 6, fontSize: 13, color: 'var(--text-muted)', cursor: 'pointer', padding: '5px 14px', fontFamily: "'Sarabun', sans-serif" }}
        >
          ออกจากระบบ
        </button>
      </div>

      {/* ── Main content ── */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '48px 24px' }}>
        <div style={{ width: '100%', maxWidth: 500 }}>

          {/* Page title */}
          <div style={{ marginBottom: 32 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent)', letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 8 }}>
              การลงทะเบียนใช้งาน
            </div>
            <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.2, marginBottom: 6 }}>
              {saved ? 'ส่งข้อมูลเรียบร้อยแล้ว' : 'ยืนยันตัวตนเพื่อเข้าใช้งาน'}
            </div>
            <div style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.7 }}>
              {saved
                ? 'ข้อมูลของคุณถูกบันทึกแล้ว รอผู้ดูแลระบบตรวจสอบและอนุมัติสิทธิ์การใช้งาน'
                : alreadySent
                ? 'ส่งข้อมูลแล้ว กำลังรอการอนุมัติ — คุณสามารถแก้ไขข้อมูลด้านล่างได้หากต้องการ'
                : 'กรุณากรอกข้อมูลยืนยันตัวตนให้ครบถ้วน เพื่อให้ผู้ดูแลระบบตรวจสอบและอนุมัติสิทธิ์'
              }
            </div>
          </div>

          {/* Step bar */}
          <StepBar current={step} />

          {/* Main card */}
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--line)', borderRadius: 12, overflow: 'hidden' }}>

            {/* Card header */}
            <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: saved ? 'var(--ok-dim)' : 'var(--blue-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {saved ? (
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M3 8l3.5 3.5 6.5-7" stroke="var(--ok)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <rect x="2" y="4" width="12" height="9" rx="1.5" stroke="var(--blue)" strokeWidth="1.5"/>
                    <path d="M5 4V3a3 3 0 016 0v1" stroke="var(--blue)" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                )}
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
                  {saved ? 'ส่งข้อมูลสำเร็จ' : 'ข้อมูลส่วนตัว'}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  {saved ? 'รอผู้ดูแลระบบอนุมัติ' : 'ต้องตรงกับรายชื่อในระบบเท่านั้น'}
                </div>
              </div>
            </div>

            {/* Card body */}
            <div style={{ padding: '24px' }}>
              {saved ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div style={{ background: 'var(--ok-dim)', border: '1px solid rgba(22,163,74,.2)', borderRadius: 8, padding: '14px 16px' }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ok-text)', marginBottom: 4 }}>ดำเนินการสำเร็จ</div>
                    <div style={{ fontSize: 13, color: 'var(--ok-text)', lineHeight: 1.7, opacity: .85 }}>
                      ชื่อ: <strong>{nameSearch}</strong><br />
                      เลขบัตร: {nationalId.slice(0, 3)}{'*'.repeat(10)}
                    </div>
                  </div>
                  <div style={{ border: '1px solid var(--line)', borderRadius: 8, padding: '14px 16px', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ marginTop: 1, flexShrink: 0 }}>
                      <circle cx="8" cy="8" r="7" stroke="var(--text-dim)" strokeWidth="1.4"/>
                      <path d="M8 7v4M8 5.5v.5" stroke="var(--text-dim)" strokeWidth="1.4" strokeLinecap="round"/>
                    </svg>
                    <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.7 }}>
                      ผู้ดูแลระบบจะตรวจสอบข้อมูลและอนุมัติสิทธิ์การใช้งาน<br />
                      หลังได้รับการอนุมัติ กรุณา<strong>ออกจากระบบแล้วเข้าใหม่</strong>อีกครั้ง
                    </div>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

                  {/* เลขบัตรประชาชน */}
                  <div>
                    <label style={labelBase}>เลขบัตรประชาชน <span style={{ color: 'var(--danger)' }}>*</span></label>
                    <input
                      style={{
                        ...inputBase,
                        borderColor: nationalId.length > 0 && nationalId.length < 13 ? 'var(--danger)' : 'var(--line-mid)',
                        letterSpacing: '0.18em',
                        fontFamily: 'var(--font-mono)',
                        fontSize: 16,
                      }}
                      inputMode="numeric"
                      value={nationalId}
                      onChange={e => handleNationalIdChange(e.target.value)}
                      maxLength={13}
                      placeholder="_ _ _ _ _ _ _ _ _ _ _ _ _"
                      required
                    />
                    <div style={{ fontSize: 12, marginTop: 6, display: 'flex', alignItems: 'center', gap: 5, color: nationalId.length === 13 ? 'var(--ok-text)' : nationalId.length > 0 ? 'var(--danger-text)' : 'var(--text-dim)' }}>
                      {nationalId.length === 13 ? (
                        <>
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
                          ครบ 13 หลัก
                        </>
                      ) : nationalId.length > 0 ? (
                        `${nationalId.length}/13 หลัก`
                      ) : (
                        'กรอกเฉพาะตัวเลข 13 หลัก'
                      )}
                    </div>
                  </div>

                  {/* ชื่อ-นามสกุล */}
                  <div ref={dropRef} style={{ position: 'relative' }}>
                    <label style={labelBase}>ชื่อ-นามสกุล <span style={{ color: 'var(--danger)' }}>*</span></label>
                    <input
                      style={inputBase}
                      value={nameSearch}
                      onChange={e => { setNameSearch(e.target.value); setShowDrop(true) }}
                      onFocus={() => nameSearch.length >= 1 && setShowDrop(true)}
                      placeholder="พิมพ์ชื่อเพื่อค้นหา เช่น นางสาว..."
                      autoComplete="off"
                      required
                    />

                    {/* Dropdown results */}
                    {showDrop && suggestions.length > 0 && (
                      <div style={{
                        position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 100,
                        background: 'var(--bg-surface)', border: '1px solid var(--line-mid)', borderRadius: 8,
                        boxShadow: '0 8px 24px rgba(0,0,0,.1)', maxHeight: 220, overflowY: 'auto',
                      }}>
                        {suggestions.map(name => (
                          <div
                            key={name}
                            onMouseDown={() => handleSelectName(name)}
                            style={{
                              padding: '10px 14px', cursor: 'pointer', fontSize: 14,
                              color: 'var(--text-primary)', borderBottom: '1px solid var(--line)',
                            }}
                          >
                            {name}
                          </div>
                        ))}
                      </div>
                    )}
                    {showDrop && nameSearch.length >= 1 && suggestions.length === 0 && (
                      <div style={{
                        position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 100,
                        background: 'var(--bg-surface)', border: '1px solid var(--line-mid)', borderRadius: 8,
                        padding: '12px 14px', fontSize: 13, color: 'var(--text-muted)',
                        boxShadow: '0 8px 24px rgba(0,0,0,.1)',
                      }}>
                        ไม่พบรายชื่อที่ค้นหา
                      </div>
                    )}
                  </div>

                  {/* Error */}
                  {error && (
                    <div style={{ background: 'var(--danger-dim)', border: '1px solid rgba(220,38,38,.2)', borderRadius: 6, padding: '10px 14px', fontSize: 13, color: 'var(--danger-text)', display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ marginTop: 1, flexShrink: 0 }}>
                        <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.4"/>
                        <path d="M7 4v3.5M7 9.5v.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                      </svg>
                      {error}
                    </div>
                  )}

                  {/* Submit */}
                  <button
                    type="submit"
                    disabled={saving}
                    style={{
                      padding: '13px 20px', borderRadius: 8, background: saving ? 'var(--text-dim)' : 'var(--accent)',
                      color: '#fff', border: 'none', fontSize: 15, fontWeight: 700,
                      cursor: saving ? 'not-allowed' : 'pointer', fontFamily: "'Sarabun', sans-serif",
                      transition: 'opacity .15s',
                    }}
                  >
                    {saving ? 'กำลังตรวจสอบ...' : 'ส่งข้อมูลเพื่อขออนุมัติ'}
                  </button>
                </form>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
