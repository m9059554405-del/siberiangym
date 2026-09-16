import { useState } from 'react'
import { Lock, LockOpen } from 'lucide-react'
import { useCatalog, useLockers, useMe, useReleaseLocker } from '../../hooks/useClientApi'
import { useCreateCashOrder } from '../../hooks/useOrdersApi'
import { Badge, Button, Card, SectionTitle } from '../../components/ui/Primitives'
import { OrderPendingNotice } from '../../components/OrderPendingNotice'
import type { Order } from '../../types'

const LOCKER_DAY_OPTIONS = [1, 7, 30]

export function ShopPage() {
  const { data: client } = useMe()
  const { data: lockers } = useLockers()
  const { data: catalog } = useCatalog()
  const createCashOrder = useCreateCashOrder()
  const releaseLocker = useReleaseLocker()
  const [days, setDays] = useState(7)
  const [boughtId, setBoughtId] = useState<string | null>(null)
  const [pendingOrder, setPendingOrder] = useState<Order | null>(null)

  if (!client || !lockers || !catalog) return null

  const myLocker = lockers.find((l) => l.rentedBy === client.id)
  const freeLockers = lockers.filter((l) => l.status === 'FREE')

  function buy(id: string) {
    createCashOrder.mutate(
      { clientId: client!.id, lines: [{ type: 'STOCK_PURCHASE', refId: id }] },
      {
        onSuccess: (order) => {
          setBoughtId(id)
          setPendingOrder(order)
          setTimeout(() => setBoughtId((v) => (v === id ? null : v)), 1800)
        },
      },
    )
  }

  function rent(lockerId: string) {
    createCashOrder.mutate(
      { clientId: client!.id, lines: [{ type: 'LOCKER_RENTAL', refId: lockerId, meta: { days } }] },
      { onSuccess: setPendingOrder },
    )
  }

  return (
    <div className="flex flex-col gap-5 pt-1">
      <div>
        <h1 className="text-xl font-bold">Магазин</h1>
        <p className="text-sm text-[var(--text-muted)]">Кабинки для переодевания, вода и снеки</p>
      </div>

      <section>
        <SectionTitle title="Кабинка для переодевания" />
        {myLocker ? (
          <Card className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent-strong)]">
                <Lock size={18} />
              </div>
              <div>
                <div className="font-medium">Кабинка №{myLocker.number}</div>
                <div className="text-xs text-[var(--text-faint)]">Арендована до {myLocker.rentedUntil?.slice(0, 10)}</div>
              </div>
            </div>
            <Button size="sm" variant="danger" onClick={() => releaseLocker.mutate(myLocker.id)}>
              Освободить
            </Button>
          </Card>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <span className="text-sm text-[var(--text-muted)]">Срок аренды:</span>
              {LOCKER_DAY_OPTIONS.map((d) => (
                <button
                  key={d}
                  onClick={() => setDays(d)}
                  className={`tap-scale rounded-lg px-2.5 py-1 text-sm font-medium ${days === d ? 'bg-[var(--accent)] text-white' : 'bg-[var(--surface-sunken)] text-[var(--text-muted)]'}`}
                >
                  {d} дн.
                </button>
              ))}
            </div>
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
              {freeLockers.slice(0, 12).map((l) => (
                <button
                  key={l.id}
                  onClick={() => rent(l.id)}
                  className="tap-scale flex flex-col items-center gap-1 rounded-xl border border-[var(--border)] bg-[var(--surface-raised)] py-3 hover:border-[var(--accent)]"
                >
                  <LockOpen size={16} className="text-[var(--text-faint)]" />
                  <span className="text-xs font-medium">№{l.number}</span>
                </button>
              ))}
            </div>
            {lockers.length > 0 && (
              <p className="text-xs text-[var(--text-faint)]">
                {freeLockers.length} свободно из {lockers.length} · {lockers[0].pricePerDay} ₽/день
              </p>
            )}
          </div>
        )}
      </section>

      <section>
        <SectionTitle title="Вода" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {catalog
            .filter((i) => i.category === 'WATER')
            .map((item) => (
              <Card key={item.id} className="flex h-full flex-col items-center justify-between gap-2 text-center">
                <div className="flex flex-col items-center gap-1.5">
                  <span className="text-2xl">{item.emoji}</span>
                  <span className="text-sm font-medium leading-snug">{item.name}</span>
                  <span className="text-sm text-[var(--text-muted)]">{item.price} ₽</span>
                </div>
                <Button size="sm" className="w-full" onClick={() => buy(item.id)}>
                  {boughtId === item.id ? 'Заказано ✓' : 'Купить'}
                </Button>
              </Card>
            ))}
        </div>
      </section>

      <section>
        <SectionTitle title="Еда и снеки" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {catalog
            .filter((i) => i.category === 'FOOD')
            .map((item) => (
              <Card key={item.id} className="flex h-full flex-col items-center justify-between gap-2 text-center">
                <div className="flex flex-col items-center gap-1.5">
                  <span className="text-2xl">{item.emoji}</span>
                  <span className="text-sm font-medium leading-snug">{item.name}</span>
                  <span className="text-sm text-[var(--text-muted)]">{item.price} ₽</span>
                </div>
                <Button size="sm" className="w-full" onClick={() => buy(item.id)}>
                  {boughtId === item.id ? 'Заказано ✓' : 'Купить'}
                </Button>
              </Card>
            ))}
        </div>
      </section>

      {pendingOrder && <OrderPendingNotice order={pendingOrder} onDismiss={() => setPendingOrder(null)} />}

      <Badge tone="neutral">Оплата — наличными администратору на ресепшене, после сканирования чека</Badge>
    </div>
  )
}
