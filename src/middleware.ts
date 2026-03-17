import { withAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'

export default withAuth(
  function middleware(req) {
    const token    = req.nextauth.token
    const pathname = req.nextUrl.pathname

    // Redirect admin to /dashboard, teachers to /checkin
    if (pathname === '/') {
      const dest = token?.role === 'admin' ? '/dashboard' : '/checkin'
      return NextResponse.redirect(new URL(dest, req.url))
    }

    // Block teachers from admin routes
    if (pathname.startsWith('/dashboard') && token?.role !== 'admin') {
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
    '/dashboard/:path*',
    '/checkin/:path*',
    '/presence/:path*',
    '/report/:path*',
    '/api/admin/:path*',
    '/api/attendance/:path*',
  ],
}
