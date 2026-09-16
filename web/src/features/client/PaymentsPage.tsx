import { useState } from 'react'
import { CalendarCheck, CreditCard, History, MessageCircle, Send, Sparkles, TicketPercent } from 'lucide-react'
import {
  useMarkDirectorMessagesSeen,
  useMe,
  useOwnDirectorMessages,
  usePricing,
  useSendDirectorMessage,
  useTrainers,
} from '../../hooks/useClientApi'
import { useCreateCashOrder } from '../../hooks/useOrdersApi'
import { tariffById } from '../../data/tariffs'
import { Badge, Button, Card, EmptyState, SectionTitle } from '../../components/ui/Primitives'
import { TariffPicker } from '../../components/TariffPicker'
import { OrderPendingNotice } from '../../components/OrderPendingNotice'
import { PersonalDataSection } from '../../components/PersonalDataSection'
import { formatMoney } from '../../lib/format'
import type { MembershipType, Order, Tariff } from '../../types'

const MEMBERSHIP_LABELS: Record<MembershipType, { title: string; desc: string; icon: typeof CreditCard }> = {
  SINGLE: { title: 'Разовое занятие', desc: 'Один визит в клуб без абонемента', icon: TicketPercent },
  MONTHLY: { title: 'Абонемент на месяц', desc: 'Безлимитные посещения 30 дней', icon: CalendarCheck },
  PACK10: { title: 'Пакет на 10 занятий', desc: 'Действует 90 дней с момента покупки', icon: Sparkles },
  PACK20: { title: 'Пакет на 20 занятий', desc: 'Выгоднее, действует 120 дней', icon: Sparkles },
}

const STATUS_LABEL: Record<string, { label: string; tone: 'success' | 'warning' | 'danger' }> = {
  ACTIVE: { label: 'Активен', tone: 'success' },
  EXPIRED: { label: 'Истёк', tone: 'danger' },
  FROZEN: { label: 'Заморожен', tone: 'warning' },
}

