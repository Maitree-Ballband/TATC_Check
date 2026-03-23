'use client'
import { useRouter } from 'next/navigation'

interface Props {
  date: string      // YYYY-MM-DD currently selected
  today: string     // YYYY-MM-DD today (Bangkok)
}

export function PresenceDatePicker({ date, today }: Props) {
  const router = useRouter()

  const isToday = date === today

  const inputS: React.CSSProperties = {
    padding: '7px 10px', borderRadius: 7, fontSize: 13,
    background: 'var(--bg-raised)', border: '1px solid var(--line-mid)',
    color: 'var(--text-primary)', fontFamily: "'Sarabun', sans-serif",
    cursor: 'pointer',
  }

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
        style={inputS}
      />
      {!isToday && (
        <button
          onClick={() => router.push('/presence')}
          style={{
            padding: '7px 14px', borderRadius: 7, fontSize: 13, fontWeight: 600,
            background: 'var(--accent)', color: '#fff',
            border: '1px solid var(--accent)', cursor: 'pointer',
            fontFamily: "'Sarabun', sans-serif",
            boxShadow: '0 2px 6px rgba(61,90,241,.2)',
            whiteSpace: 'nowrap',
          }}
        >
          วันนี้
        </button>
      )}
    </div>
  )
}
