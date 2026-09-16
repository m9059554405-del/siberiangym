import { useState } from 'react'
import { Award, Clock } from 'lucide-react'
import { useGoSelfTraining, useMe, useTrainers } from '../../hooks/useClientApi'
import { useCreateCashOrder } from '../../hooks/useOrdersApi'
import { tariffById } from '../../data/tariffs'
import { Avatar } from '../../components/ui/Avatar'
import { Badge, Button, Card } from '../../components/ui/Primitives'
import { Modal } from '../../components/ui/Modal'
import { TariffPicker } from '../../components/TariffPicker'
import { TrainerProfileModal } from '../../components/TrainerProfileModal'
import { OrderPendingNotice } from '../../components/OrderPendingNotice'
import { formatMoney, getInitials } from '../../lib/format'
import type { Order, Tariff, Trainer } from '../../types'

const WEEKDAY_LABELS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']

export function TrainerSelectionPage() {
  const { data: client } = useMe()
  const { data: trainers } = useTrainers()
  const createCashOrder = useCreateCashOrder()
  const goSelfTraining = useGoSelfTraining(client?.id)

  const [picked, setPicked] = useState<Trainer | null>(null)
  const [changingTariff, setChangingTariff] = useState(false)
  const [viewingProfile, setViewingProfile] = useState<Trainer | null>(null)
  const [pendingOrder, setPendingOrder] = useState<Order | null>(null)

  if (!client || !trainers) return null

  const currentTrainer = trainers.find((t) => t.id === client.trainerId)
  const currentTariffInfo = tariffById(client.tariff)

  function handleSelectTariff(tariff: Tariff) {
    if (!picked) return
    createCashOrder.mutate(
      { clientId: client!.id, lines: [{ type: 'TARIFF_CHANGE', meta: { tariff, trainerId: picked.id } }] },
      { onSuccess: setPendingOrder },
    )
    setPicked(null)
  }

  return (
    <div className="flex flex-col gap-4 pt-1">
      <div>
        <h1 className="text-xl font-bold">Выбор тренера</h1>
        <p className="text-sm text-[var(--text-muted)]">Персональные или групповые тренировки с профи клуба</p>
      </div>

      {pendingOrder && <OrderPendingNotice order={pendingOrder} onDismiss={() => setPendingOrder(null)} />}

      {client.format === 'SELF' || !currentTrainer ? (
        <Card className="bg-[var(--accent-soft)] text-sm text-[var(--accent-strong)]">Сейчас вы занимаетесь самостоятельно</Card>
      ) : (
        <Card className="flex items-center justify-between gap-2 bg-[var(--accent-soft)] text-sm text-[var(--accent-strong)]">
          <div>
            Ваш тренер: <span className="font-semibold">{currentTrainer.name}</span>
            {currentTariffInfo && <> · тариф «{currentTariffInfo.name}»</>}
          </div>
          <Button size="sm" variant="secondary" onClick={() => setChangingTariff(true)}>
            Сменить тариф
          </Button>
        </Card>
      )}

      <div className="flex flex-col gap-3">
        {trainers.map((t) => {
          const isCurrent = client.trainerId === t.id && client.format !== 'SELF'
          return (
            <Card key={t.id} className="flex flex-col gap-2">
              <button onClick={() => setViewingProfile(t)} className="tap-scale flex items-start gap-3 text-left">
                <Avatar initials={getInitials(t.name)} hue={t.avatarHue} size={52} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{t.name}</span>
                    {isCurrent && <Badge tone="success">Ваш тренер</Badge>}
                  </div>
                  <div className="text-sm text-[var(--text-muted)]">{t.specialization}</div>
                  {t.bio && <p className="mt-1 text-xs text-[var(--text-faint)]">{t.bio}</p>}
                  <span className="mt-1 inline-block text-xs font-medium text-[var(--accent-strong)]">Подробнее →</span>
                </div>
              </button>
              <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--text-faint)]">
                <span className="flex items-center gap-1">
                  <Award size={13} /> {t.experienceYears} лет опыта
                </span>
                {t.workHours.length > 0 && (
                  <span className="flex items-center gap-1">
                    <Clock size={13} /> {t.workHours.map((w) => WEEKDAY_LABELS[w.day]).join(', ')}
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between pt-1">
                <span className="text-lg font-bold">{formatMoney(t.personalSessionPrice)} ₽ / занятие</span>
                <Button size="sm" onClick={() => setPicked(t)}>
                  {isCurrent ? 'Сменить тариф' : 'Выбрать'}
                </Button>
              </div>
            </Card>
          )
        })}
      </div>

      <button
        onClick={() => goSelfTraining.mutate()}
        className="tap-scale rounded-xl border border-dashed border-[var(--border)] py-3 text-sm font-medium text-[var(--text-muted)] hover:bg-[var(--surface-sunken)]"
      >
        Заниматься самостоятельно, без тренера
      </button>

      <Modal open={!!picked} onClose={() => setPicked(null)} title={`Тариф занятий с ${picked?.name ?? ''}`}>
        <TariffPicker currentTariff={picked?.id === client.trainerId ? client.tariff : null} onSelect={handleSelectTariff} />
      </Modal>

      <Modal open={changingTariff} onClose={() => setChangingTariff(false)} title={`Тариф занятий с ${currentTrainer?.name ?? ''}`}>
        <TariffPicker
          currentTariff={client.tariff}
          onSelect={(tariff) => {
            createCashOrder.mutate(
              { clientId: client.id, lines: [{ type: 'TARIFF_CHANGE', meta: { tariff, trainerId: client.trainerId ?? undefined } }] },
              { onSuccess: setPendingOrder },
            )
            setChangingTariff(false)
          }}
        />
      </Modal>

      <TrainerProfileModal trainer={viewingProfile} onClose={() => setViewingProfile(null)} />
    </div>
  )
}
