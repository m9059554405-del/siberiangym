import { BadRequestException } from '@nestjs/common';

// Фискальный QR/штрихкод российской онлайн-кассы — стандартный формат ФНС:
// t=<дата-время>&s=<сумма>&fn=<номер ФН>&i=<номер документа>&fp=<фискальный признак>&n=<тип операции>
// Иногда QR закодирован как полноценный URL с этой строкой в query
// (например ссылка на проверку чека) — принимаем оба варианта.
export interface ParsedReceipt {
  raw: string;
  date: Date;
  amountRub: number; // сумма чека в рублях (с копейками, как строка "1500.00" в исходнике)
  fn: string;
  i: string;
  fp: string;
  operationType: string | null;
}

function extractQuery(raw: string): string {
  const trimmed = raw.trim();
  const qIndex = trimmed.indexOf('?');
  if (qIndex >= 0) return trimmed.slice(qIndex + 1);
  return trimmed;
}

// t=20260914T1530&s=1500.00 — либо "YYYYMMDDTHHmm", либо с секундами "YYYYMMDDTHHmmss".
function parseFiscalDate(raw: string): Date {
  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?$/.exec(raw);
  if (!m) throw new BadRequestException('Не удалось разобрать дату чека в QR-коде');
  const [, y, mo, d, h, mi, s] = m;
  return new Date(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), s ? Number(s) : 0);
}

export function parseFiscalReceiptQr(rawInput: string): ParsedReceipt {
  const raw = rawInput.trim();
  if (!raw) throw new BadRequestException('Пустой результат сканирования');

  const params = new URLSearchParams(extractQuery(raw));
  const t = params.get('t');
  const s = params.get('s');
  const fn = params.get('fn');
  const i = params.get('i');
  const fp = params.get('fp');
  const n = params.get('n');

  if (!t || !s || !fn || !i || !fp) {
    throw new BadRequestException(
      'Это не похоже на QR-код кассового чека — отсутствуют обязательные поля (t/s/fn/i/fp). Проверьте, что отсканирован именно кассовый чек.',
    );
  }

  const amountRub = Number(s);
  if (!Number.isFinite(amountRub) || amountRub < 0) {
    throw new BadRequestException(`Некорректная сумма в чеке: "${s}"`);
  }

  return {
    raw,
    date: parseFiscalDate(t),
    amountRub,
    fn,
    i,
    fp,
    operationType: n,
  };
}

// Сравнение "до копейки" — переводим оба значения в целые копейки перед
// сравнением, чтобы не напороться на погрешность чисел с плавающей точкой
// (0.1 + 0.2 !== 0.3) при сравнении сумм напрямую.
export function amountsMatchToKopeck(orderTotalRub: number, receiptAmountRub: number): boolean {
  return Math.round(orderTotalRub * 100) === Math.round(receiptAmountRub * 100);
}
