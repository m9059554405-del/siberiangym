import { useState } from 'react'
import type { MuscleLoadChange } from '../lib/muscleLoad'
import type { MuscleGroup } from '../types'

interface SubMuscle {
  file: string
  label: string
  group: MuscleGroup
}

const SUB_MUSCLES: SubMuscle[] = [
  { file: '04_chest_pectorals.png', label: 'Грудные', group: 'CHEST' },
  { file: '01_trapezius_front.png', label: 'Трапеции (спереди)', group: 'BACK' },
  { file: '02_trapezius_back_full.png', label: 'Трапеции (сзади)', group: 'BACK' },
  { file: '10_rhomboids_upper_back.png', label: 'Ромбовидные', group: 'BACK' },
  { file: '11_lats_widest_back.png', label: 'Широчайшие', group: 'BACK' },
  { file: '03_shoulders_front_deltoids.png', label: 'Дельты (передние)', group: 'SHOULDERS' },
  { file: '05_rear_deltoids.png', label: 'Дельты (задние)', group: 'SHOULDERS' },
  { file: '06_biceps.png', label: 'Бицепс', group: 'ARMS' },
  { file: '07_triceps.png', label: 'Трицепс', group: 'ARMS' },
  { file: '08_forearms_front.png', label: 'Предплечья (перед)', group: 'ARMS' },
  { file: '13_forearms_back.png', label: 'Предплечья (зад)', group: 'ARMS' },
  { file: '09_abs.png', label: 'Пресс', group: 'ABS' },
  { file: '14_quadriceps.png', label: 'Квадрицепс', group: 'LEGS' },
  { file: '15_adductors_inner_thigh.png', label: 'Приводящие', group: 'LEGS' },
  { file: '16_hamstrings_back_thigh.png', label: 'Задняя пов. бедра', group: 'LEGS' },
  { file: '12_glutes.png', label: 'Ягодичные', group: 'LEGS' },
  { file: '17_calves.png', label: 'Икры', group: 'LEGS' },
]

const GROUP_LABEL: Record<MuscleGroup, string> = {
  CHEST: 'Грудь',
  BACK: 'Спина',
  LEGS: 'Ноги',
  SHOULDERS: 'Плечи',
  ARMS: 'Руки',
  ABS: 'Пресс',
  CARDIO: 'Кардио',
}

function filterForChange(pct: number | null): string {
  if (pct === null) return 'grayscale(1) opacity(0.32)'
  if (pct <= -5) return 'hue-rotate(190deg) saturate(1.4) opacity(0.9)'
  if (pct < 5) return 'grayscale(0.45) opacity(0.55)'
  if (pct < 20) return 'hue-rotate(28deg) saturate(1.15)'
  if (pct < 45) return 'saturate(1.15)'
  return 'saturate(1.5) brightness(1.05)'
}

function dotColorForChange(pct: number | null): string {
  if (pct === null) return '#9ca3af'
  if (pct <= -5) return '#3b82f6'
  if (pct < 5) return '#9ca3af'
  if (pct < 20) return '#fbbf24'
  if (pct < 45) return '#f97316'
  return '#e11d48'
}

function formatChange(c?: MuscleLoadChange): string {
  if (!c || c.pctChange === null) return 'нет данных'
  const sign = c.pctChange >= 0 ? '+' : ''
  const kgSign = c.kgChange >= 0 ? '+' : ''
  return `${sign}${c.pctChange}% · ${kgSign}${c.kgChange} усл. ед.`
}

export function BodyDiagram({ changes }: { changes: MuscleLoadChange[] }) {
  const [hovered, setHovered] = useState<MuscleGroup | null>(null)
  const byGroup = new Map(changes.map((c) => [c.muscleGroup, c]))
  const legendGroups: MuscleGroup[] = ['CHEST', 'BACK', 'LEGS', 'SHOULDERS', 'ARMS', 'ABS']

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {SUB_MUSCLES.map((m) => {
          const change = byGroup.get(m.group)
          const dimmed = hovered !== null && hovered !== m.group
          return (
            <button
              key={m.file}
              onMouseEnter={() => setHovered(m.group)}
              onMouseLeave={() => setHovered(null)}
              className="tap-scale flex flex-col items-center gap-1 rounded-xl border border-[var(--border)] bg-[var(--surface-raised)] p-1.5 text-center"
              style={{ opacity: dimmed ? 0.45 : 1, transition: 'opacity .15s' }}
            >
              <img
                src={`muscles/${m.file}`}
                alt={m.label}
                className="h-16 w-16 object-contain sm:h-20 sm:w-20"
                style={{ filter: filterForChange(change?.pctChange ?? null) }}
              />
              <span className="text-[10px] leading-tight text-[var(--text-muted)]">{m.label}</span>
              <span className="text-[10px] font-semibold" style={{ color: dotColorForChange(change?.pctChange ?? null) }}>
                {change?.pctChange !== undefined && change.pctChange !== null ? `${change.pctChange >= 0 ? '+' : ''}${change.pctChange}%` : '—'}
              </span>
            </button>
          )
        })}
      </div>

      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[10px] text-[var(--text-faint)]">
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ background: '#3b82f6' }} /> спад</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ background: '#9ca3af' }} /> нет данных / стабильно</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ background: '#fbbf24' }} /> рост</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ background: '#e11d48' }} /> сильный рост</span>
      </div>

      <div className="space-y-1.5 border-t border-[var(--border)] pt-3">
        {legendGroups.map((group) => {
          const change = byGroup.get(group)
          const fill = dotColorForChange(change?.pctChange ?? null)
          return (
            <div
              key={group}
              onMouseEnter={() => setHovered(group)}
              onMouseLeave={() => setHovered(null)}
              className="flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-sm"
              style={{ background: hovered === group ? 'var(--surface-sunken)' : 'transparent' }}
            >
              <span className="flex shrink-0 items-center gap-2">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: fill }} />
                {GROUP_LABEL[group]}
              </span>
              <span className="whitespace-nowrap text-right text-[var(--text-muted)]">{formatChange(change)}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
