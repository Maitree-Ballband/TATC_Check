import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import * as db from '@/lib/db'
import { z } from 'zod'

const userSchema = z.object({
  full_name_th: z.string().min(1),
  national_id:  z.string().length(13).optional().or(z.literal('')),
  employee_id:  z.string().optional(),
  department:   z.string().optional(),
  role:         z.enum(['teacher', 'admin', 'executive']).default('teacher'),
  line_user_id: z.string().min(1),
  is_active:    z.boolean().default(true),
})

export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  try {
    const users = await db.listAllUsers()
    return NextResponse.json({ users })
  } catch (err) {
    console.error('[admin/users GET]', err)
    return NextResponse.json({ error: 'db_error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const body   = await req.json()
  const parsed = userSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  try {
    const user = await db.createUser(parsed.data)
    return NextResponse.json({ user }, { status: 201 })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'db_error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
