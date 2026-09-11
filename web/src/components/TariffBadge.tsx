import { useState } from 'react'
import { Check, Info } from 'lucide-react'
import { tariffById } from '../data/tariffs'
import { Badge } from './ui/Primitives'
import { Modal } from './ui/Modal'
import { formatMoney } from '../lib/format'
import type { Tariff } from '../types'

export function TariffBadge({ tariff }: { tariff: Tariff | null }) {
  const [open, setOpen] = useState(false)
  const info = tariffById(tariff)

  if (!info) return <Badge tone="neutral">Без тарифа</Badge>

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="tap-scale inline-flex items-center gap-1 rounded-full bg-[var(--accent-soft)] px-2.5 py-1 text-xs font-medium text-[var(--accent-strong)]"
      >
        Тариф: {info.name}
        <Info size={12} />
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={info.name}>
        <div className="flex flex-col gap-3">
          <p className="text-sm text-[var(--text-muted)]">{info.tagline}</p>
          <ul className="flex flex-col gap-2 text-sm">
            {info.features.map((f, i) => (
              <li key={i} className="flex items-start gap-2">
                <Check size={15} className="mt-0.5 shrink-0 text-[var(--accent-strong)]" />
                <span>{f}</span>
              </li>
            ))}
          </ul>
          <p className="text-base font-bold">{formatMoney(info.price)} ₽ / мес</p>
        </div>
      </Modal>
    </>
  )
}
