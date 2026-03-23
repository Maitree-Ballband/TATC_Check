'use client'
import { useRouter } from 'next/navigation'

interface Props {
  date:  string   // YYYY-MM-DD currently selected
  today: string   // YYYY-MM-DD today (Bangkok)
}

export function PresenceDatePicker({ date, today }: Props) {
  const router  = useRouter()
  const isToday = date === today

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <input
        type="date"
        value={date}
        max={today}
        onChange={e => {
          const val = e.target.value
          if (!val) return
          router.push(val === today ? '/presence' : `/presence?date=${val}`)
        }}
        style={{
          padding: '10px 14px', borderRadius: 9, fontSize: 15, fontWeight: 600,
          background: 'var(--bg-surface)',
          border: `2px solid ${isToday ? 'var(--accent)' : 'var(--warn)'}`,
          color: 'var(--text-primary)', fontFamily: "'Sarabun', sans-serif",
          cursor: 'pointer', minWidth: 160,
          boxShadow: isToday ? '0 0 0 3px rgba(61,90,241,.12)' : '0 0 0 3px rgba(217,119,6,.12)',
        }}
      />
      {!isToday && (
        <button
          onClick={() => router.push('/presence')}
          style={{
            padding: '10px 20px', borderRadius: 9, fontSize: 14, fontWeight: 700,
            background: 'var(--accent)', color: '#fff',
            border: '2px solid var(--accent)', cursor: 'pointer',
            fontFamily: "'Sarabun', sans-serif",
            boxShadow: '0 2px 10px rgba(61,90,241,.3)',
            whiteSpace: 'nowrap',
          }}
        >
          วันนี้
        </button>
      )}
    </div>
  )
}
