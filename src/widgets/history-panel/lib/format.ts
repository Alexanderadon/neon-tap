/** `05.09, 14:07` — short local date for attempt rows. Empty for garbage. */
export function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export const pct = (v: number): string => `${(v * 100).toFixed(1)}%`;

export const formatScore = (v: number): string => v.toLocaleString('ru-RU');
