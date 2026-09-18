import { useState } from 'react'
import { CheckCircle2, Clock3 } from 'lucide-react'
import { useCheckinScan, useCheckins } from '../../hooks/useStaffApi'
import { Badge, Card, EmptyState, SectionTitle } from '../../components/ui/Primitives'
import { ReceiptScanPanel } from '../../components/ReceiptScanPanel'
import { playBeep, playDoubleBeep } from '../../lib/beep'
import type { CheckinScanResult, MembershipType } from '../../types'

const MEMBERSHIP_SHORT: Record<MembershipType, string> = {
  SINGLE: 'Разовое посещение',
  MONTHLY: 'Месячный абонемент',
  PACK10: 'Пакет 10 занятий',
  PACK20: 'Пакет 20 занятий',
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

// Контроль доступа на входе (P2.2): администратор сканирует QR клиента
// (код прохода в плашке «Текущий абонемент» на вкладке «Оплата» клиента),
// скана (статус/заморозка/срок, покрытие этой точки, остаток посещений),
// списывает визит у пакетных абонементов и пишет запись прохода. Повторный
// скан того же клиента в течение минуты — дебаунс, вторая запись не
// создаётся. Ниже — журнал проходов своей точки.
export function CheckinsPage() {
  const scan = useCheckinScan()
  const { data: checkins } = useCheckins()
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [result, setResult] = useState<CheckinScanResult | null>(null)

  function submit(raw: string, source: 'QR' | 'MANUAL') {
    scan.mutate(
      { code: raw, source },
      {
        onSuccess: (r) => {
          setResult(r)
          setErrorMessage(null)
          if (r.duplicate) playDoubleBeep()
          else playBeep(1400, 140)
        },
        onError: (err) => {
          setResult(null)
          setErrorMessage(err instanceof Error ? err.message : 'Не удалось зафиксировать проход')
          playDoubleBeep()
        },
      },
    )
  }

  const list = checkins ?? []

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-xl font-bold">Вход по QR</h1>
        <p className="text-sm text-[var(--text-muted)]">
          Скан кода из приложения клиента: абонемент проверяется на сервере в момент скана, проход попадает в журнал
        </p>
      </div>

      <Card>
        <SectionTitle title="Скан на входе" subtitle="Повторный скан того же клиента в течение минуты не записывается" />
        <ReceiptScanPanel
          onSubmit={submit}
          isPending={scan.isPending}
          errorMessage={errorMessage}
          onErrorChange={setErrorMessage}
          label="Код прохода"
          buttonLabel="Пропустить"
          placeholder="Наведите фокус сюда и отсканируйте QR клиента — или введите код вручную"
        />
        {result && (
          <div
            className={`mt-3 rounded-xl px-4 py-3 ${
              result.duplicate ? 'bg-amber-50 text-amber-900' : 'bg-emerald-50 text-emerald-900'
            }`}
          >
            <div className="flex items-center gap-2 font-semibold">
              {result.duplicate ? <Clock3 size={16} /> : <CheckCircle2 size={16} />}
              {result.duplicate ? 'Уже отмечен минуту назад — повтор не записан' : 'Проход разрешён'}
            </div>
            <p className="mt-1 text-sm">
              {result.client.name}
              {result.client.membership ? ` · ${MEMBERSHIP_SHORT[result.client.membership.type]}` : ''}
              {result.client.membership?.visitsLeft != null ? ` · осталось посещений: ${result.client.membership.visitsLeft}` : ''}
              {result.client.membership?.expiresAt ? ` · срок до ${result.client.membership.expiresAt.slice(0, 10)}` : ''}
            </p>
            <p className="text-xs opacity-70">Отметка: {fmtTime(result.checkin.at)}</p>
          </div>
        )}
      </Card>

      <Card>
        <SectionTitle title="Журнал проходов" subtitle={`последние ${list.length} на этой точке`} />
        {list.length === 0 ? (
          <EmptyState title="Проходов пока не было" subtitle="Отсканируйте первый QR клиента выше" />
        ) : (
          <div className="flex flex-col divide-y divide-[var(--border)]">
            {list.map((c) => (
              <div key={c.id} className="flex items-center justify-between gap-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{c.client?.name ?? 'Клиент'}</p>
                  <p className="text-xs text-[var(--text-faint)]">{fmtTime(c.at)}</p>
                </div>
                <Badge tone={c.source === 'QR' ? 'success' : 'neutral'}>{c.source === 'QR' ? 'QR' : 'вручную'}</Badge>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
