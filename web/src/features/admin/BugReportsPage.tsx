import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { RefreshCw } from 'lucide-react'
import { api, ApiError } from '../../lib/api'
import type { BugReport, BugReportStatus } from '../../types'
import { Badge, Button, Card, EmptyState, SectionTitle } from '../../components/ui/Primitives'

const STATUS: Record<BugReportStatus, { label: string; tone: 'accent' | 'warning' | 'success' | 'danger' }> = {
  NEW: { label: 'Новый', tone: 'accent' },
  IN_PROGRESS: { label: 'В работе', tone: 'warning' },
  RESOLVED: { label: 'Решён', tone: 'success' },
  REJECTED: { label: 'Отклонён', tone: 'danger' },
}

export function BugReportsPage() {
  const queryClient = useQueryClient()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [filter, setFilter] = useState<BugReportStatus | 'ALL'>('ALL')
  const [note, setNote] = useState('')
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const reportsQuery = useQuery({
    queryKey: ['bug-reports', filter],
    queryFn: () => api.get<BugReport[]>(`/bug-reports${filter === 'ALL' ? '' : `?status=${filter}`}`),
  })
  const reports = reportsQuery.data ?? []
  const selected = reports.find((report) => report.id === selectedId) ?? null

  useEffect(() => {
    let currentUrl: string | null = null
    if (!selected?.screenshotMime) return
    void api.download(`/bug-reports/${selected.id}/screenshot`).then((blob) => {
      currentUrl = URL.createObjectURL(blob)
      setScreenshotUrl(currentUrl)
    }).catch(() => setScreenshotUrl(null))
    return () => {
      if (currentUrl) URL.revokeObjectURL(currentUrl)
    }
  }, [selected?.id, selected?.screenshotMime])

  async function update(status: BugReportStatus) {
    if (!selected) return
    setSaving(true)
    setActionError(null)
    try {
      const updated = await api.patch<BugReport>(`/bug-reports/${selected.id}`, { status, resolutionNote: note })
      queryClient.setQueryData<BugReport[]>(['bug-reports', filter], (items = []) => {
        if (filter !== 'ALL' && status !== filter) return items.filter((item) => item.id !== updated.id)
        return items.map((item) => item.id === updated.id ? updated : item)
      })
      if (filter !== 'ALL' && status !== filter) setSelectedId(null)
      setNote(updated.resolutionNote ?? '')
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Не удалось изменить багрепорт')
    } finally {
      setSaving(false)
    }
  }

  function choose(report: BugReport) {
    setSelectedId(report.id)
    setScreenshotUrl(null)
    setNote(report.resolutionNote ?? '')
  }

  const error = actionError ?? (reportsQuery.error instanceof ApiError ? reportsQuery.error.message : reportsQuery.error ? 'Не удалось загрузить багрепорты' : null)

  return (
    <div>
      <SectionTitle
        title="Багрепорты"
        subtitle="Сообщения пользователей, снимки интерфейса и технические данные"
        action={<Button variant="ghost" size="sm" onClick={() => reportsQuery.refetch()}><RefreshCw size={15} /> Обновить</Button>}
      />
      <div className="mb-4 flex flex-wrap gap-2">
        {(['ALL', 'NEW', 'IN_PROGRESS', 'RESOLVED', 'REJECTED'] as const).map((status) => (
          <Button key={status} size="sm" variant={filter === status ? 'primary' : 'secondary'} onClick={() => { setFilter(status); setSelectedId(null); setScreenshotUrl(null) }}>
            {status === 'ALL' ? 'Все' : STATUS[status].label}
          </Button>
        ))}
      </div>
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
      <div className="grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
        <div className="space-y-2">
          {reportsQuery.isLoading ? <Card>Загрузка…</Card> : reports.length === 0 ? <EmptyState title="Багрепортов нет" /> : reports.map((report) => (
            <button key={report.id} type="button" onClick={() => choose(report)} className="block w-full text-left">
              <Card className={selected?.id === report.id ? 'ring-2 ring-[var(--accent)]' : ''}>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <Badge tone={STATUS[report.status].tone}>{STATUS[report.status].label}</Badge>
                  <span className="text-xs text-[var(--text-faint)]">{new Date(report.createdAt).toLocaleString('ru-RU')}</span>
                </div>
                <p className="line-clamp-2 text-sm font-medium">{report.problem}</p>
                <p className="mt-2 text-xs text-[var(--text-faint)]">{report.reporter.email ?? report.reporter.name ?? report.reporter.id} · {report.reporter.role}</p>
              </Card>
            </button>
          ))}
        </div>
        <div>
          {!selected ? <EmptyState title="Выберите багрепорт" subtitle="Здесь появятся подробности и инструменты обработки" /> : (
            <Card className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Badge tone={STATUS[selected.status].tone}>{STATUS[selected.status].label}</Badge>
                <span className="text-sm text-[var(--text-muted)]">{selected.gym.name}</span>
              </div>
              <div>
                <h3 className="mb-1 text-sm font-semibold">Что не так</h3>
                <p className="whitespace-pre-wrap text-sm">{selected.problem}</p>
              </div>
              <div>
                <h3 className="mb-1 text-sm font-semibold">Как должно быть</h3>
                <p className="whitespace-pre-wrap text-sm">{selected.expected}</p>
              </div>
              {screenshotUrl && (
                <div>
                  <h3 className="mb-2 text-sm font-semibold">Снимок интерфейса</h3>
                  <a href={screenshotUrl} target="_blank" rel="noreferrer">
                    <img src={screenshotUrl} alt="Снимок интерфейса" className="max-h-[520px] w-full rounded-xl border border-[var(--border)] object-contain" />
                  </a>
                </div>
              )}
              <div>
                <h3 className="mb-2 text-sm font-semibold">Телеметрия</h3>
                <pre className="max-h-72 overflow-auto rounded-xl bg-[var(--surface-sunken)] p-3 text-xs">{JSON.stringify(selected.telemetry, null, 2)}</pre>
              </div>
              <label className="block text-sm font-medium">
                Комментарий системного администратора
                <textarea
                  rows={4}
                  maxLength={4000}
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  className="mt-1 w-full resize-y rounded-xl border border-[var(--border)] bg-[var(--surface-raised)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
                />
              </label>
              <div className="flex flex-wrap gap-2">
                <Button disabled={saving} variant="secondary" onClick={() => update('IN_PROGRESS')}>Взять в работу</Button>
                <Button disabled={saving} onClick={() => update('RESOLVED')}>Отметить решённым</Button>
                <Button disabled={saving} variant="danger" onClick={() => update('REJECTED')}>Отклонить</Button>
                <Button disabled={saving} variant="ghost" onClick={() => update('NEW')}>Вернуть в новые</Button>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
