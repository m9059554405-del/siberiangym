import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { CheckCircle2, Dumbbell, KeyRound } from 'lucide-react'
import { api, ApiError } from '../lib/api'
import { Button } from '../components/ui/Primitives'

export function ResetPasswordPage() {
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [repeat, setRepeat] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [loading, setLoading] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < 6) return setError('Пароль должен содержать минимум 6 символов')
    if (password !== repeat) return setError('Пароли не совпадают')
    setError(null)
    setLoading(true)
    try {
      await api.post('/auth/reset-password', { token, password })
      setDone(true)
      setTimeout(() => navigate('/login', { replace: true }), 1800)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось сбросить пароль')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--surface)] px-4">
      <div className="card w-full max-w-sm p-6">
        <div className="mb-6 flex flex-col items-center gap-2">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl text-white" style={{ background: 'linear-gradient(135deg, #38bdf8, #0369a1)' }}>
            <Dumbbell size={22} />
          </div>
          <div className="text-lg font-bold">SiberianGym</div>
          <p className="text-sm text-[var(--text-muted)]">Новый пароль</p>
        </div>
        {done ? (
          <div className="flex flex-col items-center gap-3 text-center">
            <CheckCircle2 className="text-green-600" size={32} />
            <p className="text-sm text-[var(--text-muted)]">Пароль изменён. Перенаправляем на страницу входа.</p>
            <Link to="/login" className="text-sm text-[var(--accent-strong)]">Войти сейчас</Link>
          </div>
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-[var(--text-faint)]">Новый пароль</label>
              <input type="password" required minLength={6} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-[var(--text-faint)]">Повторите пароль</label>
              <input type="password" required minLength={6} autoComplete="new-password" value={repeat} onChange={(e) => setRepeat(e.target.value)} className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]" />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button type="submit" disabled={loading || !token} className="mt-1 w-full justify-center">
              <KeyRound size={15} /> {loading ? 'Сохраняем…' : 'Сохранить пароль'}
            </Button>
            {!token && <p className="text-center text-xs text-red-600">В ссылке отсутствует токен сброса</p>}
          </form>
        )}
      </div>
    </div>
  )
}
