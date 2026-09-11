import { useEffect, useRef, useState } from 'react'
import { Pause, Play, RotateCcw, Timer } from 'lucide-react'
import { playBeep, playDoubleBeep } from '../lib/beep'

function formatMMSS(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

export function RestTimer({ defaultSeconds = 180 }: { defaultSeconds?: number }) {
  const [duration, setDuration] = useState(defaultSeconds)
  const [remaining, setRemaining] = useState(defaultSeconds)
  const [running, setRunning] = useState(false)
  const warnedRef = useRef(false)

  useEffect(() => {
    if (!running) return
    if (remaining <= 0) {
      setRunning(false)
      return
    }
    const id = setTimeout(() => {
      setRemaining((r) => {
        const next = r - 1
        if (next === 10 && !warnedRef.current) {
          warnedRef.current = true
          playBeep(880, 160)
        }
        if (next === 0) playDoubleBeep()
        return next
      })
    }, 1000)
    return () => clearTimeout(id)
  }, [running, remaining])

  function start() {
    warnedRef.current = false
    setRunning(true)
  }
  function reset(seconds = duration) {
    setRunning(false)
    warnedRef.current = false
    setRemaining(seconds)
  }

  const pct = duration > 0 ? Math.max(0, Math.min(100, (remaining / duration) * 100)) : 0

  return (
    <div className="flex items-center gap-2 rounded-xl bg-[var(--surface-sunken)] px-3 py-2">
      <Timer size={15} className="text-[var(--text-faint)]" />
      <div className="flex-1">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--border)]">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${pct}%`, background: remaining <= 10 ? '#ef4444' : 'var(--accent)' }}
          />
        </div>
      </div>
      <span className="w-10 text-right text-sm font-semibold tabular-nums">{formatMMSS(remaining)}</span>
      {!running ? (
        <button onClick={start} className="tap-scale rounded-lg bg-[var(--accent)] p-1.5 text-white">
          <Play size={13} />
        </button>
      ) : (
        <button onClick={() => setRunning(false)} className="tap-scale rounded-lg bg-[var(--surface-raised)] p-1.5">
          <Pause size={13} />
        </button>
      )}
      <button onClick={() => reset()} className="tap-scale rounded-lg bg-[var(--surface-raised)] p-1.5">
        <RotateCcw size={13} />
      </button>
      <select
        value={duration}
        onChange={(e) => {
          const v = Number(e.target.value)
          setDuration(v)
          reset(v)
        }}
        className="rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] px-1.5 py-1 text-[11px]"
      >
        <option value={60}>1 мин</option>
        <option value={90}>1.5 мин</option>
        <option value={120}>2 мин</option>
        <option value={180}>3 мин</option>
        <option value={300}>5 мин</option>
      </select>
    </div>
  )
}
