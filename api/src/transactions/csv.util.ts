// P4.3: CSV для бухгалтерии — разделитель ';' и BOM, чтобы файл открывался
// в русском Excel без мастера импорта. Экранирование по RFC 4180: поле с
// ';', кавычкой или переводом строки берётся в кавычки, внутренние кавычки
// удваиваются. Числа — как есть (рубли целыми), даты — ISO.
export function csvEscape(value: string | number | null | undefined): string {
  const raw = value === null || value === undefined ? '' : String(value);
  if (/[";\n\r]/.test(raw)) return `"${raw.replace(/"/g, '""')}"`;
  return raw;
}

export function csvRow(cells: (string | number | null | undefined)[]): string {
  return cells.map(csvEscape).join(';');
}

// Сборка файла: BOM + строки с '\r\n' (ожидание Excel/1С).
export function csvDocument(header: string[], rows: (string | number | null | undefined)[][]): string {
  return `\uFEFF${[csvRow(header), ...rows.map(csvRow)].join('\r\n')}\r\n`;
}
