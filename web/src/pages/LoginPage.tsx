import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Dumbbell, LogIn } from 'lucide-react'
import { api, ApiError } from '../lib/api'
import { useAuthStore } from '../store/useAuthStore'
import { Button } from '../components/ui/Primitives'

const ROLE_HOME: Record<string, string> = {
  CLIENT: '/client',
  TRAINER: '/trainer',
  STAFF: '/staff',
  CEO: '/ceo',
}

export function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const setSession = useAuthStore((s) => s.setSession)
  const navigate = useNavigate()

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await api.post<{ accessToken: string; user: { id: string; email: string | null; role: string; gymId: string } }>('/auth/login', {
        email: email.trim(),
        password,
      })
      setSession(res.accessToken, res.user as any)
      navigate(ROLE_HOME[res.user.role] ?? '/client', { replace: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось войти')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--surface)] px-4">
      <div className="card w-full max-w-sm p-6">
        <div className="mb-6 flex flex-col items-center gap-2">
          <div
            className="flex h-11 w-11 items-center justify-center rounded-xl text-white"
            style={{ background: 'linear-gradient(135deg, #38bdf8, #0369a1)' }}
          >
            <Dumbbell size={22} />
          </div>
          <div className="text-lg font-bold">SiberianGym</div>
          <p className="text-sm text-[var(--text-muted)]">Вход в личный кабинет</p>
        </div>

        <form onSubmit={submit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-[var(--text-faint)]">Email</label>
            <input
              type="email"
              required
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-[var(--text-faint)]">Пароль</label>
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" disabled={loading} className="mt-1 w-full justify-center">
            <LogIn size={15} /> {loading ? 'Входим…' : 'Войти'}
          </Button>
          <Link to="/forgot-password" className="text-center text-sm text-[var(--accent-strong)] hover:underline">
            Забыли пароль?
          </Link>
        </form>
      </div>
    </div>
  )
}
