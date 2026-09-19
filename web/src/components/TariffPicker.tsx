import { useState } from 'react'
import { Check, Info } from 'lucide-react'
import { TARIFFS, tariffById, tariffPrice } from '../data/tariffs'
import { usePricing } from '../hooks/useClientApi'
import { Badge, Button, Card } from './ui/Primitives'
import { Modal } from './ui/Modal'
import type { Tariff } from '../types'
import { formatMoney } from '../lib/format'

export function TariffPicker({
  currentTariff,
  onSelect,
}: {
  currentTariff?: Tariff | null
  onSelect: (tariff: Tariff) => void
}) {
  const [infoTariff, setInfoTariff] = useState<Tariff | null>(null)
  // Цена тарифа — настройка точки (P4.2), не константа из демо-версии.
  const { data: pricing } = usePricing()
  const infoInfo = tariffById(infoTariff)

  return (
    <>
      <div className="flex flex-col gap-2.5">
        {TARIFFS.map((t) => {
          const isCurrent = currentTariff === t.id
          return (
            <Card key={t.id} className={isCurrent ? 'border-2 border-[var(--accent)]' : ''}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold">{t.name}</span>
                    <button
                      onClick={() => setInfoTariff(t.id)}
                      title="Подробнее о тарифе"
                      className="tap-scale flex h-4.5 w-4.5 items-center justify-center rounded-full bg-[var(--surface-sunken)] text-[var(--text-muted)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent-strong)]"
                    >
                      <Info size={11} />
                    </button>
                    {isCurrent && <Badge tone="success">Текущий</Badge>}
                  </div>
                  <p className="mt-0.5 text-xs text-[var(--text-muted)]">{t.tagline}</p>
                </div>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-lg font-bold">{formatMoney(tariffPrice(t.id, pricing))} ₽/мес</span>
                <Button size="sm" variant={isCurrent ? 'secondary' : 'primary'} disabled={isCurrent} onClick={() => onSelect(t.id)}>
                  {isCurrent ? 'Выбран' : 'Выбрать'}
                </Button>
              </div>
            </Card>
          )
        })}
      </div>

      <Modal open={!!infoTariff} onClose={() => setInfoTariff(null)} title={infoInfo?.name ?? ''}>
        {infoInfo && (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-[var(--text-muted)]">{infoInfo.tagline}</p>
            <ul className="flex flex-col gap-2 text-sm">
              {infoInfo.features.map((f, i) => (
                <li key={i} className="flex items-start gap-2">
                  <Check size={15} className="mt-0.5 shrink-0 text-[var(--accent-strong)]" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            <p className="text-base font-bold">{formatMoney(infoTariff ? tariffPrice(infoTariff, pricing) : 0)} ₽ / мес</p>
          </div>
        )}
      </Modal>
    </>
  )
}
