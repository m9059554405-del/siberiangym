import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import QRCode from 'qrcode'
import { CalendarCheck, CreditCard, History, MessageCircle, Send, Sparkles, TicketPercent } from 'lucide-react'
import {
  useMarkDirectorMessagesSeen,
  useMe,
  useOwnDirectorMessages,
  usePricing,
  useSendDirectorMessage,
  useTrainers,
} from '../../hooks/useClientApi'
import { useCreateCashOrder, useCreateOnlineOrder, useMyOrders, useOnlinePaymentsEnabled } from '../../hooks/useOrdersApi'
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
  const qc = useQueryClient()
  const { data: client } = useMe()
  const { data: pricing } = usePricing()
  const { data: trainers } = useTrainers()
  const { data: messages } = useOwnDirectorMessages()
  const { data: myOrders } = useMyOrders(15_000)
  const createCashOrder = useCreateCashOrder()
  // P2.9: кнопка онлайн-оплаты появляется только когда эквайринг настроен
  // на клуб (ACQUIRING_* в окружении API) — до этого клиенту доступна
  // только оплата через администратора (осознанное ограничение MVP).
  const onlinePayments = useOnlinePaymentsEnabled()
  const createOnlineOrder = useCreateOnlineOrder()
  const sendMessage = useSendDirectorMessage()
  const markSeen = useMarkDirectorMessagesSeen()

  const [feedbackText, setFeedbackText] = useState('')
  const [feedbackSent, setFeedbackSent] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [pendingOrder, setPendingOrder] = useState<Order | null>(null)
  const [orderError, setOrderError] = useState<string | null>(null)

  const pendingMembershipKeys = new Set(
    (myOrders ?? [])
      .filter((o) => o.status === 'DRAFT' || o.status === 'AWAITING_PAYMENT')
      .flatMap((o) => o.lines)
      .filter((l) => l.type === 'MEMBERSHIP_PURCHASE' && l.meta && typeof l.meta.membershipType === 'string')
      .map((l) => `${l.meta!.membershipType as string}:${typeof l.meta!.scope === 'string' ? l.meta!.scope : 'SINGLE_GYM'}`),
  )
  const pendingKey = [...pendingMembershipKeys].sort().join(',')

  useEffect(() => {
    qc.invalidateQueries({ queryKey: ['me'] })
  }, [pendingKey, qc])

  // Код прохода (P2.2) живёт в плашке текущего абонемента: персональный
  // QR строится на устройстве из id клиента (`sgym-checkin:<id>`) и не
  // требует сети в момент показа — администратор сканирует его на входе.
  const clientId = client?.id
  const [checkinQrUrl, setCheckinQrUrl] = useState<string | null>(null)
  const [checkinQrOpen, setCheckinQrOpen] = useState(false)
  useEffect(() => {
    if (!clientId) return
    let alive = true
    QRCode.toDataURL(`sgym-checkin:${clientId}`, {
      margin: 1,
      width: 600,
      color: { dark: '#111827', light: '#ffffff' },
    })
      .then((url) => {
        if (alive) setCheckinQrUrl(url)
      })
      .catch(() => {
        if (alive) setCheckinQrUrl(null)
      })
    return () => {
      alive = false
    }
  }, [clientId])

  function purchaseMembership(type: MembershipType, scope: 'SINGLE_GYM' | 'NETWORK' = 'SINGLE_GYM') {
    if (!client) return
    createCashOrder.mutate(
      { clientId: client.id, lines: [{ type: 'MEMBERSHIP_PURCHASE', meta: { membershipType: type, scope } }] },
      {
        onSuccess: (order) => {
          setPendingOrder(order)
          setOrderError(null)
        },
        onError: (err) => setOrderError(err instanceof Error ? err.message : 'Не удалось оформить заказ'),
      },
    )
  }

  // P2.9: заказ уходит на оплату картой и браузер перенаправляется на
  // платёжную страницу банка; статус применится вебхуком по возвращении.
  function purchaseMembershipOnline(type: MembershipType) {
    if (!client) return
    createOnlineOrder.mutate(
      { clientId: client.id, lines: [{ type: 'MEMBERSHIP_PURCHASE', meta: { membershipType: type, scope: 'SINGLE_GYM' } }] },
      {
        onSuccess: (order) => {
          if (order.paymentUrl) window.location.href = order.paymentUrl
        },
        onError: (err) => setOrderError(err instanceof Error ? err.message : 'Не удалось оформить онлайн-оплату'),
      },
    )
  }

  function changeTariff(tariff: Tariff) {
    if (!client) return
    createCashOrder.mutate(
      { clientId: client.id, lines: [{ type: 'TARIFF_CHANGE', meta: { tariff } }] },
      {
        onSuccess: (order) => {
          setPendingOrder(order)
          setOrderError(null)
        },
        onError: (err) => setOrderError(err instanceof Error ? err.message : 'Не удалось оформить заказ'),
      },
    )
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

      {orderError && (
        <Card className="flex items-center justify-between gap-2 text-sm text-red-600">
          <span>{orderError}</span>
          <button onClick={() => setOrderError(null)} className="tap-scale font-medium underline">
            Закрыть
          </button>
        </Card>
      )}

      <Card className="relative text-white" style={{ background: 'var(--accent-gradient)', border: 'none' }}>
        <div className="flex items-start justify-between">
          <div>
            <div className="text-xs uppercase tracking-wide text-white/70">Текущий абонемент</div>
            <div className="mt-1 text-lg font-semibold">
              {currentLabel?.title ?? 'Нет абонемента'}
              {client.membership?.scope === 'NETWORK' && <span className="ml-1.5 text-sm font-normal text-white/80">· вся сеть</span>}
            </div>
          </div>
          {status && <Badge tone={status.tone}>{status.label}</Badge>}
        </div>
        <div className="mt-3 flex flex-wrap gap-4 pr-20 text-sm text-white/90">
          {client.membership?.expiresAt && <div>Действует до {client.membership.expiresAt.slice(0, 10)}</div>}
          {client.membership?.visitsLeft != null && (
            <div>
              Осталось занятий: {client.membership.visitsLeft} из {client.membership.visitsTotal}
            </div>
          )}
        </div>
        {trainer ? (
          <div className="mt-3 pr-20 text-sm text-white/85">
            Ваш тренер: <span className="font-medium">{trainer.name}</span>
            {tariffById(client.tariff) && <> · тариф «{tariffById(client.tariff)!.name}»</>}
          </div>
        ) : (
          <div className="mt-3 pr-20 text-sm text-white/85">Формат: самостоятельные тренировки</div>
        )}
        {checkinQrUrl && (
          <button
            type="button"
            onClick={() => setCheckinQrOpen(true)}
            aria-label="Показать QR на весь экран"
            className="tap-scale absolute bottom-3 right-3 cursor-zoom-in rounded-lg bg-white p-1 shadow-md"
          >
            <img src={checkinQrUrl} alt="QR для входа" width={64} height={64} />
          </button>
        )}
        {checkinQrOpen && checkinQrUrl && (
          <div
            role="presentation"
            onClick={() => setCheckinQrOpen(false)}
            className="fixed inset-0 z-50 flex cursor-zoom-out flex-col items-center justify-center gap-4 bg-black/80 p-6"
          >
            <div className="rounded-3xl bg-white p-5 shadow-2xl">
              <img src={checkinQrUrl} alt="QR для входа" className="h-[min(70vw,320px)] w-[min(70vw,320px)]" />
            </div>
            <div className="text-center text-sm text-white/90">
              Покажите этот код администратору на входе
              <div className="mt-1 text-xs text-white/60">Нажмите, чтобы закрыть</div>
            </div>
          </div>
        )}
      </Card>

      <section>
        <SectionTitle title="Абонементы" subtitle="Выберите подходящий вариант — вступит в силу сразу" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {(Object.keys(MEMBERSHIP_LABELS) as MembershipType[]).map((type) => {
            const info = MEMBERSHIP_LABELS[type]
            const Icon = info.icon
            const isActive = client.membership?.type === type && client.membership?.status === 'ACTIVE'
            const isCurrentSingle = isActive && (client.membership?.scope ?? 'SINGLE_GYM') === 'SINGLE_GYM'
            const isCurrentNetwork = isActive && client.membership?.scope === 'NETWORK'
            const isPendingMembership = pendingMembershipKeys.has(`${type}:SINGLE_GYM`)
            const isPendingNetwork = pendingMembershipKeys.has(`${type}:NETWORK`)
            const priceKey = type.toLowerCase() as 'single' | 'monthly' | 'pack10' | 'pack20'
            const networkPriceKey = `${priceKey}Network` as const
            const networkPrice = pricing[networkPriceKey]
            return (
              <Card key={type} className="flex h-full flex-col gap-2">
                <div className="flex items-center gap-2 text-[var(--accent-strong)]">
                  <Icon size={17} />
                  <span className="text-sm font-semibold text-[var(--text)]">{info.title}</span>
                </div>
                <p className="flex-1 text-xs text-[var(--text-muted)]">{info.desc}</p>
                <div className="mt-auto flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-bold">{formatMoney(pricing[priceKey])} ₽</span>
                    <Button
                      size="sm"
                      variant={isCurrentSingle || isPendingMembership ? 'secondary' : 'primary'}
                      disabled={isCurrentSingle || isPendingMembership || createCashOrder.isPending}
                      onClick={() => purchaseMembership(type, 'SINGLE_GYM')}
                    >
                      {isCurrentSingle ? 'Активен' : isPendingMembership ? 'На проверке' : 'Купить'}
                    </Button>
                  </div>
                  {onlinePayments.data?.enabled && (
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={isCurrentSingle || isPendingMembership || createOnlineOrder.isPending}
                      onClick={() => purchaseMembershipOnline(type)}
                    >
                      Оплатить картой онлайн
                    </Button>
                  )}
                  {networkPrice != null && (
                    <div className="flex items-center justify-between border-t border-[var(--border)] pt-1.5">
                      <span className="text-xs text-[var(--text-muted)]">Вся сеть — {formatMoney(networkPrice)} ₽</span>
                      <Button
                        size="sm"
                        variant={isCurrentNetwork || isPendingNetwork ? 'secondary' : 'ghost'}
                        disabled={isCurrentNetwork || isPendingNetwork || createCashOrder.isPending}
                        onClick={() => purchaseMembership(type, 'NETWORK')}
                      >
                        {isCurrentNetwork ? 'Активен' : isPendingNetwork ? 'На проверке' : 'Купить'}
                      </Button>
                    </div>
                  )}
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
