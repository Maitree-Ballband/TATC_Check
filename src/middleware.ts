import { withAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'

const ADMIN_ONLY  = ['/admin']
const EXEC_PLUS   = ['/dashboard', '/presence']  // admin + executive

export default withAuth(
  function middleware(req) {
    const token    = req.nextauth.token
    const role     = token?.role as string | undefined
    const pathname = req.nextUrl.pathname

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
  ],
}
