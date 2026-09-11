import { useMemo, useState } from 'react'
import { ScrollText } from 'lucide-react'
import { useActivityLog } from '../../hooks/useCeoApi'
import { Badge, Card, EmptyState, SectionTitle, StatTile, Tabs } from '../../components/ui/Primitives'

type ActorRole = 'CLIENT' | 'TRAINER' | 'CEO' | 'STAFF'

const ROLE_LABEL: Record<ActorRole, string> = { CLIENT: 'Клиент', TRAINER: 'Тренер', CEO: 'CEO', STAFF: 'Администратор' }
const ROLE_TONE: Record<ActorRole, 'accent' | 'success' | 'warning' | 'neutral'> = { CLIENT: 'accent', TRAINER: 'success', STAFF: 'warning', CEO: 'neutral' }

function formatDate(iso: string): string {
  return iso.slice(0, 16).replace('T', ', ')
}

export function ActivityLogPage() {
  const { data: log } = useActivityLog()
  const [roleFilter, setRoleFilter] = useState<ActorRole | 'all'>('all')

  const entries = useMemo(() => [...(log ?? [])].sort((a, b) => b.date.localeCompare(a.date)), [log])
  const filtered = roleFilter === 'all' ? entries : entries.filter((e) => e.actorRole === roleFilter)

  const today = entries.length > 0 ? entries[0].date.slice(0, 10) : null
  const todayCount = today ? entries.filter((e) => e.date.slice(0, 10) === today).length : 0

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-xl font-bold">Журнал изменений</h1>
        <p className="text-sm text-[var(--text-muted)]">Кто, что и когда изменил во всех приложениях экосистемы</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Всего записей" value={entries.length} />
        <StatTile label="За сегодня" value={todayCount} />
        <StatTile label="От Администратора" value={entries.filter((e) => e.actorRole === 'STAFF').length} />
        <StatTile label="От CEO" value={entries.filter((e) => e.actorRole === 'CEO').length} />
      </div>

      <Tabs
        value={roleFilter}
        onChange={setRoleFilter}
        options={[
          { value: 'all', label: 'Все' },
          { value: 'CLIENT', label: 'Клиенты' },
          { value: 'TRAINER', label: 'Тренеры' },
          { value: 'STAFF', label: 'Администратор' },
          { value: 'CEO', label: 'CEO' },
        ]}
      />

      <Card>
        <SectionTitle title="Записи" subtitle={`${filtered.length} из ${entries.length}`} action={<ScrollText size={18} className="text-[var(--accent-strong)]" />} />
        <div className="flex flex-col gap-2">
          {filtered.map((e) => (
            <div key={e.id} className="flex flex-col gap-1 rounded-lg bg-[var(--surface-sunken)] px-3 py-2.5 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Badge tone={ROLE_TONE[e.actorRole]}>{ROLE_LABEL[e.actorRole]}</Badge>
                  <span className="font-medium">{e.actorName}</span>
                  <span className="text-[var(--text-muted)]">{e.action}</span>
                </div>
                <span className="text-xs text-[var(--text-faint)]">{formatDate(e.date)}</span>
              </div>
              <div className="text-xs text-[var(--text-muted)]">
                <span className="font-medium text-[var(--text)]">{e.target}</span>
                {e.details && e.details !== '—' && <span> · {e.details}</span>}
              </div>
            </div>
          ))}
          {filtered.length === 0 && <EmptyState title="Записей пока нет" subtitle="Появятся по мере действий в приложениях" />}
        </div>
      </Card>
    </div>
  )
}
