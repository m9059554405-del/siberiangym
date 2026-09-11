import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import type {
  Client,
  Measurement,
  Program,
  ProgressPhoto,
  Trainer,
  WorkoutLogEntry,
} from '../types'

export function useMyTrainerProfile() {
  return useQuery({ queryKey: ['trainers', 'me'], queryFn: () => api.get<Trainer>('/trainers/me') })
}

export function useMyTrainerClients() {
  return useQuery({ queryKey: ['trainers', 'me', 'clients'], queryFn: () => api.get<Client[]>('/trainers/me/clients') })
}

export function useClientDetail(clientId: string | undefined) {
  return useQuery({
    queryKey: ['clients', clientId],
    queryFn: () => api.get<Client>(`/clients/${clientId}`),
    enabled: !!clientId,
  })
}

export function useWorkoutLogsForClient(clientId: string | undefined) {
  return useQuery({
    queryKey: ['workout-logs', 'client', clientId],
    queryFn: () => api.get<WorkoutLogEntry[]>(`/clients/${clientId}/workout-logs`),
    enabled: !!clientId,
  })
}

export function useMeasurementsForClient(clientId: string | undefined) {
  return useQuery({
    queryKey: ['measurements', 'client', clientId],
    queryFn: () => api.get<Measurement[]>(`/clients/${clientId}/measurements`),
    enabled: !!clientId,
  })
}

export function useProgressPhotosForClient(clientId: string | undefined) {
  return useQuery({
    queryKey: ['progress-photos', 'client', clientId],
    queryFn: () => api.get<ProgressPhoto[]>(`/clients/${clientId}/progress-photos`),
    enabled: !!clientId,
  })
}

export function useSetClientProgram(clientId: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (days: { label: string; order: number; entries: { exerciseId: string; sets: number; reps: string; load: string; order: number }[] }[]) =>
      api.put<Program>(`/clients/${clientId}/program`, { days }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['program', clientId] }),
  })
}

export function useCreatePersonalSlot() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (vars: { trainerId: string; date: string; start: string; end: string }) => api.post('/personal-slots', vars),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['personal-slots'] }),
  })
}

export function useCompleteSlot() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (slotId: string) => api.post(`/personal-slots/${slotId}/complete`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['personal-slots'] }),
  })
}

export function useMissSlot() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (slotId: string) => api.post(`/personal-slots/${slotId}/miss`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['personal-slots'] }),
  })
}
