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

  it('renders account insight summary for the selected snapshot', () => {
    render(<Dashboard data={createSampleData()} />);

    expect(screen.getByText('本月资产复盘入口')).toBeTruthy();
    expect(screen.getByText('生成本月复盘')).toBeTruthy();
    expect(screen.getByText('快照时间轴')).toBeTruthy();
    expect(screen.getByText('账户洞察')).toBeTruthy();
    expect(screen.getByText('增长账户 Top 5')).toBeTruthy();
    expect(screen.getByText('下降账户 Top 5')).toBeTruthy();
    expect(screen.getByText('账户集中度')).toBeTruthy();
    expect(screen.getByText('净资产')).toBeTruthy();
    expect(screen.getAllByText('负债').length).toBeGreaterThan(0);
    expect(screen.getAllByText('本期外界收入').length).toBeGreaterThan(0);
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

  it('reuses the last recorded external income and marks its date', () => {
    const data = {
      ...createSampleData(),
      snapshots: [
        { ...snapshot('jan', '2026-01-01', 100), externalIncome: 8000 },
        snapshot('feb', '2026-02-01', 120),
      ],
    };

    render(<Dashboard data={data} />);

    expect(screen.getAllByText(/沿用 2026-01-01/).length).toBeGreaterThan(0);
    expect(screen.getAllByText('¥8,000.00').length).toBeGreaterThan(0);
  });
});
