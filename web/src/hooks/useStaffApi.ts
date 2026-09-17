import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import type { Client, ClubPost, ClubPostType, Gender, MembershipType, Membership, Tariff } from '../types'

export function useAllClients() {
  return useQuery({ queryKey: ['clients', 'all'], queryFn: () => api.get<Client[]>('/clients') })
}

export interface NetworkClientResult {
  id: string
  name: string
  phone: string | null
  gymId: string
  gymName: string | null
  isHomeGym: boolean
  membership: Membership | null
  validHere: boolean
}

// Межточечный поиск клиента по всей сети (P1.5) — не только своя точка,
// как обычный список выше. Нужен, когда клиент с сетевым абонементом
// пришёл на точку, к которой его карточка не привязана физически.
export function useNetworkClientSearch(query: string) {
  return useQuery({
    queryKey: ['clients', 'network-search', query],
    queryFn: () => api.get<NetworkClientResult[]>(`/clients/network-search?q=${encodeURIComponent(query)}`),
    enabled: query.trim().length >= 2,
  })
}

export interface CreateClientPayload {
  name: string
  gender: Gender
  birthday: string
  phone?: string
  email?: string
  trainerId?: string | null
  tariff?: Tariff | null
  membershipType: MembershipType
}

export function useCreateClient() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (dto: CreateClientPayload) => api.post<Client>('/clients', dto),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['clients'] }),
  })
}

export function useUpdateClient() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (vars: { clientId: string; data: { name?: string; gender?: Gender; phone?: string; email?: string } }) =>
      api.patch<Client>(`/clients/${vars.clientId}`, vars.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['clients'] }),
  })
}

export function useCreateClientLogin(clientId: string | undefined) {
  return useMutation({
    mutationFn: (dto: { email: string; password: string }) => api.post(`/clients/${clientId}/create-login`, dto),
  })
}

export interface OutreachRow extends Client {
  latestOutreachNote: { id: string; called: boolean; reason: string; date: string; authorName: string } | null
}

export function useOutreach() {
  return useQuery({ queryKey: ['outreach'], queryFn: () => api.get<OutreachRow[]>('/outreach') })
}

export function useCreateOutreachNote() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (dto: { clientId: string; called: boolean; reason: string }) => api.post('/outreach', dto),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['outreach'] }),
  })
}

export function useCreateClubPost() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (dto: { title: string; text: string; type: ClubPostType }) => api.post<ClubPost>('/club-posts', dto),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['club-posts'] }),
  })
}
