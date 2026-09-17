import { useState } from 'react'
import { BellRing, CheckCheck } from 'lucide-react'
import { enablePushNotifications, useMarkAllNotificationsRead, useMarkNotificationRead, useNotifications } from '../../hooks/useClientApi'
import { Badge, Button, Card, EmptyState, SectionTitle } from '../../components/ui/Primitives'

const KIND_LABEL: Record<string, string> = {
  BOOKING_CREATED: 'Запись оформлена',
  REMINDER_1H: 'Напоминание',
  SLOT_CANCELLED: 'Отмена тренировки',
}

function fmt(iso: string): string {
  return new Date(iso).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

// Журнал уведомлений клиента (P2.4): push/email/SMS-рассылка про записи,
// напоминания «через час» и отмены. Push включается кнопкой (разрешение
// браузера + VAPID-подписка); без push уведомления всё равно приходят в
// этот список и на email.
export function NotificationsPage() {
  const { data: feed } = useNotifications()
  const markRead = useMarkNotificationRead()
  const markAll = useMarkAllNotificationsRead()
  const [pushError, setPushError] = useState<string | null>(null)
  const [pushEnabled, setPushEnabled] = useState(false)

  async function onEnablePush() {
    setPushError(null)
    const err = await enablePushNotifications()
    if (err) setPushError(err)
    else setPushEnabled(true)
  }

  const items = feed?.items ?? []
  const unread = feed?.unread ?? 0

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold">
          <BellRing size={20} />
          Уведомления
        </h1>
        <p className="text-sm text-[var(--text-muted)]">
          Напоминания о тренировках за час, подтверждения записи и отмены. Push работает и при закрытом приложении.
        </p>
      </div>

      <Card className="flex flex-col gap-3">
        <SectionTitle title="Push-уведомления" subtitle="Браузер спросит разрешение — оно нужно один раз" />
        {pushEnabled ? (
          <p className="text-sm text-[var(--text-muted)]">Push включён — уведомления будут приходить на это устройство.</p>
        ) : (
          <Button size="sm" onClick={onEnablePush}>
            Включить push
          </Button>
        )}
        {pushError && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{pushError}</div>}
        <p className="text-xs text-[var(--text-faint)]">
          Даже без push уведомления попадают в этот список и дублируются письмом на вашу почту.
        </p>
      </Card>

      <Card>
        <SectionTitle
          title="История"
          subtitle={`непрочитанных: ${unread}`}
          action={
            unread > 0 ? (
              <Button size="sm" variant="secondary" onClick={() => markAll.mutate()}>
                <CheckCheck size={14} />
                <span className="ml-1">Прочитать все</span>
              </Button>
            ) : undefined
          }
        />
        {items.length === 0 ? (
          <EmptyState title="Уведомлений пока нет" subtitle="Запишитесь на занятие — и напоминание придёт сюда" />
        ) : (
          <div className="flex flex-col divide-y divide-[var(--border)]">
            {items.map((n) => (
              <button
                key={n.id}
                onClick={() => !n.readAt && markRead.mutate(n.id)}
                className={`flex items-start justify-between gap-3 py-2.5 text-left ${n.readAt ? '' : 'rounded-lg bg-[var(--accent-soft)] px-2'}`}
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">{n.title}</span>
                    <Badge tone={n.kind === 'SLOT_CANCELLED' ? 'danger' : n.kind === 'REMINDER_1H' ? 'warning' : 'accent'}>
                      {KIND_LABEL[n.kind] ?? n.kind}
                    </Badge>
                    {!n.readAt && <span className="h-2 w-2 shrink-0 rounded-full bg-[var(--accent)]" />}
                  </div>
                  <p className="mt-0.5 text-sm text-[var(--text-muted)]">{n.body}</p>
                  <p className="text-xs text-[var(--text-faint)]">{fmt(n.createdAt)}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
