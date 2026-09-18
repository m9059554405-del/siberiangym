// P3.1: чистое ядро списания по FEFO (first expired, first out) — вынесено
// из StockService.decrementBatches, чтобы логику распределения количества
// по партиям можно было покрыть юнит-тестами без БД. Списываем со старейших
// по сроку годности партий: сортировку по expiresAt обязан выполнить
// вызывающий код (в сервисе это делает orderBy запроса), здесь только
// распределение. Излишек сверх фактического остатка просто игнорируется —
// как и раньше в decrementBatches.
export interface FifoBatch {
  id: string;
  quantity: number;
}

export function planFifoWriteoff<T extends FifoBatch>(batches: T[], qty: number): { id: string; quantity: number }[] {
  let remaining = qty;
  const updates: { id: string; quantity: number }[] = [];
  for (const b of batches) {
    if (remaining <= 0) break;
    if (b.quantity <= 0) continue;
    const take = Math.min(b.quantity, remaining);
    updates.push({ id: b.id, quantity: b.quantity - take });
    remaining -= take;
  }
  return updates;
}
