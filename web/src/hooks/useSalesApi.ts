import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import type { CorporateAccount, CorporateStatement, PromoCode, ReferralSettings } from '../types'

// Инструменты продаж точки (P4.4): промокоды, настройки реферальной
// программы и корпоративные договоры. Используется страницей «Продажи»
// у CEO и формами сотрудников.

export function usePromoCodes() {
  return useQuery({ queryKey: ['promo-codes'], queryFn: () => api.get<PromoCode[]>('/promo-codes') })
}

export function useCreatePromoCode() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (vars: {
      code: string
      title?: string
      percentOff?: number
      amountOff?: number
      maxUses?: number
      validFrom?: string
      validUntil?: string
    }) => api.post<PromoCode>('/promo-codes', vars),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['promo-codes'] }),
  })
}

export function useSetPromoCodeActive() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (vars: { id: string; isActive: boolean }) =>
      api.post<PromoCode>(`/promo-codes/${vars.id}/${vars.isActive ? 'activate' : 'deactivate'}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['promo-codes'] }),
  })
}

export function useDeletePromoCode() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete<{ deleted: boolean }>(`/promo-codes/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['promo-codes'] }),
  })
}

export function useReferralSettings() {
  return useQuery({ queryKey: ['referrals', 'settings'], queryFn: () => api.get<ReferralSettings>('/referrals/settings') })
}

export function useUpdateReferralSettings() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (vars: { enabled?: boolean; referrerPercent?: number; referredPercent?: number }) =>
      api.put<ReferralSettings>('/referrals/settings', vars),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['referrals'] }),
  })
}

export function useCorporateAccounts() {
  return useQuery({ queryKey: ['corporate'], queryFn: () => api.get<CorporateAccount[]>('/corporate') })
}

export function useCorporateDetail(id: string | null) {
  return useQuery({
    queryKey: ['corporate', id],
    queryFn: () => api.get<CorporateAccount>(`/corporate/${id}`),
    enabled: !!id,
  })
}

export function useCorporateStatement(id: string | null) {
  return useQuery({
    queryKey: ['corporate', id, 'statement'],
    queryFn: () => api.get<CorporateStatement>(`/corporate/${id}/statement`),
    enabled: !!id,
  })
}

export function useCreateCorporateAccount() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (vars: { name: string; contactPerson?: string; contactPhone?: string; discountPercent?: number }) =>
      api.post<CorporateAccount>('/corporate', vars),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['corporate'] }),
  })
}

export function useUpdateCorporateAccount() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (vars: {
      id: string
      name?: string
      contactPerson?: string
      contactPhone?: string
      discountPercent?: number
      isActive?: boolean
    }) => api.patch<CorporateAccount>(`/corporate/${vars.id}`, vars),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['corporate'] }),
  })
}

export function useDeleteCorporateAccount() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete<{ deleted: boolean }>(`/corporate/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['corporate'] }),
  })
}

export function useAddCorporateMember() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (vars: { accountId: string; clientId: string }) =>
      api.post(`/corporate/${vars.accountId}/members`, { clientId: vars.clientId }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['corporate'] }),
  })
}

export function useRemoveCorporateMember() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (vars: { accountId: string; clientId: string }) =>
      api.delete(`/corporate/${vars.accountId}/members/${vars.clientId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['corporate'] }),
  })
}
