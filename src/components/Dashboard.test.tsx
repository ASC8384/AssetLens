import { render, screen } from '@testing-library/react';
import { recalculateSnapshot } from '../lib/calculations';
import type { AssetSnapshot } from '../lib/types';
import { describe, expect, it } from 'vitest';
import { Dashboard } from './Dashboard';
import { createSampleData } from '../lib/sampleData';

function snapshot(id: string, date: string, amount: number): AssetSnapshot {
  return recalculateSnapshot({
    id,
    date,
    exchangeRates: { CNY: 1 },
    computedTotalCny: 0,
    entries: [{
      accountId: 'fund',
      accountName: '基金账户A',
      category: '基金',
      originalAmount: amount,
      currency: 'CNY',
      exchangeRate: 1,
      amountCny: null,
      excelRatio: null,
      computedRatio: null,
      ratioDiff: null,
      includedInTotal: true,
    }],
  });
}

describe('Dashboard', () => {
  it('does not show import quality concerns in the dashboard', () => {
    render(<Dashboard data={createSampleData()} />);

    expect(screen.queryByText(/导入质量/)).toBeNull();
    expect(screen.queryByText(/Excel 原合计/)).toBeNull();
    expect(screen.queryByText(/数据质量/)).toBeNull();
    expect(screen.queryByText(/合计列可能识别错/)).toBeNull();
  });

  it('labels duplicate-date snapshots so users can distinguish kept imports', () => {
    const data = {
      ...createSampleData(),
      snapshots: [
        snapshot('jan', '2026-01-01', 100),
        snapshot('first-same-date', '2026-02-01', 120),
        snapshot('second-same-date', '2026-02-01', 220),
      ],
    };

    render(<Dashboard data={data} />);

    expect(screen.getByRole('option', { name: '2026-02-01 · 同日第 1 条' })).toBeTruthy();
    expect(screen.getByRole('option', { name: '2026-02-01 · 同日第 2 条' })).toBeTruthy();
  });
});
