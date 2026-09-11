import { MUSCLE_GROUPS } from '../data/exercises'
import type { Exercise, MuscleGroup, WorkoutLogEntry } from '../types'

function parseKg(load: string): number | null {
  const m = /^(\d+(?:\.\d+)?)\s*кг$/.exec(load.trim())
  return m ? parseFloat(m[1]) : null
}

function parseRepsNumber(reps: string): number {
  const range = /^(\d+)-(\d+)/.exec(reps)
  if (range) return (Number(range[1]) + Number(range[2])) / 2
  const minutes = /^(\d+)\s*мин/.exec(reps)
  if (minutes) return Number(minutes[1])
  const seconds = /(\d+)\s*сек/.exec(reps)
  if (seconds) return Number(seconds[1]) / 20
  const plain = /^(\d+)/.exec(reps)
  if (plain) return Number(plain[1])
  return 1
}

function scoreForSet(load: string, reps: string): number {
  const kg = parseKg(load)
  const repsN = parseRepsNumber(reps)
  return kg !== null ? repsN * kg : repsN * 15
}

export interface MuscleLoadChange {
  muscleGroup: MuscleGroup
  currentVolume: number
  previousVolume: number
  pctChange: number | null
  kgChange: number
}

export function getMuscleLoadChange(logs: WorkoutLogEntry[], exercises: Exercise[], periodDays = 30): MuscleLoadChange[] {
  const today = new Date()
  const exerciseById = new Map(exercises.map((e) => [e.id, e]))
  const currentStart = new Date(today.getTime() - (periodDays - 1) * 86400000)
  const prevStart = new Date(today.getTime() - (periodDays * 2 - 1) * 86400000)
  const prevEnd = new Date(today.getTime() - periodDays * 86400000)

  const totals: Record<string, { current: number; previous: number }> = {}
  for (const g of MUSCLE_GROUPS) totals[g] = { current: 0, previous: 0 }

  for (const log of logs) {
    if (log.status === 'MISSED') continue
    const d = new Date(log.date)
    let bucket: 'current' | 'previous' | null = null
    if (d >= currentStart && d <= today) bucket = 'current'
    else if (d >= prevStart && d <= prevEnd) bucket = 'previous'
    if (!bucket) continue
    for (const ex of log.exercises) {
      const info = exerciseById.get(ex.exerciseId)
      if (!info) continue
      let vol = 0
      for (const set of ex.sets) {
        if (!set.completed) continue
        vol += scoreForSet(set.load, set.reps)
      }
      totals[info.muscleGroup][bucket] += vol
    }
  }

  return MUSCLE_GROUPS.map((g) => {
    const { current, previous } = totals[g]
    const pctChange = previous > 0 ? Math.round(((current - previous) / previous) * 100) : current > 0 ? 100 : null
    return {
      muscleGroup: g,
      currentVolume: Math.round(current),
      previousVolume: Math.round(previous),
      pctChange,
      kgChange: Math.round(current - previous),
    }
  })
}
