import { Construction } from 'lucide-react'
import { Card } from '../components/ui/Primitives'

export function ComingSoonPage({ title }: { title: string }) {
  return (
    <Card className="flex flex-col items-center gap-2 py-12 text-center">
      <Construction size={22} className="text-[var(--text-faint)]" />
      <p className="font-medium text-[var(--text-muted)]">{title}</p>
      <p className="text-sm text-[var(--text-faint)]">Этот раздел появится в одной из следующих версий.</p>
    </Card>
  )
}
