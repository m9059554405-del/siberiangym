import type { ProgressPhoto } from '../types'

export function PhotoTile({ photo, size = 84 }: { photo: ProgressPhoto; size?: number }) {
  return (
    <div className="flex flex-col items-center gap-1" style={{ width: size }}>
      <div
        className="flex items-center justify-center overflow-hidden rounded-xl bg-cover bg-center text-3xl"
        style={{ width: size, height: size, backgroundImage: `url(${photo.url})` }}
      />
      <span className="text-[10px] text-[var(--text-faint)]">{photo.date.slice(0, 10)}</span>
    </div>
  )
}
