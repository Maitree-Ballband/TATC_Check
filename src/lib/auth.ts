import NextAuth, { type NextAuthOptions } from 'next-auth'
import LineProvider from 'next-auth/providers/line'
import { createServerClient } from '@/lib/supabase'
import type { User } from '@/types'

export const authOptions: NextAuthOptions = {
  providers: [
    LineProvider({
      clientId: process.env.LINE_CLIENT_ID!,
      clientSecret: process.env.LINE_CLIENT_SECRET!,
      authorization: { params: { scope: 'profile openid' } },
    }),
  ],

  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider !== 'line') return false

      const db = createServerClient()
      const lineUserId = account.providerAccountId

      // Check whitelist — only pre-registered users can log in
      const { data, error } = await db
        .from('users')
        .select('id, is_active, role')
        .eq('line_user_id', lineUserId)
        .single()

      if (error || !data || !data.is_active) {
        // Return URL with error so the login page can show a message
        return '/auth/error?reason=not_registered'
      }

      // Upsert avatar from LINE profile
      await db
        .from('users')
        .update({ avatar_url: user.image ?? null })
        .eq('line_user_id', lineUserId)

      return true
    },

    async jwt({ token, account }) {
      if (account?.provider === 'line') {
        const db = createServerClient()
        const { data } = await db
          .from('users')
          .select('id, role, full_name_th, department')
          .eq('line_user_id', account.providerAccountId)
          .single()

        if (data) {
          token.userId   = data.id
          token.role     = data.role
          token.nameTh   = data.full_name_th
          token.dept     = data.department
        }
      }
      return token
    },

    async session({ session, token }) {
      session.user.id     = token.userId as string
      session.user.role   = token.role as User['role']
      session.user.nameTh = token.nameTh as string
      session.user.dept   = token.dept as string | null
      return session
    },
  },

  pages: {
    signIn:  '/auth/signin',
    error:   '/auth/error',
  },

  session: { strategy: 'jwt', maxAge: 8 * 60 * 60 }, // 8 hours
}

export default NextAuth(authOptions)
