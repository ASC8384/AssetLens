import { describe, expect, it } from 'vitest';
import { accountRankingRows, categoryChangeRows, categoryTrendData, dashboardSummary, riskTrendData, selectedSnapshotContext } from './dashboard';
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

describe('selectedSnapshotContext', () => {
  it('returns selected snapshot and previous snapshot for point-in-time dashboard', () => {
    const snapshots = [snapshot('2026-01-01', 100, 40), snapshot('2026-02-01', 120, 60), snapshot('2026-03-01', 160, 80)];

    expect(selectedSnapshotContext(snapshots, '2026-02-01')).toMatchObject({
      selected: expect.objectContaining({ date: '2026-02-01' }),
      previous: expect.objectContaining({ date: '2026-01-01' }),
      selectedIndex: 1,
    });
  });

  it('falls back to latest snapshot when selected date is empty or missing', () => {
    const snapshots = [snapshot('2026-01-01', 100, 40), snapshot('2026-02-01', 120, 60)];

    expect(selectedSnapshotContext(snapshots, '').selected?.date).toBe('2026-02-01');
    expect(selectedSnapshotContext(snapshots, 'missing').selected?.date).toBe('2026-02-01');
  });
});

describe('dashboardSummary', () => {
  it('returns latest category leader and risk asset ratio', () => {
    const data: AppData = {
      version: 1,
      snapshots: [snapshot('2026-01-01', 100, 40), snapshot('2026-02-01', 120, 60)],
      accounts: [],
      defaultExchangeRates: { CNY: 1 },
      preferences: { activeTab: 'dashboard', detailMode: 'compact', categoryFilter: '全部' },
    };

    expect(dashboardSummary(data)).toMatchObject({
      leaderCategory: '基金',
      leaderAmount: 120,
      riskAssetRatio: 120 / 180,
    });
  });
});

describe('dashboard chart helpers', () => {
  it('returns selected snapshot account ranking rows', () => {
    const current = snapshot('2026-02-01', 120, 60);

    expect(accountRankingRows(current)).toEqual([
      { accountName: '基金账户', amount: 120 },
      { accountName: '现金账户', amount: 60 },
    ]);
  });

  it('returns cash versus risk trend rows', () => {
    const data: AppData = {
      version: 1,
      snapshots: [snapshot('2026-01-01', 100, 40), snapshot('2026-02-01', 120, 60)],
      accounts: [],
      defaultExchangeRates: { CNY: 1 },
      preferences: { activeTab: 'dashboard', detailMode: 'compact', categoryFilter: '全部' },
    };

    expect(riskTrendData(data)).toEqual([
      expect.objectContaining({ date: '2026-01-01', risk: 100, safe: 40 }),
      expect.objectContaining({ date: '2026-02-01', risk: 120, safe: 60 }),
    ]);
  });

  it('returns category change rows between previous and selected snapshots', () => {
    const previous = snapshot('2026-01-01', 100, 40);
    const selected = snapshot('2026-02-01', 120, 60);

    expect(categoryChangeRows(previous, selected)).toEqual(expect.arrayContaining([
      { category: '基金', change: 20 },
      { category: '现金', change: 20 },
    ]));
  });
});

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
