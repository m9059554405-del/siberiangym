import { ExternalLink } from 'lucide-react'
import { Avatar } from './ui/Avatar'
import { Badge } from './ui/Primitives'
import { Modal } from './ui/Modal'
import type { Trainer } from '../types'
import { getInitials } from '../lib/format'

const WEEKDAY_LABELS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']

export function TrainerProfileModal({ trainer, onClose }: { trainer: Trainer | null; onClose: () => void }) {
  return (
    <Modal open={!!trainer} onClose={onClose} title={trainer?.name ?? ''}>
      {trainer && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <Avatar initials={getInitials(trainer.name)} hue={trainer.avatarHue} size={56} />
            <div>
              <div className="font-semibold">{trainer.specialization}</div>
              <div className="text-xs text-[var(--text-faint)]">
                {trainer.experienceYears} лет опыта · {trainer.workHours.map((w) => WEEKDAY_LABELS[w.day]).join(', ')}
              </div>
            </div>
          </div>

          {trainer.fullBio && <p className="text-sm text-[var(--text-muted)]">{trainer.fullBio}</p>}

          {trainer.credentials.length > 0 && (
            <div>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-faint)]">
                Сертификаты и награды
              </h4>
              <div className="flex flex-col gap-2">
                {trainer.credentials.map((c) => (
                  <div key={c.id} className="flex items-center gap-2.5 rounded-lg bg-[var(--surface-sunken)] px-3 py-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{c.title}</div>
                      <div className="text-xs text-[var(--text-faint)]">
                        {c.issuedBy ?? ''} {c.year ? `· ${c.year}` : ''}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {trainer.competitionPhotos.length > 0 && (
            <div>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-faint)]">
                Фото с соревнований
              </h4>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {trainer.competitionPhotos.map((p) => (
                  <div key={p.id} className="flex w-24 shrink-0 flex-col items-center gap-1">
                    <img src={p.url} alt={p.caption ?? ''} className="h-20 w-24 rounded-xl object-cover" />
                    {p.caption && <span className="text-center text-[10px] text-[var(--text-faint)]">{p.caption}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {trainer.externalUrl && (
            <a
              href={trainer.externalUrl}
              target="_blank"
              rel="noreferrer"
              className="tap-scale flex items-center justify-center gap-1.5 rounded-xl border border-[var(--border)] py-2.5 text-sm font-medium text-[var(--accent-strong)] hover:bg-[var(--accent-soft)]"
            >
              <ExternalLink size={14} /> Внешняя страница тренера
            </a>
          )}

          {trainer.competitionPhotos.length === 0 && trainer.credentials.length === 0 && (
            <Badge tone="neutral">Профиль пока без дополнительных материалов</Badge>
          )}
        </div>
      )}
    </Modal>
  )
}
