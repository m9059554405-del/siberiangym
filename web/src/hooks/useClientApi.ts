import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import type {
  Client,
  ClubPost,
  CycleLog,
  DirectorMessage,
  Exercise,
  FeedbackMessage,
  GroupClass,
  Locker,
  Measurement,
  MembershipPricing,
  MembershipType,
  PersonalSlot,
  Program,
  ProgramDay,
  ProgressPhoto,
  Tariff,
  Trainer,
  WorkoutLogEntry,
} from '../types'

export function useMe() {
  return useQuery({ queryKey: ['me'], queryFn: () => api.get<Client>('/clients/me') })
}

export function usePricing() {
  return useQuery({ queryKey: ['pricing'], queryFn: () => api.get<MembershipPricing>('/pricing') })
}

export function useTrainers() {
  return useQuery({ queryKey: ['trainers'], queryFn: () => api.get<Trainer[]>('/trainers') })
}

export function useExercises() {
  return useQuery({ queryKey: ['exercises'], queryFn: () => api.get<Exercise[]>('/exercises') })
}

export function useProgram(clientId: string | undefined) {
  return useQuery({
    queryKey: ['program', clientId],
    queryFn: () => api.get<Program | null>(`/clients/${clientId}/program`),
    enabled: !!clientId,
  })
}

export function useOwnWorkoutLogs() {
  return useQuery({ queryKey: ['workout-logs', 'mine'], queryFn: () => api.get<WorkoutLogEntry[]>('/workout-logs/mine') })
}

export function useGroupClasses() {
  return useQuery({ queryKey: ['group-classes'], queryFn: () => api.get<GroupClass[]>('/group-classes') })
}

export function usePersonalSlots() {
  return useQuery({ queryKey: ['personal-slots'], queryFn: () => api.get<PersonalSlot[]>('/personal-slots') })
}

export function useLockers() {
  return useQuery({ queryKey: ['lockers'], queryFn: () => api.get<Locker[]>('/lockers') })
}

export function useCatalog() {
  return useQuery({ queryKey: ['catalog'], queryFn: () => api.get<{ id: string; name: string; category: string; price: number; emoji: string }[]>('/stock/catalog') })
}

export function useClubPosts() {
  return useQuery({ queryKey: ['club-posts'], queryFn: () => api.get<ClubPost[]>('/club-posts') })
}

export function useFeedback(clientId: string | undefined) {
  return useQuery({
    queryKey: ['feedback', clientId],
    queryFn: () => api.get<FeedbackMessage[]>(`/clients/${clientId}/feedback`),
    enabled: !!clientId,
  })
}

export function useOwnProgressPhotos() {
  return useQuery({ queryKey: ['progress-photos', 'mine'], queryFn: () => api.get<ProgressPhoto[]>('/progress-photos/mine') })
}

export function useOwnMeasurements() {
  return useQuery({ queryKey: ['measurements', 'mine'], queryFn: () => api.get<Measurement[]>('/measurements/mine') })
}

export function useOwnCycleLogs() {
  return useQuery({ queryKey: ['cycle-logs', 'mine'], queryFn: () => api.get<CycleLog[]>('/cycle-logs') })
}

export function useOwnDirectorMessages() {
  return useQuery({ queryKey: ['director-messages', 'mine'], queryFn: () => api.get<DirectorMessage[]>('/director-messages/mine') })
}

function useInvalidate(keys: (string | undefined)[][]) {
  const qc = useQueryClient()
  return () => keys.forEach((k) => qc.invalidateQueries({ queryKey: k }))
}

export function usePurchaseMembership(clientId: string | undefined) {
  const invalidate = useInvalidate([['me']])
  return useMutation({
    mutationFn: (type: MembershipType) => api.post<Client>(`/clients/${clientId}/purchase-membership`, { type }),
    onSuccess: invalidate,
  })
}

export function useChangeTariff(clientId: string | undefined) {
  const invalidate = useInvalidate([['me']])
  return useMutation({
    mutationFn: (tariff: Tariff) => api.post<Client>(`/clients/${clientId}/change-tariff`, { tariff }),
    onSuccess: invalidate,
  })
}

export function useChooseTrainer(clientId: string | undefined) {
  const invalidate = useInvalidate([['me']])
  return useMutation({
    mutationFn: (vars: { trainerId: string; tariff: Tariff }) => api.post<Client>(`/clients/${clientId}/choose-trainer`, vars),
    onSuccess: invalidate,
  })
}

export function useGoSelfTraining(clientId: string | undefined) {
  const invalidate = useInvalidate([['me']])
  return useMutation({
    mutationFn: () => api.post<Client>(`/clients/${clientId}/go-self-training`),
    onSuccess: invalidate,
  })
}

