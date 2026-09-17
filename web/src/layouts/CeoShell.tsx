import { NavLink, Outlet } from 'react-router-dom'
import { BarChart3, Building2, CalendarRange, LayoutDashboard, Megaphone, Package, Receipt, ScrollText, Users2, Wrench } from 'lucide-react'
import clsx from 'clsx'

const TABS = [
  { to: '/ceo', label: 'Загрузка тренеров', icon: LayoutDashboard, end: true },
  { to: '/ceo/attendance', label: 'Посещаемость', icon: CalendarRange, end: false },
  { to: '/ceo/revenue', label: 'Выручка', icon: BarChart3, end: false },
  { to: '/ceo/clients', label: 'Клиентская база', icon: Users2, end: false },
  { to: '/ceo/gyms', label: 'Точки сети', icon: Building2, end: false },
  { to: '/ceo/orders', label: 'Заказы', icon: Receipt, end: false },
  { to: '/ceo/stock', label: 'Склад', icon: Package, end: false },
  { to: '/ceo/maintenance', label: 'Обслуживание', icon: Wrench, end: false },
  { to: '/ceo/offers', label: 'Рассылки', icon: Megaphone, end: false },
  { to: '/ceo/activity', label: 'Журнал изменений', icon: ScrollText, end: false },
]

export function CeoShell() {
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
