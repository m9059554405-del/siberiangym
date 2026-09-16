import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import type { ConsentType, Guardian } from '../types'

export interface CreateGuardianPayload {
  fullName: string
  phone: string
  email?: string
  relation: string
  linkedClientId?: string
}

// Поиск существующего законного представителя по телефону (P0.6) — чтобы
// при заведении второго ребёнка того же родителя не плодить дубль с теми
// же контактами. Пустая строка не запрашивается — бессмысленно и лишняя
// нагрузка на каждый рендер поля ввода.
export function useSearchGuardians(phone: string) {
  return useQuery({
    queryKey: ['guardians', 'search', phone],
    queryFn: () => api.get<Guardian[]>(`/guardians/search?phone=${encodeURIComponent(phone)}`),
    enabled: phone.trim().length >= 3,
  })
}

export function useGuardiansForClient(clientId: string | undefined) {
  return useQuery({
    queryKey: ['guardians', 'for-client', clientId],
    queryFn: () => api.get<Guardian[]>(`/guardians/for-client/${clientId}`),
    enabled: !!clientId,
  })
}

function useInvalidateGuardians() {
  const qc = useQueryClient()
  return () => qc.invalidateQueries({ queryKey: ['guardians'] })
}

export function useCreateGuardian() {
  const invalidate = useInvalidateGuardians()
  return useMutation({
    mutationFn: (dto: CreateGuardianPayload) => api.post<Guardian>('/guardians', dto),
    onSuccess: invalidate,
  })
}

export function useLinkGuardianChild() {
  const invalidate = useInvalidateGuardians()
  return useMutation({
    mutationFn: (vars: { guardianId: string; clientId: string }) => api.post<Guardian>(`/guardians/${vars.guardianId}/children`, { clientId: vars.clientId }),
    onSuccess: invalidate,
  })
}

// Согласие законного представителя за несовершеннолетнего — оформляет
// CEO/STAFF по факту подписанной на месте формы (P0.6), не сам клиент.
export function useGrantMinorConsent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (vars: { guardianId: string; clientId: string; type: ConsentType }) =>
      api.post(`/consents/guardians/${vars.guardianId}/grant`, { clientId: vars.clientId, type: vars.type }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['consents'] }),
  })
}
