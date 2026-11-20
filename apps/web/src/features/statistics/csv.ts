/**
 * Exportación CSV del lado del cliente. Dos protecciones:
 *  - Inyección de fórmulas (OWASP "CSV injection"): una celda de texto que empiece por = + - @ (o tab/CR) se antepone con ' para que Excel/Sheets no la evalúe.
 *    Los números reales no se tocan (un negativo legítimo no es texto).
 *  - Comillas, comas y saltos de línea se escapan según RFC 4180.
 */
export type CsvCell = string | number | null | undefined;

const FORMULA_START = /^[=+\-@\t\r]/;

export function csvCell(value: CsvCell): string {
  if (value === null || value === undefined) return '';
  let text = typeof value === 'number' ? String(value) : value;
  if (typeof value === 'string' && FORMULA_START.test(text)) text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** CSV con BOM UTF-8 (Excel respeta así las tildes) y CRLF. */
export function toCsv(header: string[], rows: CsvCell[][]): string {
  return `﻿${[header, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n')}\r\n`;
}

export function downloadCsv(filename: string, content: string): void {
  const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
