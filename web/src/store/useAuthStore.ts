import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type Role = 'CLIENT' | 'TRAINER' | 'CEO' | 'STAFF' | 'SYSADMIN'

interface AuthUser {
  id: string
  email: string | null
  role: Role
  gymId: string
}

interface AuthState {
  token: string | null
  user: AuthUser | null
  setSession: (token: string, user: AuthUser) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      setSession: (token, user) => set({ token, user }),
      logout: () => set({ token: null, user: null }),
    }),
    { name: 'siberiangym-auth' },
  ),
)
