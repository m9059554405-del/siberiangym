import { useEffect, useRef, useState } from 'react'
import html2canvas from 'html2canvas'
import { Bug, Camera } from 'lucide-react'
import { api, ApiError } from '../lib/api'
import { Modal } from './ui/Modal'
import { Button } from './ui/Primitives'

interface ClientError {
  message: string
  source?: string
  line?: number
  column?: number
  at: string
}

function canvasToBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.82))
}

export function BugReportButton() {
  const [open, setOpen] = useState(false)
  const [problem, setProblem] = useState('')
  const [expected, setExpected] = useState('')
  const [screenshot, setScreenshot] = useState<Blob | null>(null)
  const [capturing, setCapturing] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const errors = useRef<ClientError[]>([])

  useEffect(() => {
    const onError = (event: ErrorEvent) => {
      errors.current = [...errors.current.slice(-9), {
        message: event.message,
        source: event.filename || undefined,
        line: event.lineno || undefined,
        column: event.colno || undefined,
        at: new Date().toISOString(),
      }]
    }
    const onRejection = (event: PromiseRejectionEvent) => {
      const message = event.reason instanceof Error ? event.reason.message : String(event.reason)
      errors.current = [...errors.current.slice(-9), { message, at: new Date().toISOString() }]
    }
    window.addEventListener('error', onError)
    window.addEventListener('unhandledrejection', onRejection)
    return () => {
      window.removeEventListener('error', onError)
      window.removeEventListener('unhandledrejection', onRejection)
    }
  }, [])

  async function startReport() {
    setCapturing(true)
    setError(null)
    setSent(false)
    try {
      const canvas = await html2canvas(document.documentElement, {
        useCORS: true,
        logging: false,
        scale: Math.min(window.devicePixelRatio, 1.5),
        windowWidth: document.documentElement.scrollWidth,
        windowHeight: document.documentElement.scrollHeight,
      })
      setScreenshot(await canvasToBlob(canvas))
    } catch {
      setScreenshot(null)
    } finally {
      setCapturing(false)
      setOpen(true)
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setSending(true)
    setError(null)
    try {
      const telemetry = {
        url: window.location.href,
        route: `${window.location.pathname}${window.location.hash}`,
        capturedAt: new Date().toISOString(),
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        language: navigator.language,
        languages: navigator.languages,
        online: navigator.onLine,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        viewport: { width: window.innerWidth, height: window.innerHeight, devicePixelRatio: window.devicePixelRatio },
        screen: { width: window.screen.width, height: window.screen.height, colorDepth: window.screen.colorDepth },
        referrer: document.referrer,
        visibilityState: document.visibilityState,
        connection: 'connection' in navigator ? (navigator as Navigator & { connection?: { effectiveType?: string; downlink?: number; rtt?: number; saveData?: boolean } }).connection : undefined,
        clientErrors: errors.current,
      }
      const form = new FormData()
      form.append('problem', problem)
      form.append('expected', expected)
      form.append('telemetry', JSON.stringify(telemetry))
      if (screenshot) form.append('screenshot', screenshot, 'screenshot.jpg')
      await api.upload('/bug-reports', form)
      setSent(true)
      setProblem('')
      setExpected('')
      setScreenshot(null)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось отправить отчёт')
    } finally {
      setSending(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={startReport}
        disabled={capturing}
        title="Сообщить об ошибке"
        className="tap-scale fixed bottom-5 right-5 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-red-600 text-white shadow-lg hover:bg-red-700 disabled:opacity-60"
      >
        {capturing ? <Camera className="animate-pulse" size={20} /> : <Bug size={21} />}
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Сообщить об ошибке">
        {sent ? (
          <div className="space-y-4">
            <p className="text-sm text-green-700">Отчёт отправлен системному администратору.</p>
            <Button className="w-full" onClick={() => setOpen(false)}>Закрыть</Button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <p className="text-xs text-[var(--text-faint)]">
              {screenshot ? 'Снимок интерфейса приложен автоматически.' : 'Снимок создать не удалось, но отчёт можно отправить.'}
            </p>
            <label className="block text-sm font-medium">
              Что не так
              <textarea
                required
                minLength={3}
                maxLength={4000}
                rows={4}
                value={problem}
                onChange={(event) => setProblem(event.target.value)}
                className="mt-1 w-full resize-y rounded-xl border border-[var(--border)] bg-[var(--surface-raised)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
              />
            </label>
            <label className="block text-sm font-medium">
              Как должно быть
              <textarea
                required
                minLength={3}
                maxLength={4000}
                rows={4}
                value={expected}
                onChange={(event) => setExpected(event.target.value)}
                className="mt-1 w-full resize-y rounded-xl border border-[var(--border)] bg-[var(--surface-raised)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
              />
            </label>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button type="submit" disabled={sending} className="w-full">
              {sending ? 'Отправляем…' : 'Отправить отчёт'}
            </Button>
          </form>
        )}
      </Modal>
    </>
  )
}
