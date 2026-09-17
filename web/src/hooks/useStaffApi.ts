import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import type { Checkin, CheckinScanResult, Client, ClubPost, ClubPostType, Gender, Lead, MembershipType, Membership, Tariff } from '../types'

// network=true (P1.7) — клиенты всей сети: нужно CEO-отчёту «занятость
// тренеров» (подопечные тренера живут в разных точках). Бэкенд учитывает
// флаг только для CEO, остальным ролям он ничего не меняет.
export function useAllClients(network = false) {
  return useQuery({
    queryKey: ['clients', 'all', network ? 'network' : 'gym'],
    queryFn: () => api.get<Client[]>(network ? '/clients?network=1' : '/clients'),
  })
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

// Заморозка/разморозка абонемента (P2.1) — административное действие
// (CEO/STAFF), поэтому живёт в staff-хуках, а не в клиентских.
export function useFreezeMembership() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (vars: { clientId: string; days: number }) => api.post<Membership>(`/clients/${vars.clientId}/freeze-membership`, { days: vars.days }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['clients'] }),
  })
}

export function useUnfreezeMembership() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (clientId: string) => api.post<Membership>(`/clients/${clientId}/unfreeze-membership`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['clients'] }),
  })
}

// Контроль доступа на входе (P2.2): скан QR клиента и журнал проходов
// своей точки. Используется и CEO (страница «Вход» в кабинете владельца).
export function useCheckinScan() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (vars: { code: string; source: 'QR' | 'MANUAL' }) => api.post<CheckinScanResult>('/checkins/scan', vars),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['checkins'] }),
  })
}

export function useCheckins() {
  return useQuery({ queryKey: ['checkins'], queryFn: () => api.get<Checkin[]>('/checkins') })
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

// Гостевые карточки (лиды) — P2.6: карточка гостя, отметка визита/потери
// и конвертация (привязка к уже зарегистрированному клиенту).
export function useLeads() {
  return useQuery({ queryKey: ['leads'], queryFn: () => api.get<Lead[]>('/leads') })
}

export function useCreateLead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (dto: { name: string; phone?: string; email?: string; visitDate?: string; note?: string }) => api.post<Lead>('/leads', dto),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['leads'] }),
  })
}

export function useUpdateLead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...dto }: { id: string; phone?: string; email?: string; visitDate?: string; note?: string; status?: 'NEW' | 'VISITED' | 'LOST' }) =>
      api.patch<Lead>(`/leads/${id}`, dto),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['leads'] }),
  })
}

export function useConvertLead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, clientId }: { id: string; clientId: string }) => api.post<Lead>(`/leads/${id}/convert`, { clientId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leads'] })
      qc.invalidateQueries({ queryKey: ['clients'] })
    },
  })
}
