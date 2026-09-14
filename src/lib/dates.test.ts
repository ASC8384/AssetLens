import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { calendarMonthRange, formatLocalDate, isIsoDate, shiftMonth, snapshotDateLabel, todayString } from './dates';

describe('date helpers', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('formats the local calendar day instead of the UTC ISO date', () => {
    vi.setSystemTime(new Date(2026, 4, 1, 22, 30, 0));
    expect(todayString()).toBe('2026-05-01');
    expect(formatLocalDate(new Date())).toBe('2026-05-01');
  });

  it('accepts real ISO calendar dates and rejects impossible days', () => {
    expect(isIsoDate('2026-02-28')).toBe(true);
    expect(isIsoDate('2024-02-29')).toBe(true);
    expect(isIsoDate('2026-02-29')).toBe(false);
    expect(isIsoDate('2026-02-31')).toBe(false);
    expect(isIsoDate('2026-13-40')).toBe(false);
    expect(isIsoDate('2026-5-1')).toBe(false);
    expect(isIsoDate('未命名日期 1')).toBe(false);
  });

  it('shifts months in local time and clamps overflowing month-end dates', () => {
    expect(shiftMonth('2026-05-01', -1)).toBe('2026-04-01');
    expect(shiftMonth('2026-05-01', -3)).toBe('2026-02-01');
    expect(shiftMonth('2026-05-01', -12)).toBe('2025-05-01');
    expect(shiftMonth('2026-03-31', -1)).toBe('2026-02-28');
    expect(shiftMonth('2024-03-31', -1)).toBe('2024-02-29');
    expect(shiftMonth('2026-01-31', 1)).toBe('2026-02-28');
    expect(shiftMonth('未命名日期 1', -1)).toBe('');
  });

  it('builds an inclusive calendar-month range', () => {
    expect(calendarMonthRange('2026-05-01')).toEqual({ startDate: '2026-05-01', endDate: '2026-05-31' });
    expect(calendarMonthRange('2026-02-15')).toEqual({ startDate: '2026-02-01', endDate: '2026-02-28' });
    expect(calendarMonthRange('2024-02-15')).toEqual({ startDate: '2024-02-01', endDate: '2024-02-29' });
  });

  it('labels kept same-day snapshots', () => {
    const snapshots = [
      { id: 'a', date: '2026-02-01' },
      { id: 'b', date: '2026-02-01' },
      { id: 'c', date: '2026-03-01' },
    ];
    expect(snapshotDateLabel(snapshots, snapshots[0])).toBe('2026-02-01 · 同日第 1 条');
    expect(snapshotDateLabel(snapshots, snapshots[1])).toBe('2026-02-01 · 同日第 2 条');
    expect(snapshotDateLabel(snapshots, snapshots[2])).toBe('2026-03-01');
  });
});
