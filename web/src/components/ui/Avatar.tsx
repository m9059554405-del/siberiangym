interface AvatarProps {
  initials: string
  hue: number
  size?: number
}

export function Avatar({ initials, hue, size = 40 }: AvatarProps) {
  const bg = `hsl(${hue}, 62%, 92%)`
  const fg = `hsl(${hue}, 55%, 32%)`
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full font-semibold"
      style={{ width: size, height: size, background: bg, color: fg, fontSize: size * 0.38 }}
    >
      {initials}
    </div>
  )
}
