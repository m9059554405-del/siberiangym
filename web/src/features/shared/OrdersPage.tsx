import { useState } from 'react'
import { Receipt, FlaskConical, RotateCcw, Search, X } from 'lucide-react'
import { useCancelOrder, useConfirmReceipt, useOpenOrders, usePaidOrders, useSubmitCash, useTestCompleteOrder } from '../../hooks/useOrdersApi'
import { useCancelRefund, useConfirmRefundReceipt, useOpenRefunds, useRequestRefund } from '../../hooks/useRefundsApi'
import { useAllClients } from '../../hooks/useStaffApi'
import { Avatar } from '../../components/ui/Avatar'
import { Badge, Button, Card, EmptyState, SectionTitle, Tabs } from '../../components/ui/Primitives'
import { Modal } from '../../components/ui/Modal'
import { ReceiptScanPanel } from '../../components/ReceiptScanPanel'
import { formatMoney, getInitials } from '../../lib/format'
import { playBeep, playDoubleBeep } from '../../lib/beep'
import { useAuthStore } from '../../store/useAuthStore'
import type { Order, OrderLineType, Refund } from '../../types'

const LINE_TYPE_LABEL: Record<OrderLineType, string> = {
  MEMBERSHIP_PURCHASE: 'Абонемент',
  MEMBERSHIP_RENEWAL: 'Продление абонемента',
  TARIFF_CHANGE: 'Тариф с тренером',
  STOCK_PURCHASE: 'Товар',
  LOCKER_RENTAL: 'Аренда шкафчика',
  GROUP_CLASS_BOOKING: 'Групповое занятие',
  PERSONAL_SLOT_BOOKING: 'Персональная тренировка',
}

function minutesLeft(expiresAt: string | null): number | null {
  if (!expiresAt) return null
  return Math.max(0, Math.round((new Date(expiresAt).getTime() - Date.now()) / 60000))
}

function orderSummary(order: Order): string {
  return order.lines.map((l) => LINE_TYPE_LABEL[l.type]).join(' + ')
}

// Очередь незакрытых заказов и возвратов точки (P0.2/P0.7) — администратор
// пробивает реальный чек на кассе на сумму заказа/возврата, сканирует
// QR/штрихкод и только тогда заказ закрывается или деньги считаются
// возвращёнными: до этого момента ничего не применено и не откачено.
export function OrdersPage() {
  const [tab, setTab] = useState<'orders' | 'refunds'>('orders')

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-xl font-bold">Заказы</h1>
        <p className="text-sm text-[var(--text-muted)]">
          Оплата и возврат подтверждаются сканированием реального кассового чека, ничего не применяется раньше
        </p>
      </div>

      <Tabs
        value={tab}
        onChange={setTab}
        options={[
          { value: 'orders', label: 'Ожидают оплаты' },
          { value: 'refunds', label: 'Возвраты' },
        ]}
      />

      {tab === 'orders' ? <OpenOrdersSection /> : <RefundsSection />}
    </div>
  )
}

