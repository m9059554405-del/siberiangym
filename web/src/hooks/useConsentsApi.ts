import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import type { ConsentStatus, ConsentTexts, ConsentType } from '../types'

// Тексты согласий (152-ФЗ, P0.4) — одинаковы для всех, читаются один раз.
export function useConsentTexts() {
  return useQuery({ queryKey: ['consents', 'texts'], queryFn: () => api.get<ConsentTexts>('/consents/texts'), staleTime: Infinity })
}

export function useMyConsents() {
  return useQuery({ queryKey: ['consents', 'mine'], queryFn: () => api.get<ConsentStatus[]>('/consents/mine') })
}

// Для CEO/STAFF — аудит по конкретному клиенту.
export function useClientConsents(clientId: string | undefined) {
  return useQuery({
    queryKey: ['consents', 'client', clientId],
    queryFn: () => api.get<ConsentStatus[]>(`/consents/client/${clientId}`),
    enabled: !!clientId,
  })
}

// Аудит согласия сотрудника-тренера (P1.4, STAFF_PDN) — read-only для CEO/STAFF.
export function useTrainerConsent(trainerId: string | undefined) {
  return useQuery({
    queryKey: ['consents', 'trainer', trainerId],
    queryFn: () => api.get<{ granted: boolean; updatedAt: string | null }>(`/consents/trainer/${trainerId}`),
    enabled: !!trainerId,
  })
}

export function useGrantTrainerConsent() {
  const invalidate = useInvalidateConsents()
  return useMutation({
    mutationFn: (trainerId: string) => api.post(`/consents/trainers/${trainerId}/grant`),
    onSuccess: invalidate,
  })
}

function useInvalidateConsents() {
  const qc = useQueryClient()
  return () => qc.invalidateQueries({ queryKey: ['consents'] })
}

export function useGrantConsent() {
  const invalidate = useInvalidateConsents()
  return useMutation({
    mutationFn: (type: ConsentType) => api.post('/consents/grant', { type }),
    onSuccess: invalidate,
  })
}

export function useRevokeConsent() {
  const invalidate = useInvalidateConsents()
  return useMutation({
    mutationFn: (type: ConsentType) => api.post(`/consents/${type}/revoke`),
    onSuccess: invalidate,
  })
}

export function useExportMyData() {
  return useMutation({
    mutationFn: () => api.get<Record<string, unknown>>('/consents/export'),
  })
}

export function useRequestDataDeletion() {
  const invalidate = useInvalidateConsents()
  return useMutation({
    mutationFn: (reason?: string) => api.post('/consents/delete-request', { reason }),
    onSuccess: invalidate,
  })
}
