import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Dumbbell, Mail } from 'lucide-react'
import { api, ApiError } from '../lib/api'
import { Button } from '../components/ui/Primitives'

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await api.post('/auth/request-password-reset', { email: email.trim() })
      setSent(true)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось отправить письмо')
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
          <p className="text-sm text-[var(--text-muted)]">Сброс пароля</p>
        </div>
        {sent ? (
          <div className="flex flex-col gap-3 text-center">
            <p className="text-sm text-[var(--text-muted)]">Если такой email зарегистрирован, на него отправлена ссылка для сброса пароля. Проверьте почту.</p>
            <Link to="/login" className="text-sm text-[var(--accent-strong)]">Вернуться ко входу</Link>
          </div>
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-3">
            <p className="text-sm text-[var(--text-muted)]">Введите email, который использовали для входа. Мы отправим одноразовую ссылку.</p>
            <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]" />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button type="submit" disabled={loading} className="w-full justify-center">
              <Mail size={15} /> {loading ? 'Отправляем…' : 'Отправить ссылку'}
            </Button>
            <Link to="/login" className="inline-flex items-center justify-center gap-1 text-sm text-[var(--accent-strong)]">
              <ArrowLeft size={14} /> Вернуться ко входу
            </Link>
          </form>
        )}
      </div>
    </div>
  )
}
