import { useState } from 'react'
import { AlertTriangle, Download, ShieldAlert, Trash2 } from 'lucide-react'
import { useConsentTexts, useExportMyData, useGrantConsent, useMyConsents, useRequestDataDeletion, useRevokeConsent } from '../hooks/useConsentsApi'
import { CLIENT_VISIBLE_CONSENT_TYPES } from '../lib/consentVisibility'
import { Badge, Button, Card, SectionTitle } from './ui/Primitives'
import { Modal } from './ui/Modal'
import type { ConsentType } from '../types'

// Раздел «Мои персональные данные» (152-ФЗ, P0.4) — статус согласий,
// выгрузка своих данных и запрос на удаление. Разница между "удаляется" и
// "хранится обезличенно" объясняется прямо в модалке подтверждения — по
// налоговому законодательству чеки и транзакции клуб обязан хранить
// независимо от отзыва согласия клиентом.
export function PersonalDataSection() {
  const { data: texts } = useConsentTexts()
  const { data: statuses } = useMyConsents()
  const grant = useGrantConsent()
  const revoke = useRevokeConsent()
  const exportData = useExportMyData()
  const requestDeletion = useRequestDataDeletion()

  const [revokeTarget, setRevokeTarget] = useState<ConsentType | null>(null)
  const [deletionOpen, setDeletionOpen] = useState(false)
  const [deletionReason, setDeletionReason] = useState('')
  const [deletionDone, setDeletionDone] = useState(false)

  if (!texts || !statuses) return null

  // Если клиент несовершеннолетний, сервер понижает required до false для
  // "взрослых" типов (PDN_ADULT/HEALTH_DATA/ACTIVITY_WAIVER_ADULT) — их за
  // него подписывает законный представитель через карточку клиента
  // (GuardianSection, P0.6), не сам ребёнок здесь. Расхождение
  // text.required (всегда true для этих типов) и status.required (false
  // для несовершеннолетнего) — единственный сигнал об этом, доступный на
  // этой странице, поэтому по нему и прячем такие строки.
  const visible = CLIENT_VISIBLE_CONSENT_TYPES.map((type) => ({
    type,
    text: texts.texts.find((t) => t.type === type),
    status: statuses.find((s) => s.type === type),
  })).filter((v) => v.text && v.status && !(v.text.required && !v.status.required))

  async function downloadExport() {
    const data = await exportData.mutateAsync()
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `siberiangym-moi-dannye-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <section>
      <SectionTitle title="Мои персональные данные" subtitle="Согласия по 152-ФЗ, выгрузка и удаление данных" />
      <Card className="flex flex-col gap-3">
        <div className="flex flex-col gap-2">
          {visible.map(({ type, text, status }) => (
            <div key={type} className="flex items-center justify-between gap-3 rounded-lg bg-[var(--surface-sunken)] px-3 py-2.5">
              <div className="min-w-0">
                <div className="text-sm font-medium">{text!.title}</div>
                <div className="text-xs text-[var(--text-faint)]">{status!.required ? 'Обязательно для использования приложения' : 'Добровольно'}</div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Badge tone={status!.granted ? 'success' : 'neutral'}>{status!.granted ? 'Дано' : 'Не дано'}</Badge>
                {status!.granted ? (
                  <Button size="sm" variant="ghost" onClick={() => setRevokeTarget(type)}>
                    Отозвать
                  </Button>
                ) : (
                  <Button size="sm" variant="secondary" onClick={() => grant.mutate(type)} disabled={grant.isPending}>
                    Дать
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-2 border-t border-[var(--border)] pt-3 sm:flex-row">
          <Button variant="secondary" className="flex-1" onClick={downloadExport} disabled={exportData.isPending}>
            <Download size={14} /> Скачать мои данные
          </Button>
          <Button variant="danger" className="flex-1" onClick={() => setDeletionOpen(true)}>
            <Trash2 size={14} /> Запросить удаление данных
          </Button>
        </div>
      </Card>

      <Modal open={!!revokeTarget} onClose={() => setRevokeTarget(null)} title="Отозвать согласие?">
        {revokeTarget && (
          <div className="flex flex-col gap-3">
            {texts.texts.find((t) => t.type === revokeTarget)?.required && (
              <div className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
                <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                <span>Отзыв согласия, необходимого для исполнения договора, может повлечь невозможность дальнейшего оказания вам услуг клубом до повторного предоставления согласия.</span>
              </div>
            )}
            <div className="flex gap-2">
              <Button variant="secondary" className="flex-1" onClick={() => setRevokeTarget(null)}>
                Отмена
              </Button>
              <Button
                variant="danger"
                className="flex-1"
                onClick={() => revoke.mutate(revokeTarget, { onSuccess: () => setRevokeTarget(null) })}
                disabled={revoke.isPending}
              >
                Отозвать
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={deletionOpen}
        onClose={() => {
          setDeletionOpen(false)
          setDeletionDone(false)
        }}
        title="Запросить удаление данных"
      >
        {deletionDone ? (
          <div className="flex flex-col items-center gap-2 py-4 text-center">
            <Badge tone="success">Запрос выполнен ✓</Badge>
            <p className="text-sm text-[var(--text-muted)]">Фото прогресса, замеры, женский календарь и контакты удалены.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex items-start gap-2 rounded-lg bg-[var(--surface-sunken)] px-3 py-2.5 text-sm">
              <ShieldAlert size={16} className="mt-0.5 shrink-0 text-[var(--text-muted)]" />
              <div>
                <p className="font-medium">Будет удалено: фото прогресса, замеры, женский календарь, телефон и email.</p>
                <p className="mt-1 text-[var(--text-faint)]">
                  Абонементы, чеки и транзакции по закону обязаны храниться клубом (налоговый учёт) — они останутся, но новые персональные
                  данные к вашему профилю с этого момента привязываться не будут без повторного согласия.
                </p>
              </div>
            </div>
            <textarea
              value={deletionReason}
              onChange={(e) => setDeletionReason(e.target.value)}
              placeholder="Причина (необязательно)"
              rows={2}
              className="resize-none rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
            />
            <Button
              variant="danger"
              onClick={() => requestDeletion.mutate(deletionReason.trim() || undefined, { onSuccess: () => setDeletionDone(true) })}
              disabled={requestDeletion.isPending}
            >
              Подтвердить удаление
            </Button>
          </div>
        )}
      </Modal>
    </section>
  )
}
