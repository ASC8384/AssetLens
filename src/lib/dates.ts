const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export function todayString(today = new Date()): string {
  return formatLocalDate(today);
}

export function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function isIsoDate(value: string): boolean {
  const match = ISO_DATE_PATTERN.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(year, month - 1, day);
  return parsed.getFullYear() === year && parsed.getMonth() === month - 1 && parsed.getDate() === day;
}

export function parseLocalDate(value: string): Date | null {
  if (!isIsoDate(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function shiftMonth(date: string, offset: number): string {
  const parsed = parseLocalDate(date);
  if (!parsed) return '';
  const day = parsed.getDate();
  const shifted = new Date(parsed.getFullYear(), parsed.getMonth() + offset, 1);
  const lastDay = new Date(shifted.getFullYear(), shifted.getMonth() + 1, 0).getDate();
  shifted.setDate(Math.min(day, lastDay));
  return formatLocalDate(shifted);
}

export function monthStart(date: string): string {
  const parsed = parseLocalDate(date);
  if (!parsed) return '';
  parsed.setDate(1);
  return formatLocalDate(parsed);
}

export function monthEnd(date: string): string {
  const parsed = parseLocalDate(date);
  if (!parsed) return '';
  return formatLocalDate(new Date(parsed.getFullYear(), parsed.getMonth() + 1, 0));
}

export function calendarMonthRange(date: string): { startDate: string; endDate: string } {
  return { startDate: monthStart(date), endDate: monthEnd(date) };
}

export function snapshotDateLabel<T extends { id: string; date: string }>(snapshots: T[], snapshot: T): string {
  const sameDate = snapshots.filter((item) => item.date === snapshot.date);
  if (sameDate.length <= 1) return snapshot.date;
  const index = sameDate.findIndex((item) => item.id === snapshot.id) + 1;
  return `${snapshot.date} · 同日第 ${index} 条`;
}
