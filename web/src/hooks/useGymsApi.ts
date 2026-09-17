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