export function PaymentsPage() {
  const { data: client } = useMe()
  const { data: pricing } = usePricing()
  const { data: trainers } = useTrainers()
  const { data: messages } = useOwnDirectorMessages()
  const createCashOrder = useCreateCashOrder()
  const sendMessage = useSendDirectorMessage()
  const markSeen = useMarkDirectorMessagesSeen()

  const [feedbackText, setFeedbackText] = useState('')
  const [feedbackSent, setFeedbackSent] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [pendingOrder, setPendingOrder] = useState<Order | null>(null)

  function purchaseMembership(type: MembershipType) {
    if (!client) return
    createCashOrder.mutate({ clientId: client.id, lines: [{ type: 'MEMBERSHIP_PURCHASE', meta: { membershipType: type } }] }, { onSuccess: setPendingOrder })
  }

  function changeTariff(tariff: Tariff) {
    if (!client) return
    createCashOrder.mutate({ clientId: client.id, lines: [{ type: 'TARIFF_CHANGE', meta: { tariff } }] }, { onSuccess: setPendingOrder })
  }

  if (!client || !pricing) return null

  const myMessages = [...(messages ?? [])]
  const unreadCount = myMessages.filter((m) => m.reply && !m.replySeenByClient).length

  function toggleHistory() {
    setShowHistory((v) => {
      const next = !v
      if (next) markSeen.mutate()
      return next
    })
  }

  function submitFeedback() {
    const text = feedbackText.trim()
    if (!text) return
    sendMessage.mutate(text, {
      onSuccess: () => {
        setFeedbackText('')
        setFeedbackSent(true)
        setTimeout(() => setFeedbackSent(false), 2500)
      },
    })
  }

  const trainer = trainers?.find((t) => t.id === client.trainerId)
  const status = client.membership ? STATUS_LABEL[client.membership.status] : undefined
  const currentLabel = client.membership ? MEMBERSHIP_LABELS[client.membership.type] : undefined

  return (
    <div className="flex flex-col gap-5 pt-1">
      <div>
        <h1 className="text-xl font-bold">Привет, {client.name.split(' ')[0]}!</h1>
        <p className="text-sm text-[var(--text-muted)]">Управляйте абонементом и оплатами клуба</p>
      </div>

      {pendingOrder && <OrderPendingNotice order={pendingOrder} onDismiss={() => setPendingOrder(null)} />}

      <Card className="text-white" style={{ background: 'var(--accent-gradient)', border: 'none' }}>
        <div className="flex items-start justify-between">
          <div>
            <div className="text-xs uppercase tracking-wide text-white/70">Текущий абонемент</div>
            <div className="mt-1 text-lg font-semibold">{currentLabel?.title ?? 'Нет абонемента'}</div>
          </div>
          {status && <Badge tone={status.tone}>{status.label}</Badge>}
        </div>
        <div className="mt-3 flex flex-wrap gap-4 text-sm text-white/90">
          {client.membership?.expiresAt && <div>Действует до {client.membership.expiresAt.slice(0, 10)}</div>}
          {client.membership?.visitsLeft != null && (
            <div>
              Осталось занятий: {client.membership.visitsLeft} из {client.membership.visitsTotal}
            </div>
          )}
        </div>
        {trainer ? (
          <div className="mt-3 text-sm text-white/85">
            Ваш тренер: <span className="font-medium">{trainer.name}</span>
            {tariffById(client.tariff) && <> · тариф «{tariffById(client.tariff)!.name}»</>}
          </div>
        ) : (
          <div className="mt-3 text-sm text-white/85">Формат: самостоятельные тренировки</div>
        )}
      </Card>

      <section>
        <SectionTitle title="Абонементы" subtitle="Выберите подходящий вариант — вступит в силу сразу" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {(Object.keys(MEMBERSHIP_LABELS) as MembershipType[]).map((type) => {
            const info = MEMBERSHIP_LABELS[type]
            const Icon = info.icon
            const isCurrent = client.membership?.type === type && client.membership?.status === 'ACTIVE'
            const priceKey = type.toLowerCase() as 'single' | 'monthly' | 'pack10' | 'pack20'
            return (
              <Card key={type} className="flex h-full flex-col gap-2">
                <div className="flex items-center gap-2 text-[var(--accent-strong)]">
                  <Icon size={17} />
                  <span className="text-sm font-semibold text-[var(--text)]">{info.title}</span>
                </div>
                <p className="flex-1 text-xs text-[var(--text-muted)]">{info.desc}</p>
                <div className="mt-auto flex items-center justify-between">
                  <span className="text-lg font-bold">{formatMoney(pricing[priceKey])} ₽</span>
                  <Button
                    size="sm"
                    variant={isCurrent ? 'secondary' : 'primary'}
                    disabled={isCurrent || createCashOrder.isPending}
                    onClick={() => purchaseMembership(type)}
                  >
                    {isCurrent ? 'Активен' : 'Купить'}
                  </Button>
                </div>
              </Card>
            )
          })}
        </div>
      </section>

      <section>
        <SectionTitle
          title="Тариф сопровождения"
          subtitle={trainer ? 'Выберите уровень работы с тренером' : 'Доступно при выборе тренера — сейчас вы тренируетесь самостоятельно'}
        />
        {trainer ? (
          <TariffPicker currentTariff={client.tariff} onSelect={changeTariff} />
        ) : (
          <Card className="text-sm text-[var(--text-muted)]">Чтобы выбрать тариф, сначала выберите тренера во вкладке «Тренер».</Card>
        )}
      </section>

      <section>
        <SectionTitle title="Персональные и групповые тренировки" subtitle="Оплата происходит при записи на слот или занятие" />
        <div className="grid grid-cols-2 gap-3 text-sm">
          <Card>
            <div className="text-[var(--text-muted)]">Перс. тренировка (разово)</div>
            <div className="text-lg font-semibold">{formatMoney(trainer ? trainer.personalSessionPrice : pricing.personalSingle)} ₽</div>
          </Card>
          <Card>
            <div className="text-[var(--text-muted)]">Пакет перс. ×5</div>
            <div className="text-lg font-semibold">{formatMoney(pricing.personalPack5)} ₽</div>
          </Card>
          <Card>
            <div className="text-[var(--text-muted)]">Групповая (разово)</div>
            <div className="text-lg font-semibold">{formatMoney(pricing.groupSingle)} ₽</div>
          </Card>
          <Card>
            <div className="text-[var(--text-muted)]">Групповые (абонемент)</div>
            <div className="text-lg font-semibold">{formatMoney(pricing.groupMonthly)} ₽</div>
          </Card>
        </div>
        <p className="mt-2 text-xs text-[var(--text-faint)]">Запись и оплата персональных и групповых тренировок — во вкладке «Календарь».</p>
      </section>

      <section>
        <SectionTitle
          title="Обратная связь директору"
          subtitle="Пишите напрямую — сообщения видит директор клуба"
          action={
            <Button size="sm" variant="secondary" className="whitespace-nowrap" onClick={toggleHistory}>
              <History size={13} /> История
              {unreadCount > 0 && <Badge tone="danger">{unreadCount}</Badge>}
            </Button>
          }
        />
        {showHistory ? (
          myMessages.length > 0 ? (
            <div className="flex flex-col gap-2">
              {myMessages.map((m) => (
                <Card key={m.id} className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between text-xs text-[var(--text-faint)]">
                    <span>{m.date.slice(0, 16).replace('T', ', ')}</span>
                  </div>
                  <p className="text-sm">{m.text}</p>
                  {m.reply ? (
                    <div className="rounded-lg bg-[var(--accent-soft)] px-3 py-2 text-sm text-[var(--accent-strong)]">
                      <div className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide opacity-80">Ответ директора</div>
                      {m.reply}
                    </div>
                  ) : (
                    <Badge tone="neutral">Ожидает ответа</Badge>
                  )}
                </Card>
              ))}
            </div>
          ) : (
            <EmptyState title="Обращений пока нет" />
          )
        ) : (
          <Card className="flex flex-col gap-3">
            <div className="flex items-start gap-2">
              <MessageCircle size={17} className="mt-1 shrink-0 text-[var(--accent-strong)]" />
              <textarea
                value={feedbackText}
                onChange={(e) => setFeedbackText(e.target.value)}
                placeholder="Расскажите, что понравилось или что можно улучшить в клубе…"
                rows={3}
                className="flex-1 resize-none rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-[var(--text-faint)]">{feedbackSent ? 'Сообщение отправлено директору ✓' : 'Директор отвечает лично на все обращения'}</span>
              <Button size="sm" onClick={submitFeedback} disabled={!feedbackText.trim() || sendMessage.isPending}>
                <Send size={13} /> Отправить
              </Button>
            </div>
          </Card>
        )}
      </section>

      <PersonalDataSection />
    </div>
  )
}
