import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import * as db from '@/lib/db'

// GET /api/auth/lookup-name?id=<13-digit national_id>
// Returns: { name: string | null }
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const id = new URL(req.url).searchParams.get('id')?.trim() ?? ''
  if (!/^\d{13}$/.test(id)) return NextResponse.json({ name: null })

  const name = await db.lookupNameByNationalId(id)
  return NextResponse.json({ name })
}
