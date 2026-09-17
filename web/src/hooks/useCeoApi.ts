import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import type { DirectorMessage, MembershipPricing, OfferAudience, TransactionCategory, WorkoutLogEntry } from '../types'

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

export function useCreateTrainer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (dto: { name: string; specialization: string; bio?: string; experienceYears?: number; personalSessionPrice: number }) => api.post('/trainers', dto),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['trainers'] }),
  })
}

export function useCreateTrainerLogin(trainerId: string | undefined) {
  return useMutation({
    mutationFn: (dto: { email: string; password: string }) => api.post(`/trainers/${trainerId}/create-login`, dto),
  })
}