function OpenOrdersSection() {
  const { data: orders } = useOpenOrders()
  const submitCash = useSubmitCash()
  const confirmReceipt = useConfirmReceipt()
  const cancelOrder = useCancelOrder()
  const testComplete = useTestCompleteOrder()
  const isCeo = useAuthStore((s) => s.user?.role === 'CEO')

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [cancelling, setCancelling] = useState(false)
  const [cancelReason, setCancelReason] = useState('')

  const selected = (orders ?? []).find((o) => o.id === selectedId) ?? null

  function openOrder(order: Order) {
    setSelectedId(order.id)
    setErrorMessage(null)
    setCancelling(false)
    setCancelReason('')
  }

  function closeModal() {
    setSelectedId(null)
  }

  function submitScan(raw: string) {
    if (!selected) return
    confirmReceipt.mutate(
      { orderId: selected.id, qrRaw: raw },
      {
        onSuccess: () => {
          playBeep(1200, 140)
          closeModal()
        },
        onError: (err) => {
          playDoubleBeep()
          setErrorMessage(err instanceof Error ? err.message : 'Не удалось подтвердить чек')
        },
      },
    )
  }

  function submitCancel() {
    if (!selected) return
    cancelOrder.mutate({ orderId: selected.id, reason: cancelReason.trim() || undefined }, { onSuccess: closeModal })
  }

  const openList = orders ?? []

  return (
    <>
      <Card>
        <SectionTitle title="Ожидают оплаты" subtitle={`${openList.length} шт.`} />
        <div className="flex flex-col gap-2">
          {openList.map((order) => {
            const mins = minutesLeft(order.expiresAt)
            return (
              <div
                key={order.id}
                role="button"
                tabIndex={0}
                onClick={() => openOrder(order)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') openOrder(order)
                }}
                className="tap-scale flex cursor-pointer flex-wrap items-center justify-between gap-3 rounded-lg bg-[var(--surface-sunken)] px-3 py-2.5 text-left"
              >
                <div className="flex items-center gap-2.5">
                  {order.client && <Avatar initials={getInitials(order.client.name)} hue={order.client.avatarHue} size={34} />}
                  <div>
                    <div className="text-sm font-medium">{order.client?.name ?? order.clientId}</div>
                    <div className="text-xs text-[var(--text-faint)]">{orderSummary(order)}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {order.status === 'DRAFT' ? (
                    <Badge tone="neutral">черновик</Badge>
                  ) : (
                    <Badge tone={mins !== null && mins <= 15 ? 'warning' : 'accent'}>{mins !== null ? `истекает через ${mins} мин.` : 'ожидает оплаты'}</Badge>
                  )}
                  {isCeo && (
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={testComplete.isPending && testComplete.variables === order.id}
                      onClick={(e) => {
                        e.stopPropagation()
                        testComplete.mutate(order.id, { onError: () => playDoubleBeep() })
                      }}
                    >
                      <FlaskConical size={14} /> Тестовая проводка
                    </Button>
                  )}
                  <span className="text-sm font-semibold">{formatMoney(order.totalAmount)} ₽</span>
                </div>
              </div>
            )
          })}
          {openList.length === 0 && <EmptyState title="Открытых заказов нет" subtitle="Все заказы точки закрыты или ещё не созданы" />}
        </div>
      </Card>

      <Modal open={!!selected} onClose={closeModal} title={selected?.client?.name ?? 'Заказ'}>
        {selected && (
          <div className="flex flex-col gap-4">
            <div className="rounded-lg bg-[var(--surface-sunken)] p-3">
              <div className="flex flex-col gap-1 text-sm">
                {selected.lines.map((l) => (
                  <div key={l.id} className="flex items-center justify-between">
                    <span className="text-[var(--text-muted)]">{LINE_TYPE_LABEL[l.type]}</span>
                    <span>{formatMoney(l.amount)} ₽</span>
                  </div>
                ))}
              </div>
              <div className="mt-2 flex items-center justify-between border-t border-[var(--border)] pt-2 text-base font-semibold">
                <span>Итого</span>
                <span>{formatMoney(selected.totalAmount)} ₽</span>
              </div>
            </div>

            {selected.status === 'DRAFT' ? (
              <Button onClick={() => submitCash.mutate(selected.id)} disabled={submitCash.isPending}>
                <Receipt size={15} /> Отправить на оплату наличными
              </Button>
            ) : selected.paymentMethod === 'CARD_ONLINE' && !cancelling ? (
              // P2.9: онлайн-заказ закрывает вебхук банка — скан чека кассира
              // по нему недоступен (API тоже откажет), персонал может только
              // отменить зависший заказ.
              <>
                <div className="rounded-xl bg-[var(--surface-sunken)] px-4 py-3 text-sm text-[var(--text-muted)]">
                  Клиент оплачивает картой онлайн — заказ закроется автоматически подтверждением банка. Скан чека недоступен.
                </div>
                <Button variant="danger" onClick={() => setCancelling(true)}>
                  <X size={14} /> Отменить заказ
                </Button>
              </>
            ) : !cancelling ? (
              <>
                <ReceiptScanPanel onSubmit={submitScan} isPending={confirmReceipt.isPending} errorMessage={errorMessage} onErrorChange={setErrorMessage} />
                <Button variant="danger" onClick={() => setCancelling(true)}>
                  <X size={14} /> Отменить заказ
                </Button>
              </>
            ) : (
              <div className="flex flex-col gap-2">
                <input
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="Причина отмены (необязательно)"
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
                />
                <div className="flex gap-2">
                  <Button variant="secondary" className="flex-1" onClick={() => setCancelling(false)}>
                    Назад
                  </Button>
                  <Button variant="danger" className="flex-1" onClick={submitCancel} disabled={cancelOrder.isPending}>
                    Подтвердить отмену
                  </Button>
                </div>
              </div>
            )}

            {isCeo && !cancelling && (
              <Button
                variant="secondary"
                disabled={testComplete.isPending}
                onClick={() =>
                  testComplete.mutate(selected.id, {
                    onSuccess: closeModal,
                    onError: (err) => {
                      playDoubleBeep()
                      setErrorMessage(err instanceof Error ? err.message : 'Не удалось выполнить тестовую проводку')
                    },
                  })
                }
              >
                <FlaskConical size={14} /> Тестовая проводка
              </Button>
            )}
          </div>
        )}
      </Modal>
    </>
  )
}

