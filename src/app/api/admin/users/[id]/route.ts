import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import * as db from '@/lib/db'
import { z } from 'zod'

const updateSchema = z.object({
  full_name_th: z.string().min(1).optional(),
  national_id:  z.string().length(13).optional().or(z.literal('')),
  employee_id:  z.string().optional(),
  department:   z.string().optional(),
  role:         z.enum(['teacher', 'admin', 'executive']).optional(),
  is_active:    z.boolean().optional(),
  is_pending:   z.boolean().optional(),
})

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const body   = await req.json()
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  try {
    const user = await db.updateUser(params.id, parsed.data)
    return NextResponse.json({ user })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'db_error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  try {
    await db.deactivateUser(params.id)
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'db_error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
