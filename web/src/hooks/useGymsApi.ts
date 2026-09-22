import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import type { Gym, Hall, WorkingHours } from '../types'

// Точки своей сети (P1.1) — виден только CEO (эндпоинт и так гейтится
// ролью на бэкенде), список используется переключателем точки в шапке.
export function useNetworkGyms() {
  return useQuery({
    queryKey: ['gyms'],
    queryFn: () => api.get<Gym[]>('/gyms'),
  })
}

export function useCreateGym() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (dto: { name: string; selfTrainingMinAge?: number }) => api.post<Gym>('/gyms', dto),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['gyms'] }),
  })
}

// Управление точками (заявка клуба): переименование/правка настроек,
// удаление пустой точки, администраторы сети и их перенос между точками.
export function useUpdateGym() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (vars: { gymId: string; data: { name?: string; selfTrainingMinAge?: number } }) =>
      api.patch<Gym>(`/gyms/${vars.gymId}`, vars.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['gyms'] }),
  })
}

export function useDeleteGym() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (gymId: string) => api.delete(`/gyms/${gymId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['gyms'] }),
  })
}

export interface StaffUser {
  id: string
  name: string | null
  email: string | null
  phone: string | null
  gymId: string
  isActive: boolean
  createdAt: string
}

export function useNetworkStaff() {
  return useQuery({
    queryKey: ['gyms', 'staff'],
    queryFn: () => api.get<StaffUser[]>('/gyms/staff'),
  })
}

export function useMoveStaff() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (dto: { userId: string; gymId: string }) => api.patch(`/gyms/staff/${dto.userId}`, { gymId: dto.gymId }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['gyms', 'staff'] }),
  })
}

// P3.9: деактивация/реактивация логина администратора без потери истории.
export function useSetStaffActive() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (vars: { userId: string; isActive: boolean }) =>
      api.post(`/gyms/staff/${vars.userId}/${vars.isActive ? 'activate' : 'deactivate'}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['gyms', 'staff'] }),
  })
}

// Часы работы текущей точки (P4.2): читать может любая роль своей точки,
// заменяет весь набор только CEO (эндпоинт применяет его к своей точке).
export function useWorkingHours() {
  return useQuery({
    queryKey: ['gyms', 'working-hours'],
    queryFn: () => api.get<WorkingHours[]>('/gyms/working-hours'),
  })
}

export function useReplaceWorkingHours() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (items: { weekday: number; open: string; close: string }[]) =>
      api.put<WorkingHours[]>('/gyms/working-hours', { items }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['gyms', 'working-hours'] }),
  })
}

// --- Залы точек сети (заявка клуба) ---
// Точка всегда имеет хотя бы один зал; создание/удаление залов,
// привязка тренеров и цены — только CEO.

export interface HallPriceInput {
  label: string
  amount: number
}

export interface HallInput {
  name: string
  kind: string
  trainerIds?: string[]
  prices?: HallPriceInput[]
}

export function useGymHalls(gymId: string | undefined) {
  return useQuery({
    queryKey: ['halls', gymId],
    queryFn: () => api.get<Hall[]>(`/halls?gymId=${gymId}`),
    enabled: !!gymId,
  })
}

export function useCreateHall() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (vars: { gymId: string; data: HallInput }) => api.post<Hall>('/halls', { gymId: vars.gymId, ...vars.data }),
    onSuccess: (_hall, vars) => qc.invalidateQueries({ queryKey: ['halls', vars.gymId] }),
  })
}

export function useUpdateHall() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (vars: { hallId: string; gymId: string; data: Partial<HallInput> }) =>
      api.patch<Hall>(`/halls/${vars.hallId}`, vars.data),
    onSuccess: (_hall, vars) => qc.invalidateQueries({ queryKey: ['halls', vars.gymId] }),
  })
}

export function useDeleteHall() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (vars: { hallId: string; gymId: string }) => api.delete(`/halls/${vars.hallId}`),
    onSuccess: (_res, vars) => qc.invalidateQueries({ queryKey: ['halls', vars.gymId] }),
  })
}
