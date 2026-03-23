'use client'
import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { AppShell } from '@/components/layout/AppShell'
import { Chip } from '@/components/ui'
import type { User } from '@/types'

/* ── helpers ─────────────────────────────────────────────────── */
function maskNationalId(id: string | null | undefined): string {
  if (!id) return '—'
  if (id.length !== 13) return `${id.slice(0, 1)}•••••••••${id.slice(-2)}`
  // Format: X-••••-•••XX-X  (show first 1 + last 4)
  return `${id[0]}-••••-•••${id.slice(9, 12)}-${id[12]}`
}

function roleLabel(role: string) {
  if (role === 'admin')     return 'Admin'
  if (role === 'executive') return 'ผู้บริหาร'
  return 'ครู/บุคลากร'
}
function roleVariant(role: string): 'blue' | 'warn' | 'neutral' {
  if (role === 'admin')     return 'blue'
  if (role === 'executive') return 'warn'
  return 'neutral'
}

const emptyForm = {
  full_name_th: '', national_id: '', employee_id: '', department: '',
  role: 'teacher' as 'teacher' | 'admin' | 'executive',
  line_user_id: '', is_active: true,
}

/* ── styles ───────────────────────────────────────────────────── */
const inputS: React.CSSProperties = {
  width: '100%', padding: '9px 12px', borderRadius: 7,
  background: 'var(--bg-raised)', border: '1px solid var(--line-mid)',
  color: 'var(--text-primary)', fontSize: 13.5, fontFamily: "'Sarabun', sans-serif",
  boxSizing: 'border-box',
}
const labelS: React.CSSProperties = {
  display: 'block', fontSize: 11, fontWeight: 600,
  color: 'var(--text-muted)', letterSpacing: '.07em',
  textTransform: 'uppercase', marginBottom: 5,
}
const thS: React.CSSProperties = {
  padding: '9px 14px', fontSize: 10.5, fontWeight: 500,
  color: 'var(--text-muted)', textAlign: 'left',
  borderBottom: '1px solid var(--line)', letterSpacing: '.07em',
  textTransform: 'uppercase', whiteSpace: 'nowrap',
  fontFamily: "'Sarabun', sans-serif",
}

