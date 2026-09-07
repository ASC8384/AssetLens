import { describe, expect, it } from 'vitest';
import { daysSinceDate, externalIncomeDateLabel } from './income';

const today = new Date('2026-09-07T12:00:00');

describe('external income date labels', () => {
  it('adds days-since-today next to the absolute source date', () => {
    expect(externalIncomeDateLabel({ amount: 8000, sourceDate: '2026-01-01', inherited: true }, today)).toBe('沿用 2026-01-01 · 距今 249 天');
    expect(externalIncomeDateLabel({ amount: 12000, sourceDate: '2026-05-01', inherited: false }, today)).toBe('记录于 2026-05-01 · 距今 129 天');
  });

  it('labels a same-day record as today', () => {
    expect(externalIncomeDateLabel({ amount: 8000, sourceDate: '2026-09-07', inherited: false }, today)).toBe('记录于 2026-09-07 · 今天');
  });

  it('skips the relative part when the date cannot be parsed', () => {
    expect(daysSinceDate('未命名日期 1', today)).toBeNull();
    expect(externalIncomeDateLabel({ amount: 1, sourceDate: '未命名日期 1', inherited: true }, today)).toBe('沿用 未命名日期 1');
  });
});
