import { useEffect } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import { Bell, Briefcase, Dumbbell, LogOut, ShieldCheck, UserRound, Users } from 'lucide-react'
import { useAuthStore, type Role } from '../store/useAuthStore'
import { GymSwitcher } from '../components/GymSwitcher'
import { useNotifications } from '../hooks/useClientApi'

const ROLE_LABEL: Record<Role, { label: string; icon: typeof UserRound }> = {
  CLIENT: { label: 'Клиент', icon: UserRound },
  TRAINER: { label: 'Тренер', icon: Users },
  CEO: { label: 'CEO', icon: ShieldCheck },
  STAFF: { label: 'Администратор', icon: Briefcase },
}

export function RootLayout() {
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const navigate = useNavigate()
  const isClient = user?.role === 'CLIENT'
  const { data: feed } = useNotifications(isClient)

  useEffect(() => {
    document.title = 'SiberianGym'
  }, [])

  if (!user) return <Outlet />

  const roleInfo = ROLE_LABEL[user.role]
  const RoleIcon = roleInfo.icon
  const unread = feed?.unread ?? 0

  return (
    <div data-role={user.role} className="flex min-h-screen flex-col bg-[var(--surface)]">
      <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[var(--surface-raised)]/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-3 px-4 py-3">
          <div className="flex items-center gap-2 pr-2">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-xl text-white"
              style={{ background: 'var(--accent-gradient)' }}
            >
              <Dumbbell size={18} />
            </div>
            <div className="leading-tight">
              <div className="text-sm font-bold">SiberianGym</div>
              <div className="text-[11px] text-[var(--text-faint)]">фитнес-клуб</div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 rounded-xl bg-[var(--surface-sunken)] px-3 py-1.5 text-sm font-medium" style={{ color: 'var(--accent-strong)' }}>
            <RoleIcon size={15} />
            {roleInfo.label}
          </div>

          <div className="ml-auto flex items-center gap-2">
            {user.role === 'CEO' && <GymSwitcher />}
            {isClient && (
              <button
                onClick={() => navigate('/client/notifications')}
                title="Уведомления"
                className="tap-scale relative flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--surface-sunken)]"
              >
                <Bell size={15} />
                {unread > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--accent)] px-1 text-[10px] font-bold text-white">
                    {unread > 9 ? '9+' : unread}
                  </span>
                )}
              </button>
            )}
            <span className="text-xs text-[var(--text-faint)]">{user.email}</span>
            <button
              onClick={() => {
                logout()
                navigate('/login', { replace: true })
              }}
              title="Выйти"
              className="tap-scale flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--surface-sunken)]"
            >
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 pb-10 pt-4">
        <Outlet />
      </main>
    </div>
  )
}
