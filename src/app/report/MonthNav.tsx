'use client'
import { useRouter } from 'next/navigation'
import { format, addMonths, subMonths, startOfMonth, endOfMonth, parseISO } from 'date-fns'

interface Props {
  from: string  // YYYY-MM-DD (first day of displayed month)
}

export function MonthNav({ from }: Props) {
  const router  = useRouter()
  const current = parseISO(from)

  function go(d: Date) {
    const f = format(startOfMonth(d), 'yyyy-MM-dd')
    const t = format(endOfMonth(d),   'yyyy-MM-dd')
    router.push(`/report?from=${f}&to=${t}`)
  }

  const label = current.toLocaleDateString('th-TH', {
    timeZone: 'Asia/Bangkok', month: 'long', year: 'numeric',
  })

  const btnS: React.CSSProperties = {
    padding: '7px 14px', borderRadius: 7, fontSize: 13, fontWeight: 600,
    background: 'var(--bg-raised)', border: '1px solid var(--line-mid)',
    color: 'var(--text-secondary)', cursor: 'pointer',
    fontFamily: "'Sarabun', sans-serif", transition: 'all .15s',
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <button onClick={() => go(subMonths(current, 1))} style={btnS}>← ก่อนหน้า</button>
      <div style={{
        padding: '7px 18px', borderRadius: 7, fontSize: 13, fontWeight: 700,
        background: 'var(--bg-surface)', border: '1px solid var(--line)',
        color: 'var(--text-primary)', minWidth: 130, textAlign: 'center',
        fontFamily: "'Sarabun', sans-serif",
      }}>
        {label}
      </div>
      <button onClick={() => go(addMonths(current, 1))} style={btnS}>ถัดไป →</button>
    </div>
  )
}