function RefundsSection() {
  return (
    <div className="flex flex-col gap-5">
      <RequestRefundCard />
      <OpenRefundsCard />
    </div>
  )
}

// Поиск оплаченного заказа клиента и запрос возврата по нему — только
// запрос, ничего не откатывается, пока чек возврата не отсканирован (см. OpenRefundsCard).
function RequestRefundCard() {
  const { data: clients } = useAllClients()
  const [search, setSearch] = useState('')
  const [clientId, setClientId] = useState<string | null>(null)
  const { data: paidOrders } = usePaidOrders(clientId ?? undefined)
  const requestRefund = useRequestRefund()
  const [reasonByOrder, setReasonByOrder] = useState<Record<string, string>>({})
  const [requestedId, setRequestedId] = useState<string | null>(null)

  const q = search.trim().toLowerCase()
  const matches = q ? (clients ?? []).filter((c) => c.name.toLowerCase().includes(q)).slice(0, 8) : []

  return (
    <Card>
      <SectionTitle title="Оформить возврат" subtitle="Найдите клиента и оплаченный заказ, по которому нужно вернуть деньги" />
      <div className="relative">
        <div className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] px-3 py-2">
          <Search size={14} className="text-[var(--text-faint)]" />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setClientId(null)
            }}
            placeholder="Имя клиента…"
            className="flex-1 bg-transparent text-sm outline-none"
          />
        </div>
        {matches.length > 0 && !clientId && (
          <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] shadow-lg">
            {matches.map((c) => (
              <button
                key={c.id}
                onClick={() => {
                  setClientId(c.id)
                  setSearch(c.name)
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-[var(--surface-sunken)]"
              >
                <Avatar initials={getInitials(c.name)} hue={c.avatarHue} size={24} />
                {c.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {clientId && (
        <div className="mt-3 flex flex-col gap-2">
          {(paidOrders ?? []).length === 0 && <EmptyState title="Нет оплаченных заказов" subtitle="У этого клиента ещё нет ни одного закрытого заказа" />}
          {(paidOrders ?? []).map((order) => (
            <div key={order.id} className="flex flex-col gap-2 rounded-lg bg-[var(--surface-sunken)] px-3 py-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm">
                  <div className="font-medium">{orderSummary(order)}</div>
                  <div className="text-xs text-[var(--text-faint)]">{order.paidAt?.slice(0, 10)}</div>
                </div>
                <span className="text-sm font-semibold">{formatMoney(order.totalAmount)} ₽</span>
              </div>
              {requestedId === order.id ? (
                <Badge tone="success">Возврат запрошен ✓ — см. вкладку «Ожидают чека возврата»</Badge>
              ) : (
                <div className="flex items-center gap-2">
                  <input
                    value={reasonByOrder[order.id] ?? ''}
                    onChange={(e) => setReasonByOrder((m) => ({ ...m, [order.id]: e.target.value }))}
                    placeholder="Причина возврата"
                    className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] px-2.5 py-1.5 text-sm outline-none focus:border-[var(--accent)]"
                  />
                  <Button
                    size="sm"
                    variant="danger"
                    disabled={!reasonByOrder[order.id]?.trim() || requestRefund.isPending}
                    onClick={() =>
                      requestRefund.mutate(
                        { orderId: order.id, reason: reasonByOrder[order.id].trim() },
                        { onSuccess: () => setRequestedId(order.id) },
                      )
                    }
                  >
                    <RotateCcw size={13} /> Запросить возврат
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}

function OpenRefundsCard() {
  const { data: refunds } = useOpenRefunds()
  const confirmReceipt = useConfirmRefundReceipt()
  const cancelRefund = useCancelRefund()

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const list = refunds ?? []
  const selected = list.find((r) => r.id === selectedId) ?? null

  function open(refund: Refund) {
    setSelectedId(refund.id)
    setErrorMessage(null)
  }

  function submitScan(raw: string) {
    if (!selected) return
    confirmReceipt.mutate(
      { refundId: selected.id, qrRaw: raw },
      {
        onSuccess: () => {
          playBeep(1200, 140)
          setSelectedId(null)
        },
        onError: (err) => {
          playDoubleBeep()
          setErrorMessage(err instanceof Error ? err.message : 'Не удалось подтвердить чек возврата')
        },
      },
    )
  }

  return (
    <Card>
      <SectionTitle title="Ожидают чека возврата" subtitle={`${list.length} шт.`} />
      <div className="flex flex-col gap-2">
        {list.map((refund) => (
          <button
            key={refund.id}
            onClick={() => open(refund)}
            className="tap-scale flex flex-wrap items-center justify-between gap-3 rounded-lg bg-[var(--surface-sunken)] px-3 py-2.5 text-left"
          >
            <div className="flex items-center gap-2.5">
              {refund.order?.client && <Avatar initials={getInitials(refund.order.client.name)} hue={refund.order.client.avatarHue} size={34} />}
              <div>
                <div className="text-sm font-medium">{refund.order?.client?.name ?? refund.orderId}</div>
                <div className="text-xs text-[var(--text-faint)]">{refund.reason}</div>
              </div>
            </div>
            <span className="text-sm font-semibold text-red-600">−{formatMoney(refund.amount)} ₽</span>
          </button>
        ))}
        {list.length === 0 && <EmptyState title="Нет возвратов, ожидающих чека" />}
      </div>

      <Modal open={!!selected} onClose={() => setSelectedId(null)} title={selected?.order?.client?.name ?? 'Возврат'}>
        {selected && (
          <div className="flex flex-col gap-4">
            <div className="rounded-lg bg-[var(--surface-sunken)] p-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-[var(--text-muted)]">Причина</span>
                <span>{selected.reason}</span>
              </div>
              <div className="mt-2 flex items-center justify-between border-t border-[var(--border)] pt-2 text-base font-semibold">
                <span>К возврату</span>
                <span>{formatMoney(selected.amount)} ₽</span>
              </div>
            </div>
            <ReceiptScanPanel
              onSubmit={submitScan}
              isPending={confirmReceipt.isPending}
              errorMessage={errorMessage}
              onErrorChange={setErrorMessage}
              label="Подтверждение чека возврата (n=2)"
            />
            <Button variant="danger" onClick={() => cancelRefund.mutate(selected.id, { onSuccess: () => setSelectedId(null) })} disabled={cancelRefund.isPending}>
              <X size={14} /> Отменить запрос на возврат
            </Button>
          </div>
        )}
      </Modal>
    </Card>
  )
}