/* ── component ────────────────────────────────────────────────── */
export default function AdminUsersPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [users, setUsers]       = useState<User[]>([])
  const [loading, setLoading]   = useState(true)
  const [search, setSearch]     = useState('')
  const [form, setForm]         = useState(emptyForm)
  const [editId, setEditId]     = useState<string | null>(null)
  const [saving, setSaving]           = useState(false)
  const [showForm, setShowForm]       = useState(false)
  const [toast, setToast]             = useState<{ msg: string; type: 'ok' | 'warn' } | null>(null)
  const [origNationalId, setOrigNationalId] = useState<string>('')

  useEffect(() => {
    if (status === 'authenticated' && session.user.role !== 'admin') router.replace('/checkin')
  }, [session, status, router])

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/admin/users')
    if (res.ok) { const d = await res.json(); setUsers(d.users) }
    setLoading(false)
  }, [])

  useEffect(() => { fetchUsers() }, [fetchUsers])

  const showMsg = (msg: string, type: 'ok' | 'warn' = 'ok') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    const url     = editId ? `/api/admin/users/${editId}` : '/api/admin/users'
    const method  = editId ? 'PATCH' : 'POST'
    const payload = { ...form }
    if (editId && payload.national_id === '') payload.national_id = origNationalId
    const res = await fetch(url, {
      method, headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    setSaving(false)
    if (res.ok) {
      showMsg(editId ? 'บันทึกสำเร็จ' : 'เพิ่มผู้ใช้สำเร็จ')
      setShowForm(false); setEditId(null); setForm(emptyForm); fetchUsers()
    } else {
      const d = await res.json(); showMsg(d.error ?? 'เกิดข้อผิดพลาด', 'warn')
    }
  }

  const openEdit = (u: User) => {
    setOrigNationalId(u.national_id ?? '')
    setForm({
      full_name_th: u.full_name_th, national_id: '',
      employee_id: u.employee_id ?? '', department: u.department ?? '',
      role: u.role, line_user_id: u.line_user_id, is_active: u.is_active,
    })
    setEditId(u.id); setShowForm(true)
    setTimeout(() => document.getElementById('user-form')?.scrollIntoView({ behavior: 'smooth' }), 50)
  }

  const handleToggleActive = async (u: User) => {
    await fetch(`/api/admin/users/${u.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !u.is_active }),
    })
    showMsg(u.is_active ? `ปิดใช้งาน ${u.full_name_th}` : `เปิดใช้งาน ${u.full_name_th}`)
    fetchUsers()
  }

  const handleApprove = async (u: User) => {
    await fetch(`/api/admin/users/${u.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_pending: false, is_active: true }),
    })
    showMsg(`อนุมัติ ${u.full_name_th} เรียบร้อย`)
    fetchUsers()
  }

  const handleReject = async (u: User) => {
    if (!confirm(`ปฏิเสธการลงทะเบียนของ ${u.full_name_th} และลบออก?`)) return
    await fetch(`/api/admin/users/${u.id}`, { method: 'DELETE' })
    showMsg('ลบผู้ใช้เรียบร้อย', 'warn')
    fetchUsers()
  }

  const pendingUsers = users.filter(u => u.is_pending)
  const activeUsers  = users.filter(u => !u.is_pending).filter(u =>
    !search.trim() ||
    u.full_name_th.includes(search) ||
    (u.department ?? '').includes(search) ||
    (u.employee_id ?? '').includes(search)
  )

  const counts = {
    total:    users.filter(u => !u.is_pending).length,
    active:   users.filter(u => !u.is_pending && u.is_active).length,
    inactive: users.filter(u => !u.is_pending && !u.is_active).length,
    admin:    users.filter(u => !u.is_pending && u.role === 'admin').length,
  }

  return (
    <AppShell>

      {/* ── Toast ────────────────────────────────────────────── */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 300,
          display: 'flex', alignItems: 'center', gap: 10,
          background: 'var(--bg-surface)', border: `1px solid ${toast.type === 'ok' ? 'rgba(22,163,74,.3)' : 'rgba(220,38,38,.3)'}`,
          borderRadius: 10, padding: '12px 18px',
          boxShadow: '0 8px 32px rgba(30,36,51,.14)',
          fontSize: 13.5, fontWeight: 500, color: 'var(--text-primary)',
        }}>
          <span style={{
            width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
            background: toast.type === 'ok' ? 'var(--ok)' : 'var(--danger)',
          }} />
          {toast.msg}
        </div>
      )}

      <div style={{ maxWidth: 940, margin: '0 auto' }}>

        {/* ── Page Header ────────────────────────────────────── */}
        <div className="animate-fade-up" style={{
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
          marginBottom: 22, gap: 16, flexWrap: 'wrap',
        }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 500, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 6 }}>
              Admin
            </div>
            <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-.01em', lineHeight: 1.2, marginBottom: 4 }}>
              จัดการผู้ใช้งาน
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              ผู้ใช้ทั้งหมด {counts.total} คน · ใช้งาน {counts.active} · ปิด {counts.inactive}
            </div>
          </div>

          <button
            onClick={() => { setShowForm(true); setEditId(null); setForm(emptyForm) }}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 7,
              padding: '9px 18px', borderRadius: 8, background: 'var(--accent)', color: '#fff',
              border: '1px solid var(--accent)', fontSize: 13.5, fontWeight: 600,
              cursor: 'pointer', fontFamily: "'Sarabun', sans-serif",
              boxShadow: '0 2px 8px rgba(61,90,241,.25)',
            }}
          >
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6.5 1v11M1 6.5h11"/>
            </svg>
            เพิ่มผู้ใช้
          </button>
        </div>

        {/* ── Summary Strip ──────────────────────────────────── */}
        <div className="animate-fade-up-d1" style={{
          display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 1,
          background: 'var(--bg-surface)', border: '1px solid var(--line)',
          borderRadius: 12, marginBottom: 20, overflow: 'hidden',
          boxShadow: '0 1px 4px rgba(30,36,51,.05)',
        }}>
          {[
            { label: 'ทั้งหมด',   value: counts.total,    color: 'var(--text-primary)' },
            { label: 'ใช้งาน',    value: counts.active,   color: 'var(--ok-text)'      },
            { label: 'ปิดใช้งาน', value: counts.inactive, color: 'var(--danger-text)'  },
            { label: 'Admin',     value: counts.admin,    color: 'var(--blue-text)'    },
          ].map((s, i) => (
            <div key={s.label} style={{
              padding: '14px 20px', textAlign: 'center',
              borderRight: i < 3 ? '1px solid var(--line)' : 'none',
            }}>
              <div style={{ fontSize: 24, fontWeight: 700, color: s.color, lineHeight: 1 }}>{s.value}</div>
              <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 4 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* ── Pending Section ────────────────────────────────── */}
        {pendingUsers.length > 0 && (
          <div className="animate-fade-up-d1" style={{
            background: 'var(--warn-dim)', border: '1px solid rgba(217,119,6,.25)',
            borderRadius: 12, marginBottom: 20, overflow: 'hidden',
            boxShadow: '0 1px 4px rgba(30,36,51,.05)',
          }}>
            {/* Header */}
            <div style={{
              padding: '12px 20px', borderBottom: '1px solid rgba(217,119,6,.2)',
              display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="var(--warn)" strokeWidth="1.5">
                <circle cx="7.5" cy="7.5" r="6.5"/>
                <path d="M7.5 4v4M7.5 10.5v.5"/>
              </svg>
              <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--warn-text)' }}>
                รอการอนุมัติ
              </span>
              <span style={{
                fontSize: 11, padding: '1px 8px', borderRadius: 99,
                background: 'var(--warn)', color: '#fff', fontWeight: 700,
              }}>
                {pendingUsers.length}
              </span>
              <span style={{ fontSize: 12, color: 'var(--warn-text)', opacity: .7, marginLeft: 4 }}>
                ผู้ใช้ที่ลงทะเบียนผ่าน LINE รอ Admin อนุมัติ
              </span>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'rgba(217,119,6,.06)' }}>
                    {['ชื่อผู้ใช้', 'รหัสพนักงาน', 'เลขบัตรฯ', 'แผนก', 'วันที่ขอ', 'การดำเนินการ'].map(h => (
                      <th key={h} style={{ ...thS, borderBottomColor: 'rgba(217,119,6,.2)', color: 'var(--warn-text)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pendingUsers.map((u, i) => (
                    <tr key={u.id} style={{ borderBottom: i < pendingUsers.length - 1 ? '1px solid rgba(217,119,6,.15)' : 'none' }}>
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          {u.avatar_url
                          ? <img src={u.avatar_url} alt="" style={{ width: 30, height: 30, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: '1px solid rgba(217,119,6,.3)' }} />
                          : <div style={{
                              width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
                              background: 'rgba(217,119,6,.15)', border: '1px solid rgba(217,119,6,.3)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: 10.5, fontWeight: 700, color: 'var(--warn-text)',
                            }}>
                              {u.full_name_th.slice(0, 2)}
                            </div>
                        }
                          <div>
                            <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)' }}>{u.full_name_th}</div>
                            <div style={{ fontSize: 10.5, color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                              {u.line_user_id.slice(0, 10)}…
                            </div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '12px 14px', fontSize: 13, color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>{u.employee_id ?? '—'}</td>
                      <td style={{ padding: '12px 14px', fontSize: 13, color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>{maskNationalId(u.national_id)}</td>
                      <td style={{ padding: '12px 14px', fontSize: 13, color: 'var(--text-secondary)' }}>{u.department ?? '—'}</td>
                      <td style={{ padding: '12px 14px', fontSize: 12, color: 'var(--text-muted)' }}>
                        {new Date(u.created_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </td>
                      <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button onClick={() => openEdit(u)} style={{
                            padding: '5px 10px', borderRadius: 6, fontSize: 12, fontWeight: 500,
                            cursor: 'pointer', background: 'transparent',
                            color: 'var(--accent)', border: '1px solid rgba(61,90,241,.3)',
                            fontFamily: "'Sarabun', sans-serif",
                          }}>
                            แก้ไข
                          </button>
                          <button onClick={() => handleApprove(u)} style={{
                            padding: '5px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600,
                            cursor: 'pointer', background: 'var(--ok)', color: '#fff',
                            border: '1px solid var(--ok)', fontFamily: "'Sarabun', sans-serif",
                          }}>
                            อนุมัติ
                          </button>
                          <button onClick={() => handleReject(u)} style={{
                            padding: '5px 10px', borderRadius: 6, fontSize: 12, fontWeight: 500,
                            cursor: 'pointer', background: 'transparent',
                            color: 'var(--danger-text)', border: '1px solid rgba(220,38,38,.3)',
                            fontFamily: "'Sarabun', sans-serif",
                          }}>
                            ปฏิเสธ
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ padding: '10px 20px', borderTop: '1px solid rgba(217,119,6,.15)', fontSize: 12, color: 'var(--warn-text)' }}>
              หลังอนุมัติ ผู้ใช้จะต้อง <strong>ออกจากระบบและล็อกอินใหม่</strong> เพื่อเริ่มใช้งาน
            </div>
          </div>
        )}

        {/* ── Add/Edit Form ──────────────────────────────────── */}
        {showForm && (
          <div id="user-form" className="animate-fade-up" style={{
            background: 'var(--bg-surface)', border: '1px solid var(--line)',
            borderLeft: `3px solid var(--accent)`,
            borderRadius: 12, marginBottom: 20, overflow: 'hidden',
            boxShadow: '0 4px 16px rgba(30,36,51,.08)',
          }}>
            {/* Form header */}
            <div style={{
              padding: '14px 20px', borderBottom: '1px solid var(--line)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              background: 'var(--accent-dim)',
            }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent)' }}>
                  {editId ? 'แก้ไขข้อมูลผู้ใช้' : 'เพิ่มผู้ใช้ใหม่'}
                </div>
                {editId && (
                  <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>ID: {editId}</div>
                )}
              </div>
              <button
                type="button"
                onClick={() => { setShowForm(false); setEditId(null) }}
                style={{
                  width: 28, height: 28, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'transparent', border: '1px solid var(--line-mid)', cursor: 'pointer', color: 'var(--text-muted)',
                }}
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M1 1l10 10M11 1L1 11"/>
                </svg>
              </button>
            </div>

            <form onSubmit={handleSubmit} style={{ padding: '20px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
                <div>
                  <label style={labelS}>ชื่อ-นามสกุล *</label>
                  <input style={inputS} value={form.full_name_th}
                    onChange={e => setForm(f => ({ ...f, full_name_th: e.target.value }))} required />
                </div>
                <div>
                  <label style={labelS}>LINE User ID *</label>
                  <input style={inputS} value={form.line_user_id}
                    onChange={e => setForm(f => ({ ...f, line_user_id: e.target.value }))}
                    required placeholder="U..." />
                </div>
                <div>
                  <label style={labelS}>เลขบัตรประชาชน (13 หลัก)</label>
                  <input style={inputS} value={form.national_id}
                    onChange={e => setForm(f => ({ ...f, national_id: e.target.value }))}
                    maxLength={13} inputMode="numeric"
                    placeholder={editId && origNationalId ? maskNationalId(origNationalId) : '1234567890123'} />
                  {editId && origNationalId && (
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                      เว้นว่างไว้หากไม่ต้องการเปลี่ยนเลขบัตร
                    </div>
                  )}
                </div>
                <div>
                  <label style={labelS}>สิทธิ์การใช้งาน</label>
                  <select style={inputS} value={form.role}
                    onChange={e => setForm(f => ({ ...f, role: e.target.value as typeof form.role }))}>
                    <option value="teacher">ครู/บุคลากร</option>
                    <option value="executive">ผู้บริหาร</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
              </div>

              {/* Active toggle */}
              <div style={{
                padding: '10px 14px', borderRadius: 8,
                background: 'var(--bg-raised)', border: '1px solid var(--line)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                marginBottom: 18,
              }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>สถานะการใช้งาน</div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>ปิดใช้งานจะไม่สามารถเข้าสู่ระบบได้</div>
                </div>
                <button
                  type="button"
                  onClick={() => setForm(f => ({ ...f, is_active: !f.is_active }))}
                  style={{
                    padding: '6px 16px', borderRadius: 99, fontSize: 13, fontWeight: 600,
                    cursor: 'pointer', border: '1px solid',
                    background: form.is_active ? 'var(--ok-dim)' : 'var(--danger-dim)',
                    color: form.is_active ? 'var(--ok-text)' : 'var(--danger-text)',
                    borderColor: form.is_active ? 'rgba(22,163,74,.3)' : 'rgba(220,38,38,.3)',
                    fontFamily: "'Sarabun', sans-serif",
                  }}
                >
                  {form.is_active ? 'ใช้งาน' : 'ปิดใช้งาน'}
                </button>
              </div>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => { setShowForm(false); setEditId(null) }}
                  style={{
                    padding: '9px 18px', borderRadius: 8, background: 'transparent',
                    color: 'var(--text-secondary)', border: '1px solid var(--line-mid)',
                    fontSize: 13.5, cursor: 'pointer', fontFamily: "'Sarabun', sans-serif",
                  }}
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  style={{
                    padding: '9px 24px', borderRadius: 8, background: 'var(--accent)',
                    color: '#fff', border: '1px solid var(--accent)',
                    fontSize: 13.5, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer',
                    opacity: saving ? .7 : 1, fontFamily: "'Sarabun', sans-serif",
                  }}
                >
                  {saving ? 'กำลังบันทึก…' : (editId ? 'บันทึกการเปลี่ยนแปลง' : 'เพิ่มผู้ใช้')}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ── Users Table ────────────────────────────────────── */}
        <div className="animate-fade-up-d2" style={{
          background: 'var(--bg-surface)', border: '1px solid var(--line)',
          borderRadius: 12, overflow: 'hidden',
          boxShadow: '0 1px 4px rgba(30,36,51,.05)',
        }}>
          {/* Table header + search */}
          <div style={{
            padding: '14px 20px', borderBottom: '1px solid var(--line)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12,
          }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
              รายชื่อผู้ใช้งาน
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {/* Search */}
              <div style={{ position: 'relative' }}>
                <svg style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', opacity: .45 }} width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="var(--text-muted)" strokeWidth="1.5">
                  <circle cx="5.5" cy="5.5" r="4.5"/><path d="M9.5 9.5l2.5 2.5"/>
                </svg>
                <input
                  type="text"
                  placeholder="ค้นหา ชื่อ / แผนก / รหัส…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  style={{
                    padding: '7px 12px 7px 30px', borderRadius: 7, fontSize: 13,
                    background: 'var(--bg-raised)', border: '1px solid var(--line-mid)',
                    color: 'var(--text-primary)', width: 220,
                    fontFamily: "'Sarabun', sans-serif",
                  }}
                />
              </div>
              <span style={{
                fontSize: 11, padding: '2px 8px', borderRadius: 4,
                background: 'var(--bg-active)', color: 'var(--text-muted)', border: '1px solid var(--line)',
              }}>
                {activeUsers.length} คน
              </span>
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--bg-raised)' }}>
                  {['#', 'ผู้ใช้งาน', 'เลขบัตรฯ', 'สิทธิ์', 'สถานะ', 'วันที่เพิ่ม', ''].map(h => (
                    <th key={h} style={thS}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={9} style={{ padding: '28px', textAlign: 'center', fontSize: 13, color: 'var(--text-muted)' }}>
                      กำลังโหลด…
                    </td>
                  </tr>
                )}
                {!loading && activeUsers.length === 0 && (
                  <tr>
                    <td colSpan={9} style={{ padding: '28px', textAlign: 'center', fontSize: 13, color: 'var(--text-muted)' }}>
                      {search ? `ไม่พบผู้ใช้ที่ตรงกับ "${search}"` : 'ยังไม่มีผู้ใช้งาน'}
                    </td>
                  </tr>
                )}
                {activeUsers.map((u, i) => (
                  <tr key={u.id} className="dash-row" style={{
                    borderBottom: '1px solid var(--line)',
                    opacity: u.is_active ? 1 : 0.55,
                  }}>
                    {/* # */}
                    <td style={{ padding: '11px 14px', textAlign: 'center', fontSize: 11.5, color: 'var(--text-dim)', width: 36 }}>
                      {i + 1}
                    </td>

                    {/* User */}
                    <td style={{ padding: '11px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        {u.avatar_url
                          ? <img src={u.avatar_url} alt="" style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: `1.5px solid ${u.role === 'admin' ? 'rgba(37,99,235,.2)' : u.role === 'executive' ? 'rgba(217,119,6,.2)' : 'rgba(61,90,241,.15)'}` }} />
                          : <div style={{
                              width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                              background: u.role === 'admin' ? 'var(--blue-dim)' : u.role === 'executive' ? 'var(--warn-dim)' : 'var(--accent-dim)',
                              border: `1.5px solid ${u.role === 'admin' ? 'rgba(37,99,235,.2)' : u.role === 'executive' ? 'rgba(217,119,6,.2)' : 'rgba(61,90,241,.15)'}`,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: 11, fontWeight: 700,
                              color: u.role === 'admin' ? 'var(--blue-text)' : u.role === 'executive' ? 'var(--warn-text)' : 'var(--accent)',
                            }}>
                              {u.full_name_th.slice(0, 2)}
                            </div>
                        }
                        <div>
                          <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.3 }}>
                            {u.full_name_th}
                          </div>
                          <div style={{ fontSize: 10.5, color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                            {u.line_user_id.slice(0, 12)}…
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* National ID — masked */}
                    <td style={{ padding: '11px 14px', fontSize: 13, color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums', letterSpacing: '.04em' }}>
                      {maskNationalId(u.national_id)}
                    </td>

                    {/* Role */}
                    <td style={{ padding: '11px 14px' }}>
                      <Chip variant={roleVariant(u.role)} label={roleLabel(u.role)} />
                    </td>

                    {/* Status */}
                    <td style={{ padding: '11px 14px' }}>
                      <Chip variant={u.is_active ? 'ok' : 'danger'} label={u.is_active ? 'ใช้งาน' : 'ปิดใช้'} />
                    </td>

                    {/* Created at */}
                    <td style={{ padding: '11px 14px', fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                      {new Date(u.created_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>

                    {/* Actions */}
                    <td style={{ padding: '11px 14px', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          onClick={() => openEdit(u)}
                          style={{
                            padding: '4px 10px', borderRadius: 6, fontSize: 12, fontWeight: 500,
                            cursor: 'pointer', background: 'transparent',
                            color: 'var(--accent)', border: '1px solid rgba(61,90,241,.25)',
                            fontFamily: "'Sarabun', sans-serif",
                          }}
                        >
                          แก้ไข
                        </button>
                        <button
                          onClick={() => handleToggleActive(u)}
                          style={{
                            padding: '4px 10px', borderRadius: 6, fontSize: 12, fontWeight: 500,
                            cursor: 'pointer', background: 'transparent',
                            color: u.is_active ? 'var(--danger-text)' : 'var(--ok-text)',
                            border: `1px solid ${u.is_active ? 'rgba(220,38,38,.25)' : 'rgba(22,163,74,.25)'}`,
                            fontFamily: "'Sarabun', sans-serif",
                          }}
                        >
                          {u.is_active ? 'ปิดใช้' : 'เปิดใช้'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </AppShell>
  )
}
