import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import * as db from '@/lib/db'

// GET /api/auth/suggest?q=<partial_name>
// Returns: { names: string[] }  — names only, no national IDs
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const q = new URL(req.url).searchParams.get('q')?.trim() ?? ''
  if (q.length < 1) return NextResponse.json({ names: [] })

  const names = await db.searchWhitelistNames(q)
  return NextResponse.json({ names })
}
