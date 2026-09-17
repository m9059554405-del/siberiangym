import { NavLink, Outlet } from 'react-router-dom'
import { Activity, CalendarDays, CreditCard, Dumbbell, Newspaper, QrCode, ShoppingBag, UserSearch } from 'lucide-react'
import clsx from 'clsx'
import { ConsentGate } from '../components/ConsentGate'

const TABS = [
  { to: '/client/payments', label: 'Оплата', icon: CreditCard },
  { to: '/client/calendar', label: 'Календарь', icon: CalendarDays },
  { to: '/client/qr', label: 'Мой QR', icon: QrCode },
  { to: '/client/shop', label: 'Магазин', icon: ShoppingBag },
  { to: '/client/exercises', label: 'Упражнения', icon: Dumbbell },
  { to: '/client/trainer', label: 'Тренер', icon: UserSearch },
  { to: '/client/news', label: 'Новости', icon: Newspaper },
  { to: '/client/progress', label: 'Прогресс', icon: Activity },
]

export function ClientShell() {
  return (
    <ConsentGate>
      <div className="mx-auto flex max-w-[480px] flex-col">
        <div className="min-h-[70vh] pb-20">
          <Outlet />
        </div>
        <nav className="sticky bottom-0 z-30 flex w-full gap-0.5 overflow-x-auto border-t border-[var(--border)] bg-[var(--surface-raised)]/95 px-1 py-2 backdrop-blur">
          {TABS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                clsx(
                  'tap-scale flex min-w-[58px] flex-1 shrink-0 flex-col items-center gap-0.5 rounded-xl px-1 py-1.5 text-[10px] font-medium',
                  isActive ? 'text-[var(--accent-strong)]' : 'text-[var(--text-faint)]',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <Icon size={18} strokeWidth={isActive ? 2.4 : 2} />
                  {label}
                </>
              )}
            </NavLink>
          ))}
        </nav>
      </div>
    </ConsentGate>
  )
}
