import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { KeyRound } from 'lucide-react'
import { api, ApiError } from '../lib/api'
import { Button } from '../components/ui/Primitives'
import { useAuthStore } from '../store/useAuthStore'

const ROLE_HOME: Record<string, string> = { CLIENT: '/client', TRAINER: '/trainer', STAFF: '/staff', CEO: '/ceo' }

export function TwoFactorPage() {
  const [params] = useSearchParams()
  const challengeToken = params.get('challenge') ?? ''
  const navigate = useNavigate()
  const setSession = useAuthStore((s) => s.setSession)
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await api.post<{ requiresTwoFactor: false; accessToken: string; user: { id: string; email: string | null; role: string; gymId: string } }>('/auth/2fa/login', { challengeToken, code })
      setSession(res.accessToken, res.user as never)
      navigate(ROLE_HOME[res.user.role] ?? '/client', { replace: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось подтвердить код')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--surface)] px-4">
      <div className="card w-full max-w-sm p-6">
        <div className="mb-6 flex flex-col items-center gap-2">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--accent)] text-white"><KeyRound size={22} /></div>
          <div className="text-lg font-bold">Подтвердите вход</div>
          <p className="text-center text-sm text-[var(--text-muted)]">Введите 6-значный код из приложения-аутентификатора</p>
        </div>
        <form onSubmit={submit} className="flex flex-col gap-3">
          <input type="text" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} autoComplete="one-time-code" autoFocus required value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] px-3 py-3 text-center text-xl tracking-[0.5em] outline-none focus:border-[var(--accent)]" />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" disabled={loading || code.length !== 6 || !challengeToken} className="w-full justify-center">
            {loading ? 'Проверяем…' : 'Подтвердить'}
          </Button>
          <Link to="/login" className="text-center text-sm text-[var(--accent-strong)]">Вернуться ко входу</Link>
        </form>
      </div>
    </div>
  )
}