export function useSendDirectorMessage() {
  const invalidate = useInvalidate([['director-messages', 'mine']])
  return useMutation({
    mutationFn: (text: string) => api.post<DirectorMessage>('/director-messages', { text }),
    onSuccess: invalidate,
  })
}

export function useMarkDirectorMessagesSeen() {
  const invalidate = useInvalidate([['director-messages', 'mine']])
  return useMutation({
    mutationFn: () => api.post('/director-messages/mark-seen'),
    onSuccess: invalidate,
  })
}

export function useBookGroupClass() {
  const invalidate = useInvalidate([['group-classes']])
  return useMutation({
    mutationFn: (classId: string) => api.post<GroupClass>(`/group-classes/${classId}/book`),
    onSuccess: invalidate,
  })
}

export function useCancelGroupClassBooking() {
  const invalidate = useInvalidate([['group-classes']])
  return useMutation({
    mutationFn: (classId: string) => api.post(`/group-classes/${classId}/cancel`),
    onSuccess: invalidate,
  })
}

export function useBookPersonalSlot() {
  const invalidate = useInvalidate([['personal-slots']])
  return useMutation({
    mutationFn: (slotId: string) => api.post<PersonalSlot>(`/personal-slots/${slotId}/book`),
    onSuccess: invalidate,
  })
}

export function useCancelPersonalSlot() {
  const invalidate = useInvalidate([['personal-slots']])
  return useMutation({
    mutationFn: (slotId: string) => api.post(`/personal-slots/${slotId}/cancel`),
    onSuccess: invalidate,
  })
}

export function useRentLocker() {
  const invalidate = useInvalidate([['lockers']])
  return useMutation({
    mutationFn: (vars: { lockerId: string; days: number }) => api.post<Locker>(`/lockers/${vars.lockerId}/rent`, { days: vars.days }),
    onSuccess: invalidate,
  })
}

export function usePurchaseCatalogItem() {
  return useMutation({
    mutationFn: (catalogItemId: string) => api.post('/stock/purchase', { catalogItemId }),
  })
}

export function useReleaseLocker() {
  const invalidate = useInvalidate([['lockers']])
  return useMutation({
    mutationFn: (lockerId: string) => api.post<Locker>(`/lockers/${lockerId}/release`),
    onSuccess: invalidate,
  })
}

export function useSaveOwnProgram(clientId: string | undefined) {
  const invalidate = useInvalidate([['program', clientId]])
  return useMutation({
    mutationFn: (days: { label: string; order: number; entries: { exerciseId: string; sets: number; reps: string; load: string; order: number }[] }[]) =>
      api.put<Program>(`/clients/${clientId}/program`, { days }),
    onSuccess: invalidate,
  })
}

export function useLogWorkout() {
  const invalidate = useInvalidate([['workout-logs', 'mine']])
  return useMutation({
    mutationFn: (vars: { dayLabel: string; exercises: { exerciseId: string; sets: { reps: string; load: string; completed: boolean; effort?: string; restSeconds?: number }[] }[] }) =>
      api.post<WorkoutLogEntry>('/workout-logs', vars),
    onSuccess: invalidate,
  })
}

export function useAddMeasurement() {
  const invalidate = useInvalidate([['measurements', 'mine']])
  return useMutation({
    mutationFn: (data: Partial<Record<string, number>>) => api.post<Measurement>('/measurements', data),
    onSuccess: invalidate,
  })
}

export function useAddProgressPhoto() {
  const invalidate = useInvalidate([['progress-photos', 'mine']])
  return useMutation({
    mutationFn: (vars: { kind: 'FOOD' | 'BODY'; url: string; mealType?: string; caption?: string }) => api.post<ProgressPhoto>('/progress-photos', vars),
    onSuccess: invalidate,
  })
}

export function useAddCycleLog() {
  const invalidate = useInvalidate([['cycle-logs', 'mine']])
  return useMutation({
    mutationFn: () => api.post<CycleLog>('/cycle-logs', {}),
    onSuccess: invalidate,
  })
}

export function useUpdateOwnProfile(clientId: string | undefined) {
  const invalidate = useInvalidate([['me']])
  return useMutation({
    mutationFn: (data: { name?: string; birthday?: string; phone?: string; email?: string }) => api.patch<Client>(`/clients/${clientId}`, data),
    onSuccess: invalidate,
  })
}

export function useSendFeedback(clientId: string | undefined) {
  const invalidate = useInvalidate([['feedback', clientId]])
  return useMutation({
    mutationFn: (text: string) => api.post<FeedbackMessage>(`/clients/${clientId}/feedback`, { text }),
    onSuccess: invalidate,
  })
}

export type { ProgramDay }
