import { useEffect, useRef, useState } from 'react'
import { Camera, Keyboard } from 'lucide-react'
import { Button } from './ui/Primitives'
import { QrCameraScanner } from './QrCameraScanner'

// Общая панель подтверждения чека — используется и для оплаты (P0.2), и для
// возврата (P0.7): обычный USB/BT-сканер штрихкодов работает как клавиатура
// (фокус на поле + Enter), либо камера устройства через QrCameraScanner.
export function ReceiptScanPanel({
  onSubmit,
  isPending,
  errorMessage,
  onErrorChange,
  label = 'Подтверждение чека',
}: {
  onSubmit: (raw: string) => void
  isPending: boolean
  errorMessage: string | null
  onErrorChange: (msg: string | null) => void
  label?: string
}) {
  const [value, setValue] = useState('')
  const [useCamera, setUseCamera] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!useCamera) inputRef.current?.focus()
  }, [useCamera])

  function submit(raw: string) {
    if (!raw.trim()) return
    onSubmit(raw.trim())
    setValue('')
  }

  return (
    <div className="flex flex-col gap-3">
      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wide text-[var(--text-faint)]">{label}</span>
          <button onClick={() => setUseCamera((v) => !v)} className="flex items-center gap-1 text-xs font-medium text-[var(--accent-strong)]">
            {useCamera ? <Keyboard size={13} /> : <Camera size={13} />}
            {useCamera ? 'Ввести сканером/вручную' : 'Сканировать камерой'}
          </button>
        </div>
        {useCamera ? (
          <QrCameraScanner
            onDecode={(text) => {
              setUseCamera(false)
              submit(text)
            }}
            onError={(msg) => onErrorChange(msg)}
          />
        ) : (
          <input
            ref={inputRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submit(value)
            }}
            placeholder="Наведите фокус сюда и отсканируйте чек сканером — или введите строку вручную"
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
          />
        )}
      </div>
      {errorMessage && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{errorMessage}</div>}
      <Button onClick={() => submit(value)} disabled={!value.trim() || isPending}>
        Подтвердить чек
      </Button>
    </div>
  )
}
