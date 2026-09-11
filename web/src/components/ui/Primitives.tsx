import type { ButtonHTMLAttributes, CSSProperties, PropsWithChildren, ReactNode } from 'react'
import clsx from 'clsx'

export function Card({
  children,
  className,
  style,
}: PropsWithChildren<{ className?: string; style?: CSSProperties }>) {
  return (
    <div className={clsx('card p-4', className)} style={style}>
      {children}
    </div>
  )
}

export function SectionTitle({
  title,
  subtitle,
  action,
}: {
  title: string
  subtitle?: string
  action?: ReactNode
}) {
  return (
    <div className="mb-3 flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
      <div className="min-w-0">
        <h2 className="text-lg font-semibold text-[var(--text)]">{title}</h2>
        {subtitle && <p className="mt-0.5 text-sm text-[var(--text-muted)]">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}

type BadgeTone = 'accent' | 'success' | 'warning' | 'danger' | 'neutral'

const badgeTones: Record<BadgeTone, string> = {
  accent: 'bg-[var(--accent-soft)] text-[var(--accent-strong)]',
  success: 'bg-green-100 text-green-700',
  warning: 'bg-amber-100 text-amber-700',
  danger: 'bg-red-100 text-red-700',
  neutral: 'bg-[var(--surface-sunken)] text-[var(--text-muted)]',
}

export function Badge({ tone = 'neutral', children }: PropsWithChildren<{ tone?: BadgeTone }>) {
  return (
    <span className={clsx('inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium', badgeTones[tone])}>
      {children}
    </span>
  )
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md'
}

export function Button({ variant = 'primary', size = 'md', className, ...rest }: ButtonProps) {
  const base = 'tap-scale inline-flex items-center justify-center gap-1.5 rounded-xl font-medium disabled:opacity-40 disabled:pointer-events-none'
  const sizes = size === 'sm' ? 'px-3 py-1.5 text-sm' : 'px-4 py-2.5 text-sm'
  const variants: Record<string, string> = {
    primary: 'bg-[var(--accent)] text-white hover:brightness-105',
    secondary: 'bg-[var(--accent-soft)] text-[var(--accent-strong)] hover:brightness-95',
    ghost: 'bg-transparent text-[var(--text-muted)] hover:bg-[var(--surface-sunken)]',
    danger: 'bg-red-50 text-red-600 hover:bg-red-100',
  }
  return <button className={clsx(base, sizes, variants[variant], className)} {...rest} />
}

export function StatTile({
  label,
  value,
  hint,
  icon,
}: {
  label: string
  value: ReactNode
  hint?: string
  icon?: ReactNode
}) {
  return (
    <Card className="flex flex-col gap-1">
      <div className="flex items-center justify-between text-[var(--text-muted)]">
        <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
        {icon}
      </div>
      <div className="text-2xl font-semibold text-[var(--text)]">{value}</div>
      {hint && <div className="text-xs text-[var(--text-faint)]">{hint}</div>}
    </Card>
  )
}

export function ProgressBar({ value, max, tone = 'accent' }: { value: number; max: number; tone?: 'accent' | 'neutral' }) {
  const pct = max <= 0 ? 0 : Math.min(100, Math.round((value / max) * 100))
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--surface-sunken)]">
      <div
        className="h-full rounded-full transition-all"
        style={{ width: `${pct}%`, background: tone === 'accent' ? 'var(--accent)' : '#9aa0b4' }}
      />
    </div>
  )
}

export function EmptyState({ title, subtitle, className }: { title: string; subtitle?: string; className?: string }) {
  return (
    <div className={`flex flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-[var(--border)] px-6 py-10 text-center ${className ?? ''}`}>
      <p className="font-medium text-[var(--text-muted)]">{title}</p>
      {subtitle && <p className="text-sm text-[var(--text-faint)]">{subtitle}</p>}
    </div>
  )
}

export function Tabs<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: string }[]
}) {
  return (
    <div className="inline-flex gap-1 rounded-xl bg-[var(--surface-sunken)] p-1">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={clsx(
            'tap-scale rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
            value === opt.value ? 'bg-[var(--surface-raised)] text-[var(--text)] shadow-sm' : 'text-[var(--text-muted)]',
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}
