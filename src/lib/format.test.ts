import { describe, expect, it } from 'vitest';
import { formatCompactNumber } from './format';

describe('formatCompactNumber', () => {
  it('keeps chart axis labels short without rounding 万 values to whole numbers', () => {
    expect(formatCompactNumber(145000)).toBe('14.5万');
    expect(formatCompactNumber(-45000)).toBe('-4.5万');
    expect(formatCompactNumber(123456789)).toBe('1.2亿');
    expect(formatCompactNumber(3000)).toBe('3000');
    expect(formatCompactNumber(null)).toBe('—');
  });
});
