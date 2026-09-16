import { Receipt } from 'lucide-react'
import { Button, Card } from './ui/Primitives'
import { formatMoney } from '../lib/format'
import type { Order } from '../types'

// Показывается после того, как клиент создал заказ и отправил его на
// оплату наличными — с P0.2 покупка больше не применяется мгновенно,
// а ждёт, пока администратор на ресепшене пробьёт реальный чек и
// отсканирует его в системе (раздел «Заказы»).
export function OrderPendingNotice({ order, onDismiss }: { order: Order; onDismiss: () => void }) {
  return (
    <Card className="flex items-start gap-3 border-[var(--accent)]/40 bg-[var(--accent-soft)]">
      <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--accent)] text-white">
        <Receipt size={16} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold text-[var(--accent-strong)]">Заказ оформлен на {formatMoney(order.totalAmount)} ₽</div>
        <p className="mt-0.5 text-xs text-[var(--text-muted)]">
          Оплатите наличными на ресепшене — администратор пробьёт чек и отсканирует его в системе, после этого заказ будет закрыт.
        </p>
      </div>
      <Button size="sm" variant="ghost" onClick={onDismiss}>
        Понятно
      </Button>
    </Card>
  )
}
