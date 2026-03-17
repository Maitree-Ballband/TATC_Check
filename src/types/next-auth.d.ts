import 'next-auth'
import 'next-auth/jwt'

declare module 'next-auth' {
  interface Session {
    user: {
      id:      string
      name?:   string | null
      email?:  string | null
      image?:  string | null
      role:      'teacher' | 'admin' | 'executive'
      nameTh:    string
      dept:      string | null
      isPending: boolean
    }
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    userId?:    string
    role?:      string
    nameTh?:    string
    dept?:      string | null
    isPending?: boolean
  }
}
