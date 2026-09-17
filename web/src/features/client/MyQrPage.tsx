import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { QrCode } from 'lucide-react'
import { useMe } from '../../hooks/useClientApi'
import { Card, SectionTitle } from '../../components/ui/Primitives'

// «Мой QR» (P2.2): персональный код прохода, который администратор
// сканирует на входе. Код — id карточки клиента с префиксом формата: он
// не секретнее самого приложения (сканер всё равно проверяет абонемент
// на сервере в момент прохода), зато бессрочный и не требует сети у
// клиента в момент показа — QR генерируется прямо на устройстве.
export function MyQrPage() {
  const { data: client } = useMe()
  const [dataUrl, setDataUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!client) return
    let alive = true
    QRCode.toDataURL(`sgym-checkin:${client.id}`, {
      margin: 1,
      width: 300,
      color: { dark: '#111827', light: '#ffffff' },
    })
      .then((url) => {
        if (alive) setDataUrl(url)
      })
      .catch(() => {
        if (alive) setDataUrl(null)
      })
    return () => {
      alive = false
    }
  }, [client])

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold">
          <QrCode size={20} />
          Мой QR
        </h1>
        <p className="text-sm text-[var(--text-muted)]">Покажите этот код администратору на входе в клуб</p>
      </div>

      <Card className="flex flex-col items-center gap-3">
        <SectionTitle title="Код прохода" subtitle="Работает на любой точке сети, где действует ваш абонемент" />
        <div className="rounded-2xl bg-white p-4 shadow-sm">
          {dataUrl ? (
            <img src={dataUrl} alt="QR для входа" width={260} height={260} />
          ) : (
            <div className="flex h-[260px] w-[260px] items-center justify-center text-sm text-[var(--text-faint)]">
              {client ? 'Не удалось построить QR' : 'Загрузка…'}
            </div>
          )}
        </div>
        <p className="text-center text-xs text-[var(--text-faint)]">
          Код бессрочный. Если абонемент заморожен или посещения закончились — вход не пройдёт, купите или продлите
          абонемент на вкладке «Оплата».
        </p>
      </Card>
    </div>
  )
}
