import type { Exercise, MuscleGroup } from '../types'

// Реальных фото техники нет — генерируем стилизованные иллюстративные
// плейсхолдеры (2 фазы движения) на основе оборудования и группы мышц.

const MUSCLE_HUE: Record<MuscleGroup, number> = {
  CHEST: 210,
  BACK: 260,
  LEGS: 150,
  SHOULDERS: 30,
  ARMS: 340,
  ABS: 190,
  CARDIO: 10,
}

const EQUIPMENT_EMOJI: [pattern: RegExp, emoji: string][] = [
  [/штанга|гриф/i, '🏋️'],
  [/гантел/i, '💪'],
  [/гиря/i, '🏋️‍♀️'],
  [/тренажёр|блок/i, '⚙️'],
  [/скамья/i, '🛋️'],
  [/турник/i, '🤸'],
  [/брусья/i, '🤸‍♂️'],
  [/дорожка/i, '🏃'],
  [/велотренажёр/i, '🚴'],
  [/гребн/i, '🚣'],
  [/скакалка/i, '🪢'],
  [/эллипс/i, '🏃‍♀️'],
]

function equipmentEmoji(equipment: string): string {
  for (const [pattern, emoji] of EQUIPMENT_EMOJI) {
    if (pattern.test(equipment)) return emoji
  }
  return '🧍'
}

export interface ExercisePhaseImage {
  phase: string
  emoji: string
  hue: number
}

export function getExerciseImages(exercise: Exercise): [ExercisePhaseImage, ExercisePhaseImage] {
  const hue = MUSCLE_HUE[exercise.muscleGroup]
  const emoji = equipmentEmoji(exercise.equipment ?? '')
  return [
    { phase: 'Исходное положение', emoji, hue },
    { phase: 'Финальная точка', emoji, hue: (hue + 25) % 360 },
  ]
}
