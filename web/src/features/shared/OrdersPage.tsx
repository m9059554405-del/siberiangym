import { useEffect, useRef, useState } from 'react'
import { Camera, Keyboard, Receipt, X } from 'lucide-react'
import { useCancelOrder, useConfirmReceipt, useOpenOrders, useSubmitCash } from '../../hooks/useOrdersApi'
import { Avatar } from '../../components/ui/Avatar'
import { Badge, Button, Card, EmptyState, SectionTitle } from '../../components/ui/Primitives'
import { Modal } from '../../components/ui/Modal'
import { QrCameraScanner } from '../../components/QrCameraScanner'
import { formatMoney, getInitials } from '../../lib/format'
import { playBeep, playDoubleBeep } from '../../lib/beep'
import type { Order, OrderLineType } from '../../types'

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

// Очередь незакрытых заказов на точке (P0.2) — администратор пробивает
// реальный чек на кассе на сумму заказа, сканирует QR/штрихкод (обычным
// USB/BT-сканером, который работает как клавиатура — просто фокус на поле
// ввода, — либо камерой устройства) и только тогда заказ закрывается: до
// этого момента ничего из заказа (абонемент, бронь, аренда) не применено.
export function OrdersPage() {
  const { data: orders } = useOpenOrders()
  const submitCash = useSubmitCash()
  const confirmReceipt = useConfirmReceipt()
  const cancelOrder = useCancelOrder()

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [qrValue, setQrValue] = useState('')
  const [useCamera, setUseCamera] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [cancelling, setCancelling] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const selected = (orders ?? []).find((o) => o.id === selectedId) ?? null

  useEffect(() => {
    if (selected && !useCamera) inputRef.current?.focus()
  }, [selected, useCamera])

  function openOrder(order: Order) {
    setSelectedId(order.id)
    setQrValue('')
    setErrorMessage(null)
    setUseCamera(false)
    setCancelling(false)
    setCancelReason('')
  }

  function closeModal() {
    setSelectedId(null)
  }

  function submitScan(raw: string) {
    if (!selected || !raw.trim()) return
    confirmReceipt.mutate(
      { orderId: selected.id, qrRaw: raw.trim() },
      {
        onSuccess: () => {
          playBeep(1200, 140)
          closeModal()
        },
        onError: (err) => {
          playDoubleBeep()
          setErrorMessage(err instanceof Error ? err.message : 'Не удалось подтвердить чек')
          setQrValue('')
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
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-xl font-bold">Заказы</h1>
        <p className="text-sm text-[var(--text-muted)]">
          Незакрытые заказы точки — оплата подтверждается сканированием реального кассового чека, ничего не применяется раньше
        </p>
      </div>

      <Card>
        <SectionTitle title="Ожидают оплаты" subtitle={`${openList.length} шт.`} />
        <div className="flex flex-col gap-2">
          {openList.map((order) => {
            const mins = minutesLeft(order.expiresAt)
            return (
              <button
                key={order.id}
                onClick={() => openOrder(order)}
                className="tap-scale flex flex-wrap items-center justify-between gap-3 rounded-lg bg-[var(--surface-sunken)] px-3 py-2.5 text-left"
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
                  <span className="text-sm font-semibold">{formatMoney(order.totalAmount)} ₽</span>
                </div>
              </button>
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
            ) : !cancelling ? (
              <>
                <div>
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wide text-[var(--text-faint)]">Подтверждение чека</span>
                    <button
                      onClick={() => setUseCamera((v) => !v)}
                      className="flex items-center gap-1 text-xs font-medium text-[var(--accent-strong)]"
                    >
                      {useCamera ? <Keyboard size={13} /> : <Camera size={13} />}
                      {useCamera ? 'Ввести сканером/вручную' : 'Сканировать камерой'}
                    </button>
                  </div>

                  {useCamera ? (
                    <QrCameraScanner
                      onDecode={(text) => {
                        setUseCamera(false)
                        submitScan(text)
                      }}
                      onError={(msg) => setErrorMessage(msg)}
                    />
                  ) : (
                    <input
                      ref={inputRef}
                      value={qrValue}
                      onChange={(e) => setQrValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') submitScan(qrValue)
                      }}
                      placeholder="Наведите фокус сюда и отсканируйте чек сканером — или введите строку вручную"
                      className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
                    />
                  )}
                </div>

                {errorMessage && (
                  <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{errorMessage}</div>
                )}

                <div className="flex items-center gap-2">
                  <Button className="flex-1" onClick={() => submitScan(qrValue)} disabled={!qrValue.trim() || confirmReceipt.isPending}>
                    Подтвердить чек
                  </Button>
                  <Button variant="danger" onClick={() => setCancelling(true)}>
                    <X size={14} /> Отменить заказ
                  </Button>
                </div>
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
          </div>
        )}
      </Modal>
    </div>
  )
}
