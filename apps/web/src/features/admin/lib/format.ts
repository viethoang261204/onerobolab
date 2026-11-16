/*
 * Display formatting for the console. Dates use day/month/year
 * (29/09/2026) with a 24-hour clock.
 */

const pad = (n: number) => String(n).padStart(2, '0');

const toDate = (value: string | Date): Date | null => {
  const d = typeof value === 'string' ? new Date(value) : value;
  return Number.isNaN(d.getTime()) ? null : d;
};

/** 29/09/2026 */
export function formatDate(value: string | Date | null | undefined): string {
  const d = value ? toDate(value) : null;
  return d ? `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}` : '—';
}

/** 29/09/2026 14:05 */
export function formatDateTime(value: string | Date | null | undefined): string {
  const d = value ? toDate(value) : null;
  return d ? `${formatDate(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}` : '—';
}

/** "just now", "5 min ago", "3 h ago", "2 days ago", then the date. */
export function relativeTime(value: string | Date | null | undefined, now: Date = new Date()): string {
  const d = value ? toDate(value) : null;
  if (!d) return 'Never';
  const s = Math.round((now.getTime() - d.getTime()) / 1000);
  if (s < 45) return 'just now';
  if (s < 3600) return `${Math.max(1, Math.round(s / 60))} min ago`;
  if (s < 86_400) return `${Math.round(s / 3600)} h ago`;
  const days = Math.round(s / 86_400);
  if (days < 14) return days === 1 ? 'yesterday' : `${days} days ago`;
  return formatDate(d);
}

/** 1,234 */
export const formatNumber = (n: number | null | undefined): string => (n === null || n === undefined ? '—' : n.toLocaleString('en-US'));

/** 42.5% (input is already a percentage). */
export const formatPercent = (n: number | null | undefined, digits = 1): string =>
  n === null || n === undefined ? '—' : `${Number(n).toFixed(digits).replace(/\.0+$/, '')}%`;

/** 12.4 s · 2 min 05 s */
export function formatDuration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined) return '—';
  if (seconds < 60) return `${Number(seconds).toFixed(1).replace(/\.0$/, '')} s`;
  const m = Math.floor(seconds / 60);
  return `${m} min ${pad(Math.round(seconds - m * 60))} s`;
}

/** Ratio as a percentage of `whole` (0 when whole is 0). */
export const percentOf = (part: number, whole: number): number => (whole > 0 ? Math.round((1000 * part) / whole) / 10 : 0);

/** "3 students" / "1 student". */
export const plural = (n: number, word: string, many = `${word}s`) => `${formatNumber(n)} ${n === 1 ? word : many}`;
