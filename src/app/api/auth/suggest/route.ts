import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import fs from 'fs'
import path from 'path'

// อ่านเฉพาะ "ชื่อ" ที่ตรงกับ query — ไม่ส่งเลขบัตรประชาชนออกมา
function searchNames(q: string): string[] {
  try {
    const csvPath = path.join(process.cwd(), 'data', 'Listname.csv')
    const text    = fs.readFileSync(csvPath, 'utf-8')
    const results: string[] = []
    for (const line of text.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed) continue
      const idx  = trimmed.indexOf(',')
      if (idx === -1) continue
      const name = trimmed.substring(idx + 1).trim()
      if (name && name.includes(q)) {
        results.push(name)
        if (results.length >= 10) break
      }
    }
    return results
  } catch {
    return []
  }
}

// GET /api/auth/suggest?q=<partial_name>
// Returns: { names: string[] }  — names only, no national IDs
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const q = new URL(req.url).searchParams.get('q')?.trim() ?? ''
  if (q.length < 1) return NextResponse.json({ names: [] })

  return NextResponse.json({ names: searchNames(q) })
}
