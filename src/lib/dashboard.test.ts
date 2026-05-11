import { describe, expect, it } from 'vitest';
import { categoryTrendData } from './dashboard';
import { recalculateSnapshot } from './calculations';
import type { AppData, AssetSnapshot } from './types';

function snapshot(date: string, fund: number, cash: number): AssetSnapshot {
  return recalculateSnapshot({
    id: date,
    date,
    exchangeRates: { CNY: 1 },
    computedTotalCny: 0,
    entries: [
      {
        accountId: 'fund',
        accountName: '基金账户',
        category: '基金',
        originalAmount: fund,
        currency: 'CNY',
        exchangeRate: 1,
        amountCny: null,
        excelRatio: null,
        computedRatio: null,
        ratioDiff: null,
        includedInTotal: true,
      },
      {
        accountId: 'cash',
        accountName: '现金账户',
        category: '现金',
        originalAmount: cash,
        currency: 'CNY',
        exchangeRate: 1,
        amountCny: null,
        excelRatio: null,
        computedRatio: null,
        ratioDiff: null,
        includedInTotal: true,
      },
    ],
  });
}

describe('categoryTrendData', () => {
  it('returns total and per-category trend rows for dashboard charts', () => {
    const data: AppData = {
      version: 1,
      snapshots: [snapshot('2026-01-01', 100, 40), snapshot('2026-02-01', 120, 60)],
      accounts: [],
      defaultExchangeRates: { CNY: 1 },
      preferences: { activeTab: 'dashboard', detailMode: 'compact', categoryFilter: '全部' },
    };

    expect(categoryTrendData(data)).toEqual([
      expect.objectContaining({ date: '2026-01-01', total: 140, 基金: 100, 现金: 40 }),
      expect.objectContaining({ date: '2026-02-01', total: 180, 基金: 120, 现金: 60 }),
    ]);
  });
});
