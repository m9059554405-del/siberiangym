import type { Tariff } from '../types'

export interface TariffInfo {
  id: Tariff
  name: string
  price: number
  tagline: string
  features: string[]
}

export const TARIFFS: TariffInfo[] = [
  {
    id: 'BASIC',
    name: 'Базовый',
    price: 2500,
    tagline: 'Помощь на тренировках и контроль техники',
    features: ['Помощь в выполнении упражнений', 'Постановка техники', 'Консультации тренера'],
  },
  {
    id: 'COACHING',
    name: 'Ведение',
    price: 4900,
    tagline: 'Полное сопровождение прогресса тренером',
    features: [
      'Всё из тарифа «Базовый»',
      'Фотоотчёты — еда и фото в полный рост',
      'Замеры тела и данные биоимпедансометрии',
      'Обратная связь с тренером в приложении',
    ],
  },
  {
    id: 'INDIVIDUAL',
    name: 'Индивидуальные тренировки',
    price: 15900,
    tagline: 'Максимум внимания и личные тренировки',
    features: ['Всё из тарифа «Ведение»', '3 индивидуальные тренировки в неделю с тренером'],
  },
]

export function tariffById(id: string | null | undefined): TariffInfo | undefined {
  return TARIFFS.find((t) => t.id === id)
}

export function tariffUnlocksCoaching(tariff: string | null | undefined): boolean {
  return tariff === 'COACHING' || tariff === 'INDIVIDUAL'
}
export function tariffUnlocksPersonalSlots(tariff: string | null | undefined): boolean {
  return tariff === 'INDIVIDUAL'
}
