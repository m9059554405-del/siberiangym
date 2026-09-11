import { NavLink, Outlet } from 'react-router-dom'
import { CalendarClock, Users } from 'lucide-react'
import clsx from 'clsx'

const TABS = [
  { to: '/trainer', label: 'Подопечные', icon: Users, end: true },
  { to: '/trainer/schedule', label: 'Моё расписание', icon: CalendarClock, end: false },
]

export function TrainerShell() {
  return (
    <div className="flex flex-col gap-5 md:flex-row">
      <aside className="flex gap-1 overflow-x-auto md:w-52 md:shrink-0 md:flex-col md:gap-1.5">
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
