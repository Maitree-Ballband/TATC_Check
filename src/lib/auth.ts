import NextAuth, { type NextAuthOptions } from 'next-auth'
import LineProvider from 'next-auth/providers/line'
import * as db from '@/lib/db'
import type { User } from '@/types'

export const authOptions: NextAuthOptions = {
  providers: [
    LineProvider({
      clientId:     process.env.LINE_CLIENT_ID!,
      clientSecret: process.env.LINE_CLIENT_SECRET!,
      authorization: { params: { scope: 'profile openid' } },
      checks: ['state'],
    }),
  ],

  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider !== 'line') return false

      const lineUserId = account.providerAccountId
      const existing   = await db.findUserByLineId(lineUserId)

      if (!existing) {
        // ผู้ใช้ใหม่ — สร้าง pending record อัตโนมัติ
        try {
          await db.createPendingUser(lineUserId, user.name ?? 'ไม่ระบุชื่อ', user.image ?? null)
        } catch (err) {
          console.error('[auth] createPendingUser failed:', err)
        }
        // อนุญาตให้ login แต่จะถูก redirect ไป /auth/pending
        return true
      }

      // บัญชีที่ถูกปิด (ไม่ใช่ pending)
      if (!existing.is_active && !existing.is_pending) {
        return '/auth/error?reason=account_disabled'
      }

      // อัปเดต avatar จาก LINE profile (fire-and-forget)
      db.updateUserAvatar(lineUserId, user.image ?? null).catch(() => null)

      return true
    },

    async jwt({ token, account }) {
      if (account?.provider === 'line') {
        const data = await db.findUserAuthByLineId(account.providerAccountId)
        if (data) {
          token.userId    = data.id
          token.role      = data.role
          token.nameTh    = data.full_name_th
          token.dept      = data.department
          token.isPending = data.is_pending ?? false
        }
      } else if (token.isPending && token.userId) {
        // Re-check DB so the token self-heals after auto-activation
        const data = await db.findUserAuthById(token.userId as string)
        if (data && !data.is_pending) {
          token.isPending = false
          token.role      = data.role
          token.nameTh    = data.full_name_th
          token.dept      = data.department
        }
      }
      return token
    },

    async session({ session, token }) {
      session.user.id        = token.userId as string
      session.user.role      = token.role as User['role']
      session.user.nameTh    = token.nameTh as string
      session.user.dept      = token.dept as string | null
      session.user.isPending = (token.isPending as boolean) ?? false
      return session
    },
  },

  pages: {
    signIn: '/auth/signin',
    error:  '/auth/error',
  },

  // 10-hour session covers a full school day (sign-in ~07:00, checkout ~17:00)
  session: { strategy: 'jwt', maxAge: 10 * 60 * 60 },
}

export default NextAuth(authOptions)
