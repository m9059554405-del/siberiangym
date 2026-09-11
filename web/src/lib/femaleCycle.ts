export interface CycleInfo {
  cycleDay: number
  phase: string
  avgLength: number
  nextPredicted: string
}

export function computeCycleInfo(dates: string[], todayIso: string): CycleInfo | null {
  if (dates.length === 0) return null
  const sorted = [...dates].sort()
  const last = sorted[sorted.length - 1]

  let avgLength = 28
  if (sorted.length >= 2) {
    const diffs: number[] = []
    for (let i = 1; i < sorted.length; i++) {
      diffs.push((new Date(sorted[i]).getTime() - new Date(sorted[i - 1]).getTime()) / 86400000)
    }
    avgLength = Math.round(diffs.reduce((a, b) => a + b, 0) / diffs.length) || 28
  }

  const daysSince = Math.floor((new Date(todayIso).getTime() - new Date(last).getTime()) / 86400000)
  const cycleDay = (((daysSince % avgLength) + avgLength) % avgLength) + 1
  const ovulationDay = Math.round(avgLength / 2)

  let phase = 'Лютеиновая фаза'
  if (cycleDay <= 5) phase = 'Менструация'
  else if (cycleDay < ovulationDay - 1) phase = 'Фолликулярная фаза'
  else if (cycleDay <= ovulationDay + 1) phase = 'Овуляция'

  const nextPredicted = new Date(new Date(last).getTime() + avgLength * 86400000).toISOString().slice(0, 10)
  return { cycleDay, phase, avgLength, nextPredicted }
}
