let ctx: AudioContext | null = null

export function playBeep(frequency = 880, durationMs = 180) {
  try {
    if (!ctx) ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
    const oscillator = ctx.createOscillator()
    const gain = ctx.createGain()
    oscillator.type = 'sine'
    oscillator.frequency.value = frequency
    gain.gain.setValueAtTime(0.15, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + durationMs / 1000)
    oscillator.connect(gain)
    gain.connect(ctx.destination)
    oscillator.start()
    oscillator.stop(ctx.currentTime + durationMs / 1000)
  } catch {
    // аудио недоступно (например, без взаимодействия пользователя) — тихо игнорируем
  }
}

export function playDoubleBeep() {
  playBeep(880, 150)
  setTimeout(() => playBeep(1046, 220), 220)
}
