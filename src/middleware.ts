import { withAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'

const ADMIN_ONLY  = ['/admin']
const EXEC_PLUS   = ['/dashboard', '/presence']  // admin + executive

function isInternalIP(ip: string): boolean {
  return (
    ip === '127.0.0.1' ||
    ip === '::1' ||
    ip.startsWith('10.') ||
    ip.startsWith('192.168.') ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(ip)
  )
}

export default withAuth(
  function middleware(req) {
    const token    = req.nextauth.token
    const role     = token?.role as string | undefined
    const pathname = req.nextUrl.pathname

    // Block /api/rms/* จากภายนอก — อนุญาตเฉพาะ internal IP
    if (pathname.startsWith('/api/rms/')) {
      const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim()
              ?? req.headers.get('x-real-ip')
              ?? '0.0.0.0'
      if (!isInternalIP(ip)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      return NextResponse.next()
    }

    // Redirect root based on role
    if (pathname === '/') {
      const dest = role === 'admin' ? '/dashboard' : '/checkin'
      return NextResponse.redirect(new URL(dest, req.url))
    }

    // Admin-only pages
    if (ADMIN_ONLY.some(p => pathname.startsWith(p)) && role !== 'admin') {
      return NextResponse.redirect(new URL('/checkin', req.url))
    }

    // Executive + admin pages
    if (EXEC_PLUS.some(p => pathname.startsWith(p)) && role !== 'admin' && role !== 'executive') {
      return NextResponse.redirect(new URL('/checkin', req.url))
    }

    return NextResponse.next()
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
  }
)

export const config = {
  matcher: [
    '/',
    '/admin/:path*',
    '/dashboard/:path*',
    '/checkin/:path*',
    '/presence/:path*',
    '/api/admin/:path*',
    '/api/attendance/:path*',
    '/api/rms/:path*',
  ],
}
