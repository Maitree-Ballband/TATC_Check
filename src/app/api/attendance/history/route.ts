import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const from = searchParams.get('from') // YYYY-MM-DD
  const to   = searchParams.get('to')   // YYYY-MM-DD

  const db = createServerClient()
  let query = db
    .from('attendance_records')
    .select('*')
    .eq('user_id', session.user.id)
    .order('date', { ascending: false })

  if (from) query = query.gte('date', from)
  if (to)   query = query.lte('date', to)

  const { data, error } = await query.limit(90)
  if (error) return NextResponse.json({ error: 'db_error' }, { status: 500 })
  return NextResponse.json({ records: data })
}
