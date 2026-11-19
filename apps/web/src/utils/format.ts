const dateFormatter = new Intl.DateTimeFormat('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
const dateTimeFormatter = new Intl.DateTimeFormat('es-CO', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

export const formatDate = (iso: string | null | undefined): string => (iso ? dateFormatter.format(new Date(iso)) : '—');
export const formatDateTime = (iso: string): string => dateTimeFormatter.format(new Date(iso));

/** Valor para <input type="date"> en hora local (YYYY-MM-DD). */
export function toDateInputValue(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Un <input type="date"> vence al final de ese día, hora local. */
export const endOfDateInput = (value: string): Date => new Date(`${value}T23:59:59`);
