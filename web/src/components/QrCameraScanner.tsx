import { useEffect, useRef, useState } from 'react'
import { BrowserQRCodeReader } from '@zxing/browser'
import type { IScannerControls } from '@zxing/browser'

// Камера телефона/планшета как альтернатива выделенному USB/BT-сканеру
// штрихкодов (P0.2) — для администраторов без отдельного сканера на
// ресепшене. Декодирует ровно один QR и сразу отдаёт результат наверх —
// повторное сканирование того же кадра не нужно, подтверждение заказа
// происходит одним успешным считыванием.
export function QrCameraScanner({ onDecode, onError }: { onDecode: (text: string) => void; onError?: (message: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const controlsRef = useRef<IScannerControls | null>(null)
  const [status, setStatus] = useState<'starting' | 'active' | 'error'>('starting')

  useEffect(() => {
    let cancelled = false
    const reader = new BrowserQRCodeReader()

    reader
      .decodeFromVideoDevice(undefined, videoRef.current ?? undefined, (result, _err, controls) => {
        controlsRef.current = controls
        if (cancelled) return
        if (result) {
          controls.stop()
          onDecode(result.getText())
        }
        // NotFoundException прилетает на каждый кадр без QR в кадре — это
        // не ошибка сканирования, а норма, пока камера ищет код.
      })
      .then(() => {
        if (!cancelled) setStatus('active')
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setStatus('error')
        onError?.(err instanceof Error ? err.message : 'Не удалось получить доступ к камере')
      })

    return () => {
      cancelled = true
      controlsRef.current?.stop()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="overflow-hidden rounded-xl bg-black">
      <video ref={videoRef} className="aspect-video w-full object-cover" muted playsInline />
      {status === 'starting' && <p className="p-2 text-center text-xs text-white/70">Запрашиваем доступ к камере…</p>}
    </div>
  )
}
