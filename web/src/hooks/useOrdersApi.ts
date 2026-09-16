import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import type { Order, OrderLineType } from '../types'

export interface OrderLineInput {
  type: OrderLineType
  refId?: string
  meta?: Record<string, unknown>
}

// Очередь незакрытых заказов на точке — для раздела "Заказы" у CEO/STAFF,
// где администратор сканирует чек и подтверждает оплату (P0.2).
export function useOpenOrders() {
  return useQuery({
    queryKey: ['orders', 'open'],
    queryFn: () => api.get<Order[]>('/orders/open'),
    refetchInterval: 15_000,
  })
}

// Заказы самого клиента — чтобы личный кабинет мог показать "ожидает оплаты"
// вместо того, чтобы делать вид, будто покупка уже применилась.
export function useMyOrders() {
  return useQuery({ queryKey: ['orders', 'mine'], queryFn: () => api.get<Order[]>('/orders/mine') })
}

// Оплаченные заказы клиента — чтобы найти заказ и оформить по нему возврат (P0.7).
export function usePaidOrders(clientId: string | undefined) {
  return useQuery({
    queryKey: ['orders', 'paid', clientId],
    queryFn: () => api.get<Order[]>(`/orders/paid?clientId=${clientId}`),
    enabled: !!clientId,
  })
}

function useInvalidateAfterOrder() {
  const qc = useQueryClient()
  return () => {
    qc.invalidateQueries({ queryKey: ['orders'] })
  }
}

// Собрать заказ и сразу отправить его на оплату наличными — покрывает
// самый частый сценарий (один клик "Купить"/"Оплатить"). Для сборки
// группового чека из нескольких позиций сначала используйте useCreateOrder,
// затем useSubmitCash отдельным действием.
export function useCreateCashOrder() {
  const invalidate = useInvalidateAfterOrder()
  return useMutation({
    mutationFn: async (vars: { clientId: string; lines: OrderLineInput[] }) => {
      const order = await api.post<Order>('/orders', vars)
      return api.post<Order>(`/orders/${order.id}/pay/cash`)
    },
    onSuccess: invalidate,
  })
}

export function useCreateOrder() {
  const invalidate = useInvalidateAfterOrder()
  return useMutation({
    mutationFn: (vars: { clientId: string; lines: OrderLineInput[] }) => api.post<Order>('/orders', vars),
    onSuccess: invalidate,
  })
}

export function useSubmitCash() {
  const invalidate = useInvalidateAfterOrder()
  return useMutation({
    mutationFn: (orderId: string) => api.post<Order>(`/orders/${orderId}/pay/cash`),
    onSuccess: invalidate,
  })
}

export function useConfirmReceipt() {
  const invalidate = useInvalidateAfterOrder()
  return useMutation({
    mutationFn: (vars: { orderId: string; qrRaw: string }) => api.post<Order>(`/orders/${vars.orderId}/confirm-receipt`, { qrRaw: vars.qrRaw }),
    onSuccess: invalidate,
  })
}

export function useCancelOrder() {
  const invalidate = useInvalidateAfterOrder()
  return useMutation({
    mutationFn: (vars: { orderId: string; reason?: string }) => api.post<Order>(`/orders/${vars.orderId}/cancel`, { reason: vars.reason }),
    onSuccess: invalidate,
  })
}
