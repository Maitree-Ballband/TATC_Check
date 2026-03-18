import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import * as db from '@/lib/db'
import { z } from 'zod'

const schema = z.object({
  full_name_th: z.string().min(1),
  national_id:  z.string().regex(/^\d{13}$/, 'เลขบัตรประชาชนต้องเป็นตัวเลข 13 หลักเท่านั้น'),
})

// GET — pending user fetches own saved data
export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id || !session.user.isPending) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const data = await db.getPendingUserProfile(session.user.id)
  return NextResponse.json(data ?? {})
}

// PATCH — pending user updates own profile (before admin approval)
export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id || !session.user.isPending) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body   = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 })
  }

  // ตรวจสอบกับ staff_whitelist — ทั้ง national_id และ ชื่อ ต้องตรงคู่กัน
  const allowed = await db.checkWhitelist(parsed.data.national_id, parsed.data.full_name_th)
  if (!allowed) {
    return NextResponse.json(
      { error: 'ข้อมูลไม่ตรงกับรายชื่อในระบบ ไม่สามารถเข้าใช้งานได้' },
      { status: 400 },
    )
  }

  try {
    await db.updatePendingUserProfile(
      session.user.id,
      parsed.data.full_name_th,
      parsed.data.national_id,
    )
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'db_error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
