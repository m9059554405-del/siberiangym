import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import type { Gym } from '../types'

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
    mutationFn: (vars: { userId: string; gymId: string }) => api.patch<StaffUser>(`/gyms/staff/${vars.userId}`, { gymId: vars.gymId }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['gyms', 'staff'] }),
  })
}
