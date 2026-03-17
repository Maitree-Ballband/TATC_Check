'use client'
import { useState, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { AppShell } from '@/components/layout/AppShell'
import { Panel, PanelHeader } from '@/components/ui'

export default function ImportPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const fileRef  = useRef<HTMLInputElement>(null)
  const [result, setResult]   = useState<{ imported: number; skipped: number; message?: string } | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)

  useEffect(() => {
    if (status === 'authenticated' && session.user.role !== 'admin') router.replace('/checkin')
  }, [session, status, router])

  const handleUpload = async () => {
    const file = fileRef.current?.files?.[0]
    if (!file) return
    setLoading(true); setResult(null); setError(null)
    const fd = new FormData()
    fd.append('file', file)
    const res = await fetch('/api/admin/import', { method: 'POST', body: fd })
    const data = await res.json()
    setLoading(false)
    if (res.ok) setResult(data)
    else setError(data.error ?? 'เกิดข้อผิดพลาด')
  }

  return (
    <AppShell>
      <div style={{ maxWidth: 560, margin: '0 auto' }}>
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 4 }}>Admin</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}>นำเข้าข้อมูลเครื่องสแกน</div>
        </div>

        <Panel style={{ marginBottom: 16 }}>
          <PanelHeader title="อัปโหลดไฟล์ CSV / TXT" />
          <div style={{ padding: '20px 18px' }}>
            <div style={{ background: 'var(--bg-raised)', borderRadius: 8, padding: '12px 14px', marginBottom: 16, fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', lineHeight: 1.7 }}>
              รูปแบบไฟล์ที่รองรับ:<br />
              <span style={{ color: 'var(--ok-text)' }}>national_id, วันที่, เวลา, ...</span><br />
              ตัวอย่าง: <span style={{ color: 'var(--text-primary)' }}>3640400528699,01/01/2025,08:05:32</span><br />
              แถวแรก = เช็คอิน · แถวสุดท้าย (ถ้ามีหลายแถว) = เช็คเอาท์
            </div>

            <input
              ref={fileRef}
              type="file"
              accept=".csv,.txt"
              style={{ display: 'block', marginBottom: 14, fontSize: 13, color: 'var(--text-secondary)' }}
            />
            <button
              onClick={handleUpload}
              disabled={loading}
              style={{ padding: '10px 20px', borderRadius: 8, background: 'var(--text-primary)', color: 'var(--bg-base)', border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
            >
              {loading ? 'กำลังนำเข้า...' : 'นำเข้าข้อมูล'}
            </button>
          </div>
        </Panel>

        {result && (
          <div style={{ background: 'var(--ok-dim)', border: '1px solid rgba(95,184,130,.25)', borderRadius: 8, padding: '14px 18px', fontSize: 13 }}>
            <div style={{ fontWeight: 600, color: 'var(--ok-text)', marginBottom: 4 }}>นำเข้าสำเร็จ</div>
            <div style={{ color: 'var(--text-secondary)' }}>
              บันทึกแล้ว: <strong>{result.imported}</strong> รายการ &nbsp;·&nbsp; ข้ามไป: <strong>{result.skipped}</strong> รายการ
            </div>
            {result.message && <div style={{ color: 'var(--text-muted)', marginTop: 6, fontSize: 12 }}>{result.message}</div>}
          </div>
        )}
        {error && (
          <div style={{ background: 'var(--danger-dim)', border: '1px solid rgba(224,90,90,.2)', borderRadius: 8, padding: '14px 18px', fontSize: 13, color: 'var(--danger-text)' }}>
            {error}
          </div>
        )}
      </div>
    </AppShell>
  )
}
