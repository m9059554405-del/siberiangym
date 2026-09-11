import { NavLink, Outlet } from 'react-router-dom'
import clsx from 'clsx'
import type { LucideIcon } from 'lucide-react'

export function SimpleShell({ tabs }: { tabs: { to: string; label: string; icon: LucideIcon }[] }) {
  return (
    <div className="flex flex-col gap-4">
      <nav className="flex flex-wrap gap-1 rounded-xl bg-[var(--surface-sunken)] p-1">
        {tabs.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end
            className={({ isActive }) =>
              clsx(
                'tap-scale flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                isActive ? 'bg-[var(--surface-raised)] shadow-sm' : 'text-[var(--text-muted)] hover:text-[var(--text)]',
              )
            }
            style={({ isActive }) => (isActive ? { color: 'var(--accent-strong)' } : undefined)}
          >
            <Icon size={15} />
            {label}
          </NavLink>
        ))}
      </nav>
      <Outlet />
    </div>
  )
}
