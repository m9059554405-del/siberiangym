import { planFifoWriteoff } from './fifo.util';

// P3.1: FEFO-распределение списания по партиям (склад) — партия с более
// ранним expiresAt расходуется первой; вход уже отсортирован по expiresAt
// (это делает orderBy в сервисе).

function batches(qtys: number[]) {
  return qtys.map((quantity, i) => ({ id: `b${i}`, quantity, expiresAt: new Date(2026, 0, 1 + i) }));
}

describe('planFifoWriteoff', () => {
  it('списывает целиком из первой (самой ранней) партии', () => {
    expect(planFifoWriteoff(batches([10, 10, 10]), 7)).toEqual([{ id: 'b0', quantity: 3 }]);
  });

  it('переходит во вторую партию, когда первая исчерпана', () => {
    expect(planFifoWriteoff(batches([5, 10, 10]), 8)).toEqual([
      { id: 'b0', quantity: 0 },
      { id: 'b1', quantity: 7 },
    ]);
  });

  it('списание ровно на все партии обнуляет каждую', () => {
    expect(planFifoWriteoff(batches([5, 3, 2]), 10)).toEqual([
      { id: 'b0', quantity: 0 },
      { id: 'b1', quantity: 0 },
      { id: 'b2', quantity: 0 },
    ]);
  });

  it('излишек сверх остатка игнорируется (количества не уходят в минус)', () => {
    expect(planFifoWriteoff(batches([5, 3]), 100)).toEqual([
      { id: 'b0', quantity: 0 },
      { id: 'b1', quantity: 0 },
    ]);
  });

  it('нулевое количество — нет обновлений', () => {
    expect(planFifoWriteoff(batches([5, 3]), 0)).toEqual([]);
  });

  it('пустой список партий — нет обновлений', () => {
    expect(planFifoWriteoff([], 5)).toEqual([]);
  });

  it('частично пустые партии (quantity 0) пропускаются', () => {
    expect(planFifoWriteoff(batches([0, 4, 6]), 3)).toEqual([{ id: 'b1', quantity: 1 }]);
  });
});
