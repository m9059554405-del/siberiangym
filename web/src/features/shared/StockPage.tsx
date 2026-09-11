import { useMemo, useState } from 'react'
import { AlertTriangle, ClipboardList, PackageMinus, PackagePlus, Plus } from 'lucide-react'
import {
  useCreateCatalogItem,
  useFinalizeInventory,
  useReceiveStock,
  useStockCatalog,
  useStockHistory,
  useStockSummary,
  useWriteOffStock,
} from '../../hooks/useOpsApi'
import { Badge, Button, Card, EmptyState, SectionTitle, StatTile } from '../../components/ui/Primitives'
import { Modal } from '../../components/ui/Modal'
import type { CatalogCategory, StockLocation, WriteoffReason } from '../../types'

const LOCATION_LABEL: Record<string, string> = { SHELF: 'Витрина', WAREHOUSE: 'Склад' }
const WRITEOFF_REASON_LABEL: Record<WriteoffReason, string> = {
  EXPIRED: 'Истёк срок годности',
  DAMAGED: 'Повреждено',
  SOLD_MANUAL: 'Продано без чека',
  USED_INTERNALLY: 'Использовано клубом',
  LOST: 'Утеряно/недостача',
  OTHER: 'Другое',
}

function todayIso(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function addDaysIso(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  dt.setDate(dt.getDate() + days)
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
}

export function StockPage() {
  const { data: summary } = useStockSummary()
  const { data: catalog } = useStockCatalog()
  const { data: history } = useStockHistory()
  const createCatalogItem = useCreateCatalogItem()
  const receiveStock = useReceiveStock()
  const writeOffStock = useWriteOffStock()
  const finalizeInventory = useFinalizeInventory()

  const [expanded, setExpanded] = useState<string | null>(null)
  const todayStr = todayIso()

  const items = summary ?? []
  const totalShelf = items.reduce((s, i) => s + i.shelfQty, 0)
  const totalWarehouse = items.reduce((s, i) => s + i.warehouseQty, 0)
  const expiringSoon = items.flatMap((i) => i.batches.filter((b) => b.expiringSoon).map((b) => ({ ...b, itemName: i.name, emoji: i.emoji })))

  const [catalogOpen, setCatalogOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [newCategory, setNewCategory] = useState<CatalogCategory>('FOOD')
  const [newPrice, setNewPrice] = useState(150)
  const [newEmoji, setNewEmoji] = useState('🍫')

  function submitCatalog() {
    if (!newName.trim()) return
    createCatalogItem.mutate(
      { name: newName.trim(), category: newCategory, price: newPrice, emoji: newEmoji.trim() || '📦' },
      { onSuccess: () => { setNewName(''); setNewPrice(150); setNewEmoji('🍫'); setCatalogOpen(false) } },
    )
  }

  const [receiveOpen, setReceiveOpen] = useState(false)
  const [rItem, setRItem] = useState('')
  const [rLocation, setRLocation] = useState<StockLocation>('WAREHOUSE')
  const [rQty, setRQty] = useState(10)
  const [rExpires, setRExpires] = useState(addDaysIso(todayStr, 180))

  function openReceive() {
    setRItem(catalog?.[0]?.id ?? '')
    setRLocation('WAREHOUSE')
    setRQty(10)
    setRExpires(addDaysIso(todayStr, 180))
    setReceiveOpen(true)
  }
  function submitReceive() {
    if (!rItem || rQty <= 0) return
    receiveStock.mutate({ catalogItemId: rItem, location: rLocation, quantity: rQty, expiresAt: rExpires }, { onSuccess: () => setReceiveOpen(false) })
  }

  const [writeoffOpen, setWriteoffOpen] = useState(false)
  const [wItem, setWItem] = useState('')
  const [wLocation, setWLocation] = useState<StockLocation>('SHELF')
  const [wQty, setWQty] = useState(1)
  const [wReason, setWReason] = useState<WriteoffReason>('EXPIRED')
  const [wComment, setWComment] = useState('')

  function openWriteoff() {
    setWItem(catalog?.[0]?.id ?? '')
    setWLocation('SHELF')
    setWQty(1)
    setWReason('EXPIRED')
    setWComment('')
    setWriteoffOpen(true)
  }
  function submitWriteoff() {
    if (!wItem || wQty <= 0) return
    writeOffStock.mutate(
      { catalogItemId: wItem, location: wLocation, quantity: wQty, reason: wReason, comment: wComment.trim() || undefined },
      { onSuccess: () => setWriteoffOpen(false) },
    )
  }

  const [inventoryOpen, setInventoryOpen] = useState(false)
  const [counts, setCounts] = useState<Record<string, number>>({})

  function openInventory() {
    const initial: Record<string, number> = {}
    for (const item of items) {
      initial[`${item.catalogItemId}__SHELF`] = item.shelfQty
      initial[`${item.catalogItemId}__WAREHOUSE`] = item.warehouseQty
    }
    setCounts(initial)
    setInventoryOpen(true)
  }
  function submitInventory() {
    const entries = (catalog ?? []).flatMap((item) =>
      (['SHELF', 'WAREHOUSE'] as StockLocation[]).map((location) => ({
        catalogItemId: item.id,
        location,
        countedQty: counts[`${item.id}__${location}`] ?? 0,
      })),
    )
    finalizeInventory.mutate(entries, { onSuccess: () => setInventoryOpen(false) })
  }

  const historyRows = useMemo(() => {
    if (!history) return []
    const writeoffs = history.writeoffs.map((w) => ({
      kind: 'writeoff' as const, date: w.date, id: w.id, itemName: w.catalogItem.name,
      text: `Списано ${w.quantity} шт. (${LOCATION_LABEL[w.location]}) — ${WRITEOFF_REASON_LABEL[w.reason]}${w.comment ? `: ${w.comment}` : ''}`,
    }))
    const receipts = history.receipts.map((r) => ({
      kind: 'receipt' as const, date: r.date, id: r.id, itemName: r.catalogItem.name,
      text: `Оприходовано +${r.quantity} шт. (${LOCATION_LABEL[r.location]})`,
    }))
    const inventories = history.inventoryCounts.map((inv) => ({
      kind: 'inventory' as const, date: inv.date, id: inv.id, itemName: 'Инвентаризация',
      text: `${inv.entries.length} позиций проверено, расхождений: ${inv.entries.filter((e) => e.countedQty !== e.systemQty).length}`,
    }))
    return [...writeoffs, ...receipts, ...inventories].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 12)
  }, [history])

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold">Склад</h1>
          <p className="text-sm text-[var(--text-muted)]">Остатки товаров: витрина, склад и сроки годности</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" onClick={() => setCatalogOpen(true)}><Plus size={13} /> Товар в справочник</Button>
          <Button size="sm" variant="secondary" onClick={openReceive}><PackagePlus size={13} /> Приход</Button>
          <Button size="sm" variant="secondary" onClick={openWriteoff}><PackageMinus size={13} /> Списание</Button>
          <Button size="sm" onClick={openInventory}><ClipboardList size={13} /> Инвентаризация</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Позиций в каталоге" value={items.length} />
        <StatTile label="На витрине" value={totalShelf} />
        <StatTile label="На складе" value={totalWarehouse} />
        <StatTile label="Партий скоро истекают" value={expiringSoon.length} hint="≤ 14 дней" />
      </div>

      {expiringSoon.length > 0 && (
        <Card className="border-amber-200 bg-amber-50">
          <SectionTitle title="Скоро истекает срок годности" action={<AlertTriangle size={18} className="text-amber-600" />} />
          <div className="flex flex-col gap-2">
            {expiringSoon.sort((a, b) => a.daysLeft - b.daysLeft).map((b) => (
              <div key={b.id} className="flex items-center justify-between rounded-lg bg-white/70 px-3 py-2 text-sm">
                <span className="flex items-center gap-2">
                  <span>{b.emoji}</span>
                  {b.itemName} · {LOCATION_LABEL[b.location]} · {b.quantity} шт.
                </span>
                <Badge tone={b.daysLeft <= 5 ? 'danger' : 'warning'}>{b.daysLeft <= 0 ? 'истёк' : `осталось ${b.daysLeft} дн.`}</Badge>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card>
        <SectionTitle title="Остатки по товарам" subtitle="Нажмите на позицию, чтобы увидеть партии" />
        <div className="flex flex-col gap-2">
          {items.map((item) => (
            <div key={item.catalogItemId} className="rounded-xl border border-[var(--border)]">
              <button onClick={() => setExpanded(expanded === item.catalogItemId ? null : item.catalogItemId)} className="tap-scale flex w-full items-center justify-between px-3 py-2.5 text-left">
                <span className="flex items-center gap-2 text-sm font-medium">
                  <span className="text-lg">{item.emoji}</span>
                  {item.name}
                </span>
                <span className="flex items-center gap-3 text-xs text-[var(--text-muted)]">
                  <span>Витрина: {item.shelfQty}</span>
                  <span>Склад: {item.warehouseQty}</span>
                </span>
              </button>
              {expanded === item.catalogItemId && (
                <div className="border-t border-[var(--border)] px-3 py-2">
                  {item.batches.length === 0 ? (
                    <p className="py-2 text-xs text-[var(--text-faint)]">Партий пока нет</p>
                  ) : (
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-left text-[var(--text-faint)]">
                          <th className="pb-1.5">Расположение</th>
                          <th className="pb-1.5">Кол-во</th>
                          <th className="pb-1.5">Поступление</th>
                          <th className="pb-1.5">Срок годности</th>
                        </tr>
                      </thead>
                      <tbody>
                        {item.batches.map((b) => (
                          <tr key={b.id} className="border-t border-[var(--border)]">
                            <td className="py-1.5">{LOCATION_LABEL[b.location]}</td>
                            <td>{b.quantity} шт.</td>
                            <td>{b.receivedAt.slice(0, 10)}</td>
                            <td><span className={b.expiringSoon ? 'font-medium text-amber-600' : ''}>{b.expiresAt.slice(0, 10)}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <SectionTitle title="История склада" subtitle="Списания, приходы и инвентаризации" />
        <div className="flex flex-col gap-2">
          {historyRows.map((h) => (
            <div key={`${h.kind}-${h.id}`} className="flex flex-col gap-0.5 rounded-lg bg-[var(--surface-sunken)] px-3 py-2 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium">{h.itemName}</span>
                <span className="text-xs text-[var(--text-faint)]">{h.date.slice(0, 16).replace('T', ', ')}</span>
              </div>
              <span className="text-xs text-[var(--text-muted)]">{h.text}</span>
            </div>
          ))}
          {historyRows.length === 0 && <EmptyState title="Операций пока не было" subtitle="Приход, списание и инвентаризация появятся здесь" />}
        </div>
      </Card>

      <Modal open={catalogOpen} onClose={() => setCatalogOpen(false)} title="Новый товар в справочник">
        <div className="flex flex-col gap-3">
          <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Название товара"
            className="rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]" />
          <div className="grid grid-cols-3 gap-2">
            <select value={newCategory} onChange={(e) => setNewCategory(e.target.value as CatalogCategory)}
              className="rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] px-2.5 py-2 text-sm">
              <option value="FOOD">Еда</option>
              <option value="WATER">Вода</option>
            </select>
            <input type="number" min={0} value={newPrice} onChange={(e) => setNewPrice(Number(e.target.value))}
              className="rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] px-2.5 py-2 text-sm" placeholder="Цена ₽" />
            <input value={newEmoji} onChange={(e) => setNewEmoji(e.target.value)} placeholder="Эмодзи"
              className="rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] px-2.5 py-2 text-sm text-center" />
          </div>
          <Button onClick={submitCatalog} disabled={!newName.trim() || createCatalogItem.isPending}><Plus size={14} /> Добавить в справочник</Button>
        </div>
      </Modal>

      <Modal open={receiveOpen} onClose={() => setReceiveOpen(false)} title="Приход товара">
        <div className="flex flex-col gap-3">
          <select value={rItem} onChange={(e) => setRItem(e.target.value)} className="rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] px-2.5 py-2 text-sm">
            {(catalog ?? []).map((c) => <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>)}
          </select>
          <div className="grid grid-cols-2 gap-2">
            <select value={rLocation} onChange={(e) => setRLocation(e.target.value as StockLocation)} className="rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] px-2.5 py-2 text-sm">
              <option value="WAREHOUSE">Склад</option>
              <option value="SHELF">Витрина</option>
            </select>
            <input type="number" min={1} value={rQty} onChange={(e) => setRQty(Number(e.target.value))}
              className="rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] px-2.5 py-2 text-sm" placeholder="Количество" />
          </div>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-[var(--text-muted)]">Срок годности партии</span>
            <input type="date" value={rExpires} onChange={(e) => setRExpires(e.target.value)} className="rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] px-2.5 py-2 text-sm" />
          </label>
          <Button onClick={submitReceive} disabled={!rItem || rQty <= 0 || receiveStock.isPending}><PackagePlus size={14} /> Оприходовать</Button>
        </div>
      </Modal>

      <Modal open={writeoffOpen} onClose={() => setWriteoffOpen(false)} title="Списание товара">
        <div className="flex flex-col gap-3">
          <select value={wItem} onChange={(e) => setWItem(e.target.value)} className="rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] px-2.5 py-2 text-sm">
            {(catalog ?? []).map((c) => <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>)}
          </select>
          <div className="grid grid-cols-2 gap-2">
            <select value={wLocation} onChange={(e) => setWLocation(e.target.value as StockLocation)} className="rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] px-2.5 py-2 text-sm">
              <option value="SHELF">Витрина</option>
              <option value="WAREHOUSE">Склад</option>
            </select>
            <input type="number" min={1} value={wQty} onChange={(e) => setWQty(Number(e.target.value))}
              className="rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] px-2.5 py-2 text-sm" placeholder="Количество" />
          </div>
          <select value={wReason} onChange={(e) => setWReason(e.target.value as WriteoffReason)} className="rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] px-2.5 py-2 text-sm">
            {(Object.keys(WRITEOFF_REASON_LABEL) as WriteoffReason[]).map((r) => <option key={r} value={r}>{WRITEOFF_REASON_LABEL[r]}</option>)}
          </select>
          <textarea value={wComment} onChange={(e) => setWComment(e.target.value)} placeholder="Комментарий (необязательно)…" rows={2}
            className="resize-none rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]" />
          <Button onClick={submitWriteoff} disabled={!wItem || wQty <= 0 || writeOffStock.isPending}><PackageMinus size={14} /> Списать</Button>
        </div>
      </Modal>

      <Modal open={inventoryOpen} onClose={() => setInventoryOpen(false)} title="Инвентаризация">
        <div className="flex flex-col gap-3">
          <p className="text-xs text-[var(--text-faint)]">Остатки заполнены по системным данным — поправьте на фактически посчитанное количество.</p>
          <div className="flex max-h-96 flex-col gap-3 overflow-y-auto">
            {(catalog ?? []).map((item) => (
              <div key={item.id} className="rounded-lg border border-[var(--border)] p-2.5">
                <div className="mb-1.5 text-sm font-medium">{item.emoji} {item.name}</div>
                <div className="grid grid-cols-2 gap-2">
                  {(['SHELF', 'WAREHOUSE'] as StockLocation[]).map((loc) => (
                    <label key={loc} className="flex flex-col gap-1">
                      <span className="text-xs text-[var(--text-muted)]">{LOCATION_LABEL[loc]}</span>
                      <input
                        type="number" min={0}
                        value={counts[`${item.id}__${loc}`] ?? 0}
                        onChange={(e) => setCounts((c) => ({ ...c, [`${item.id}__${loc}`]: Number(e.target.value) }))}
                        className="rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] px-2.5 py-1.5 text-sm"
                      />
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <Button onClick={submitInventory} disabled={finalizeInventory.isPending}><ClipboardList size={14} /> Завершить инвентаризацию</Button>
        </div>
      </Modal>
    </div>
  )
}
