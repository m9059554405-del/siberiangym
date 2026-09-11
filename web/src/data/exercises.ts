import type { MuscleGroup } from '../types'

export const MUSCLE_GROUPS: MuscleGroup[] = ['CHEST', 'BACK', 'LEGS', 'SHOULDERS', 'ARMS', 'ABS', 'CARDIO']

export const MUSCLE_GROUP_LABEL: Record<MuscleGroup, string> = {
  CHEST: 'Грудь',
  BACK: 'Спина',
  LEGS: 'Ноги',
  SHOULDERS: 'Плечи',
  ARMS: 'Руки',
  ABS: 'Пресс',
  CARDIO: 'Кардио',
}
