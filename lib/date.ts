const dayLabelFormatter = new Intl.DateTimeFormat('zh-CN', {
  month: 'short',
  day: 'numeric',
  weekday: 'short',
});

const shortDayFormatter = new Intl.DateTimeFormat('zh-CN', {
  month: 'numeric',
  day: 'numeric',
});

export const RECENT_DAY_COUNT = 6;

function pad(value: number): string {
  return value.toString().padStart(2, '0');
}

export function toDateKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function fromDateKey(dateKey: string): Date {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function todayDateKey(): string {
  return toDateKey(new Date());
}

export function offsetDateKey(dateKey: string, offset: number): string {
  const next = fromDateKey(dateKey);
  next.setDate(next.getDate() + offset);
  return toDateKey(next);
}

export function compareDateKey(a: string, b: string): number {
  return a.localeCompare(b);
}

export function formatDisplayDate(dateKey: string): string {
  return `${dateKey} · ${dayLabelFormatter.format(fromDateKey(dateKey))}`;
}

export function formatDateChip(dateKey: string, todayKey: string): string {
  if (dateKey === todayKey) {
    return '今日';
  }

  return shortDayFormatter.format(fromDateKey(dateKey));
}

export function recentDateKeys(todayKey: string): string[] {
  return Array.from({ length: RECENT_DAY_COUNT }, (_, index) => offsetDateKey(todayKey, -index));
}
