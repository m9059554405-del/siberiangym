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
  NotificationsFeed,
  PersonalSlot,
  Program,
  ProgramDay,
  ProgressPhoto,
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

export interface LeaderboardRow {
  clientId: string
  name: string
  avatarHue: number
  kg: number
}

export function useLeaderboard(period: 'day' | 'week' | 'month') {
  return useQuery({
    queryKey: ['workout-logs', 'leaderboard', period],
    queryFn: () => api.get<LeaderboardRow[]>(`/workout-logs/leaderboard?period=${period}`),
  })
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

// Оформление/продление абонемента, смена тарифа и выбор тренера — платные
// действия, с P0.2 идут через заказ с подтверждением оплаты чеком, а не
// применяются мгновенно. См. useCreateCashOrder в hooks/useOrdersApi.ts —
// именно им теперь пользуются PaymentsPage/TrainerSelectionPage/ClientsManagePage.

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

// Запись на групповое занятие — платное действие, с P0.2 идёт через заказ
// (useCreateCashOrder), см. CalendarPage.tsx.

export function useCancelGroupClassBooking() {
  const invalidate = useInvalidate([['group-classes']])
  return useMutation({
    mutationFn: (classId: string) => api.post(`/group-classes/${classId}/cancel`),
    onSuccess: invalidate,
  })
}

// Лист ожидания (P2.3): клиент встаёт в очередь на заполненное занятие;
// при освобождении места первый ждущий получает email. Персонал может
// передать clientId, чтобы поставить клиента вручную.
export function useJoinGroupClassWaitlist() {
  const invalidate = useInvalidate([['group-classes']])
  return useMutation({
    mutationFn: (classId: string) => api.post(`/group-classes/${classId}/waitlist`),
    onSuccess: invalidate,
  })
}

export function useLeaveGroupClassWaitlist() {
  const invalidate = useInvalidate([['group-classes']])
  return useMutation({
    mutationFn: (classId: string) => api.post(`/group-classes/${classId}/waitlist/cancel`),
    onSuccess: invalidate,
  })
}

// Запись на персональный слот — платное действие, с P0.2 идёт через заказ
// (useCreateCashOrder), см. CalendarPage.tsx.

export function useCancelPersonalSlot() {
  const invalidate = useInvalidate([['personal-slots']])
  return useMutation({
    mutationFn: (slotId: string) => api.post(`/personal-slots/${slotId}/cancel`),
    onSuccess: invalidate,
  })
}

// Аренда шкафчика и покупка товара со склада — платные действия, с P0.2 идут
// через заказ (useCreateCashOrder), см. ShopPage.tsx.

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
    mutationFn: (data: { name?: string; birthday?: string; phone?: string; email?: string; profilePhotoUrl?: string }) => api.patch<Client>(`/clients/${clientId}`, data),
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

// --- Уведомления (P2.4) ---

// Колокольчик в шапке дергает тот же фид; для не-клиентов запрос выключен
// (эндпоинт только для CLIENT, лишний 403 в консоли не нужен).
export function useNotifications(enabled = true) {
  return useQuery({
    queryKey: ['notifications'],
    queryFn: () => api.get<NotificationsFeed>('/notifications'),
    enabled,
    refetchInterval: 60_000,
  })
}

export function useMarkNotificationRead() {
  const invalidate = useInvalidate([['notifications']])
  return useMutation({
    mutationFn: (id: string) => api.post(`/notifications/${id}/read`),
    onSuccess: invalidate,
  })
}

export function useMarkAllNotificationsRead() {
  const invalidate = useInvalidate([['notifications']])
  return useMutation({
    mutationFn: () => api.post('/notifications/read-all'),
    onSuccess: invalidate,
  })
}

// Включение Web Push (P2.4): разрешение → подписка браузера с VAPID-ключом
// сервера → регистрация подписки. Возвращает текст ошибки или null.
function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const output = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i)
  return output
}

export async function enablePushNotifications(): Promise<string | null> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return 'Браузер не поддерживает push-уведомления'
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return 'Разрешение на уведомления не выдано'
  try {
    const registration = await navigator.serviceWorker.ready
    const { publicKey } = await api.get<{ publicKey: string }>('/notifications/vapid-public-key')
    const sub = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) })
    const json = sub.toJSON()
    if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return 'Браузер вернул неполную подписку'
    await api.post('/notifications/subscribe', { endpoint: json.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth })
    return null
  } catch (err) {
    return err instanceof Error ? err.message : 'Не удалось оформить push-подписку'
  }
}

export type { ProgramDay }
