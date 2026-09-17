import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import type { DirectorMessage, EmploymentType, Gym, MembershipPricing, OfferAudience, Trainer, TransactionCategory, WorkoutLogEntry } from '../types'

// Точки сети, на которых работает тренер (P1.3) — домашняя (создана там)
// плюс дополнительные, назначенные CEO.
export function useTrainerGyms(trainerId: string | undefined) {
  return useQuery({
    queryKey: ['trainers', trainerId, 'gyms'],
    queryFn: () => api.get<{ homeGymId: string; additional: Gym[] }>(`/trainers/${trainerId}/gyms`),
    enabled: !!trainerId,
  })
}

export function useAssignTrainerGym(trainerId: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (gymId: string) => api.post(`/trainers/${trainerId}/gyms`, { gymId }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['trainers', trainerId, 'gyms'] }),
  })
}

export function useUnassignTrainerGym(trainerId: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (gymId: string) => api.post(`/trainers/${trainerId}/gyms/${gymId}/unassign`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['trainers', trainerId, 'gyms'] }),
  })
}

// Изменение цен точки (P1.2) — раньше не было ни одного эндпоинта для
// этого, только seed-скрипт при первом развёртывании. Частичный PATCH:
// присылаются только те поля, которые правит форма.
export function useUpdatePricing() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (dto: Partial<MembershipPricing>) => api.patch<MembershipPricing>('/pricing', dto),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pricing'] }),
  })
}

export interface Transaction {
  id: string
  date: string
  amount: number
  category: TransactionCategory
  clientId: string
  client?: { name: string }
  trainerId: string | null
  trainer?: { name: string } | null
  description: string
}

export function useTransactions() {
  return useQuery({ queryKey: ['transactions'], queryFn: () => api.get<Transaction[]>('/transactions') })
}

export function useAllWorkoutLogs() {
  return useQuery({ queryKey: ['workout-logs', 'all'], queryFn: () => api.get<WorkoutLogEntry[]>('/workout-logs') })
}

export interface ActivityLogEntry {
  id: string
  date: string
  actorRole: 'CLIENT' | 'TRAINER' | 'CEO' | 'STAFF'
  actorName: string
  action: string
  target: string
  details: string
}

export function useActivityLog() {
  return useQuery({ queryKey: ['activity-log'], queryFn: () => api.get<ActivityLogEntry[]>('/activity-log') })
}

export function useDirectorMessages() {
  return useQuery({ queryKey: ['director-messages'], queryFn: () => api.get<DirectorMessage[]>('/director-messages') })
}

export function useReplyDirectorMessage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (vars: { id: string; reply: string }) => api.post<DirectorMessage>(`/director-messages/${vars.id}/reply`, { reply: vars.reply }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['director-messages'] }),
  })
}

export interface ReportOffer {
  id: string
  title: string
  text: string
  audience: OfferAudience
  active: boolean
  createdAt: string
}

export function useReportOffers() {
  return useQuery({ queryKey: ['report-offers'], queryFn: () => api.get<ReportOffer[]>('/report-offers') })
}

function useInvalidateOffers() {
  const qc = useQueryClient()
  return () => qc.invalidateQueries({ queryKey: ['report-offers'] })
}

export function useCreateReportOffer() {
  const invalidate = useInvalidateOffers()
  return useMutation({
    mutationFn: (dto: { title: string; text: string; audience: OfferAudience }) => api.post<ReportOffer>('/report-offers', dto),
    onSuccess: invalidate,
  })
}

export function useToggleReportOffer() {
  const invalidate = useInvalidateOffers()
  return useMutation({
    mutationFn: (id: string) => api.post<ReportOffer>(`/report-offers/${id}/toggle`),
    onSuccess: invalidate,
  })
}

export function useDeleteReportOffer() {
  const invalidate = useInvalidateOffers()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/report-offers/${id}`),
    onSuccess: invalidate,
  })
}

// Инструмент CEO «Завести администратора» (P1.10) — заводится сразу в
// активную (по токену) точку сети, ролью STAFF, без второго шага
// (в отличие от тренера, у STAFF нет отдельной карточки-сущности).
export function useCreateStaff() {
  return useMutation({
    mutationFn: (dto: { name: string; email: string; password: string; phone?: string }) =>
      api.post<{ id: string; email: string; name: string | null }>('/auth/staff', dto),
  })
}

// P1.4: заведение тренера "в один проход" — статус занятости обязателен,
// остальное (точки сети сверх текущей, согласие сотрудника, логин) опционально.
export interface CreateTrainerPayload {
  name: string
  specialization: string
  bio?: string
  experienceYears?: number
  personalSessionPrice: number
  employmentType: EmploymentType
  revenueSharePercent?: number
  additionalGymIds?: string[]
  staffConsentGranted?: boolean
  loginEmail?: string
  loginPassword?: string
}

export function useCreateTrainer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (dto: CreateTrainerPayload) => api.post<Trainer>('/trainers', dto),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['trainers'] }),
  })
}

export function useCreateTrainerLogin(trainerId: string | undefined) {
  return useMutation({
    mutationFn: (dto: { email: string; password: string }) => api.post(`/trainers/${trainerId}/create-login`, dto),
  })
}
