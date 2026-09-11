import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { useMyTrainerClients, useMyTrainerProfile } from '../../hooks/useTrainerApi'
import { tariffById } from '../../data/tariffs'
import { Avatar } from '../../components/ui/Avatar'
import { Badge, Card, EmptyState, Tabs } from '../../components/ui/Primitives'
import { getInitials } from '../../lib/format'
import type { ClientFormat } from '../../types'

const FORMAT_LABEL: Record<ClientFormat, string> = { PERSONAL: 'Персонально', GROUP: 'Группа', SELF: 'Самостоятельно' }
const STATUS_TONE: Record<string, 'success' | 'warning' | 'danger'> = { ACTIVE: 'success', FROZEN: 'warning', EXPIRED: 'danger' }
const STATUS_LABEL: Record<string, string> = { ACTIVE: 'Активен', FROZEN: 'Заморожен', EXPIRED: 'Истёк' }

export function ClientListPage() {
  const { data: trainer } = useMyTrainerProfile()
  const { data: clients } = useMyTrainerClients()
  const [formatFilter, setFormatFilter] = useState<ClientFormat | 'all'>('all')

  const filtered = useMemo(
    () => (clients ?? []).filter((c) => formatFilter === 'all' || c.format === formatFilter),
    [clients, formatFilter],
  )

  if (!trainer) return null

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-bold">Список подопечных</h1>
        <p className="text-sm text-[var(--text-muted)]">
          {trainer.name} · {trainer.specialization} · {(clients ?? []).length} клиентов
        </p>
      </div>

      <Tabs
        value={formatFilter}
        onChange={setFormatFilter}
        options={[
          { value: 'all', label: 'Все' },
          { value: 'PERSONAL', label: 'Персонально' },
          { value: 'GROUP', label: 'Группы' },
          { value: 'SELF', label: 'Самостоятельно' },
        ]}
      />

      {filtered.length === 0 && <EmptyState title="Нет клиентов по фильтру" />}

      <div className="flex flex-col gap-2">
        {filtered.map((c) => (
          <Link key={c.id} to={`/trainer/clients/${c.id}`}>
            <Card className="tap-scale flex items-center justify-between gap-3 hover:border-[var(--accent)]">
              <div className="flex items-center gap-3">
                <Avatar initials={getInitials(c.name)} hue={c.avatarHue} size={40} />
                <div>
                  <div className="font-medium">{c.name}</div>
                  <div className="text-xs text-[var(--text-faint)]">
                    В клубе с {c.joinedAt.slice(0, 10)}
                    {tariffById(c.tariff) && <> · тариф «{tariffById(c.tariff)!.name}»</>}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge tone="accent">{FORMAT_LABEL[c.format]}</Badge>
                {c.membership && <Badge tone={STATUS_TONE[c.membership.status]}>{STATUS_LABEL[c.membership.status]}</Badge>}
                <ChevronRight size={16} className="text-[var(--text-faint)]" />
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
