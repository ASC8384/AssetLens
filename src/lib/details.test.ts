import { describe, expect, it } from 'vitest';
import { createAccountConfig } from './defaults';
import { filterAccounts, sortSnapshotsForDetails } from './details';
import { recalculateSnapshot } from './calculations';
import type { AssetSnapshot } from './types';

function snapshot(date: string, amount: number, excelTotal?: number): AssetSnapshot {
  return recalculateSnapshot({
    id: date,
    date,
    excelTotal,
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

describe('details helpers', () => {
  it('filters accounts by category and search text', () => {
    const accounts = [createAccountConfig('基金账户A'), createAccountConfig('现金账户B'), createAccountConfig('证券')];

    expect(filterAccounts(accounts, '全部', '现金').map((account) => account.name)).toEqual(['现金账户B']);
    expect(filterAccounts(accounts, '基金', '').map((account) => account.name)).toEqual(['基金账户A']);
  });

  it('sorts snapshots by date, computed total and total diff', () => {
    const rows = [snapshot('2026-01-01', 100, 80), snapshot('2026-02-01', 300, 250), snapshot('2025-12-01', 200, 198)];

    expect(sortSnapshotsForDetails(rows, 'date-desc').map((item) => item.date)).toEqual(['2026-02-01', '2026-01-01', '2025-12-01']);
    expect(sortSnapshotsForDetails(rows, 'total-desc').map((item) => item.computedTotalCny)).toEqual([300, 200, 100]);
    expect(sortSnapshotsForDetails(rows, 'diff-desc').map((item) => item.date)).toEqual(['2026-02-01', '2026-01-01', '2025-12-01']);
  });
});
