import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import type { Refund } from '../types'

function useInvalidateAfterRefund() {
  const qc = useQueryClient()
  return () => {
    qc.invalidateQueries({ queryKey: ['refunds'] })
    qc.invalidateQueries({ queryKey: ['orders'] })
    qc.invalidateQueries({ queryKey: ['transactions'] })
  }
}

// Возвраты, ожидающие скана чека возврата прихода (P0.7).
export function useOpenRefunds() {
  return useQuery({
    queryKey: ['refunds', 'open'],
    queryFn: () => api.get<Refund[]>('/refunds/open'),
    refetchInterval: 15_000,
  })
}

export function useRequestRefund() {
  const invalidate = useInvalidateAfterRefund()
  return useMutation({
    mutationFn: (vars: { orderId: string; reason: string }) => api.post<Refund>(`/orders/${vars.orderId}/refund`, { reason: vars.reason }),
    onSuccess: invalidate,
  })
}

export function useConfirmRefundReceipt() {
  const invalidate = useInvalidateAfterRefund()
  return useMutation({
    mutationFn: (vars: { refundId: string; qrRaw: string }) => api.post<Refund>(`/refunds/${vars.refundId}/confirm-receipt`, { qrRaw: vars.qrRaw }),
    onSuccess: invalidate,
  })
}

export function useCancelRefund() {
  const invalidate = useInvalidateAfterRefund()
  return useMutation({
    mutationFn: (refundId: string) => api.post<Refund>(`/refunds/${refundId}/cancel`),
    onSuccess: invalidate,
  })
}
