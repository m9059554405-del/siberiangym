import { NavLink, Outlet } from 'react-router-dom'
import { Newspaper, Package, Receipt, ScanLine, SprayCan, UserRoundPlus, UsersRound, Wrench } from 'lucide-react'
import clsx from 'clsx'

const TABS = [
  { to: '/staff', label: 'Клиенты', icon: UsersRound, end: true },
  { to: '/staff/leads', label: 'Гости', icon: UserRoundPlus, end: false },
  { to: '/staff/checkins', label: 'Вход', icon: ScanLine, end: false },
  { to: '/staff/orders', label: 'Заказы', icon: Receipt, end: false },
  { to: '/staff/news', label: 'Новости', icon: Newspaper, end: false },
  { to: '/staff/cleaning', label: 'Уборка', icon: SprayCan, end: false },
  { to: '/staff/equipment', label: 'ППР', icon: Wrench, end: false },
  { to: '/staff/stock', label: 'Склад', icon: Package, end: false },
]

export function StaffShell() {
  return (
    <div className="flex flex-col gap-5 md:flex-row">
      <aside className="flex gap-1 overflow-x-auto md:w-56 md:shrink-0 md:flex-col md:gap-1.5">
        {TABS.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              clsx(
                'tap-scale flex shrink-0 items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium whitespace-nowrap',
                isActive ? 'bg-[var(--accent-soft)] text-[var(--accent-strong)]' : 'text-[var(--text-muted)] hover:bg-[var(--surface-sunken)]',
              )
            }
          >
            <Icon size={16} />
            {label}
          </NavLink>
        ))}
      </aside>
      <div className="min-w-0 flex-1">
        <Outlet />
      </div>
    </div>
  )
}
