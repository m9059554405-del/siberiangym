import { BadRequestException } from '@nestjs/common';
import { amountsMatchToKopeck, parseFiscalReceiptQr } from './receipt-qr.util';

// P3.1: разбор фискального QR чека (54-ФЗ) и сверка сумм «до копейки» —
// денежная логика P0.2, ошибки здесь пропускают неоплаченные заказы или
// блокируют оплаченные.

describe('parseFiscalReceiptQr', () => {
  it('разбирает стандартную строку ФНС с секундами', () => {
    const r = parseFiscalReceiptQr('t=20260914T153045&s=1500.00&fn=9289000100012345&i=12345&fp=3539876543&n=1');
    expect(r.fn).toBe('9289000100012345');
    expect(r.i).toBe('12345');
    expect(r.fp).toBe('3539876543');
    expect(r.operationType).toBe('1');
    expect(r.amountRub).toBe(1500);
    expect(r.date.getFullYear()).toBe(2026);
    expect(r.date.getMonth()).toBe(8); // сентябрь = 8
    expect(r.date.getDate()).toBe(14);
    expect(r.date.getHours()).toBe(15);
    expect(r.date.getMinutes()).toBe(30);
    expect(r.date.getSeconds()).toBe(45);
  });

  it('разбирает дату без секунд', () => {
    const r = parseFiscalReceiptQr('t=20260101T0900&s=1.50&fn=f&i=1&fp=2');
    expect(r.date.getSeconds()).toBe(0);
    expect(r.amountRub).toBe(1.5);
  });

  it('принимает QR в виде URL со строкой параметров в query', () => {
    const r = parseFiscalReceiptQr('https://check.fns.ru?t=20260914T1530&s=100.00&fn=f&i=1&fp=2&n=1');
    expect(r.amountRub).toBe(100);
    expect(r.fn).toBe('f');
  });

  it('сумма с копейками не теряет точность', () => {
    const r = parseFiscalReceiptQr('t=20260914T1530&s=1234.56&fn=f&i=1&fp=2');
    expect(r.amountRub).toBeCloseTo(1234.56, 2);
  });

  it('отклоняет пустой ввод', () => {
    expect(() => parseFiscalReceiptQr('   ')).toThrow(BadRequestException);
  });

  it('отклоняет строку без обязательных полей (не чек)', () => {
    expect(() => parseFiscalReceiptQr('https://siberiangym.ru/some/other/qr')).toThrow(/не похоже на QR-код/);
  });

  it('отклоняет нечисловую сумму', () => {
    expect(() => parseFiscalReceiptQr('t=20260914T1530&s=abc&fn=f&i=1&fp=2')).toThrow(/Некорректная сумма/);
  });

  it('отклоняет отрицательную сумму', () => {
    expect(() => parseFiscalReceiptQr('t=20260914T1530&s=-5&fn=f&i=1&fp=2')).toThrow(/Некорректная сумма/);
  });

  it('отклоняет битую дату чека', () => {
    expect(() => parseFiscalReceiptQr('t=14.09.2026 15:30&s=5&fn=f&i=1&fp=2')).toThrow(/дату чека/);
  });
});

describe('amountsMatchToKopeck', () => {
  it('совпадающие суммы проходят', () => {
    expect(amountsMatchToKopeck(1500, 1500)).toBe(true);
  });

  it('погрешность float не мешает сравнению 0.1+0.2 против 0.3', () => {
    expect(amountsMatchToKopeck(0.1 + 0.2, 0.3)).toBe(true);
  });

  it('расхождение в одну копейку ловится', () => {
    expect(amountsMatchToKopeck(1500, 1500.01)).toBe(false);
  });

  it('расхождение в рубль ловится', () => {
    expect(amountsMatchToKopeck(1499, 1500)).toBe(false);
  });
});
