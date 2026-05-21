import { describe, expect, it } from 'vitest';
import { accountRankingRows, analyzeDataHealth, categoryChangeRows, categoryTrendData, dailyNetChangeRows, dashboardSummary, riskTrendData, selectedSnapshotContext } from './dashboard';
import { recalculateSnapshot } from './calculations';
import type { AppData, AssetSnapshot } from './types';

function snapshot(date: string, fund: number, cash: number, excelTotal?: number, exchangeRates: Record<string, number> = { CNY: 1 }): AssetSnapshot {
  return recalculateSnapshot({
    id: date,
    date,
    excelTotal,
    exchangeRates,
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

function appData(snapshots: AssetSnapshot[]): AppData {
  return {
    version: 1,
    snapshots,
    accounts: [],
    defaultExchangeRates: { CNY: 1 },
    strategy: { cashReserveTarget: 100, riskAssetMinRatio: 0.2, riskAssetMaxRatio: 0.8, targetCategoryRatios: {} },
    fire: { monthlyExpense: 10000, withdrawalRate: 0.035, emergencyReserveMonthsTarget: 12, expectedAnnualReturn: 0.04 },
    preferences: { activeTab: 'dashboard', detailMode: 'compact', categoryFilter: '全部' },
  };
}

const today = new Date('2026-05-21T00:00:00');

describe('analyzeDataHealth', () => {
  it('guides empty data toward import', () => {
    const result = analyzeDataHealth(appData([]), today);

    expect(result).toMatchObject({
      status: 'empty',
      title: '还没有数据',
      message: expect.stringContaining('还没有数据'),
      latestDate: null,
      daysSinceLatest: null,
      snapshotCount: 0,
      action: { label: '展开导入区开始导入' },
    });
  });

  it('guides one snapshot toward importing another snapshot', () => {
    const result = analyzeDataHealth(appData([snapshot('2026-05-01', 100, 40)]), today);

    expect(result).toMatchObject({
      status: 'single',
      message: expect.stringContaining('再导入一期'),
      latestDate: '2026-05-01',
      daysSinceLatest: 20,
      snapshotCount: 1,
    });
  });

  it('guides total-difference issues toward details', () => {
    const result = analyzeDataHealth(appData([snapshot('2026-05-01', 100, 40, 80)]), today);

    expect(result).toMatchObject({
      status: 'attention',
      message: expect.stringContaining('发现合计差异'),
      hasTotalIssue: true,
      action: { label: '去明细表检查', tab: 'details' },
    });
  });

  it('guides normal multi-snapshot data toward review report', () => {
    const result = analyzeDataHealth(appData([snapshot('2026-04-01', 100, 40, 140), snapshot('2026-05-01', 120, 60, 180)]), today);

    expect(result).toMatchObject({
      status: 'ok',
      message: expect.stringContaining('生成本月复盘'),
      snapshotCount: 2,
      action: { label: '生成复盘', tab: 'report' },
    });
  });

  it('exposes non-CNY and missing exchange-rate flags', () => {
    const row = snapshot('2026-05-01', 100, 40, 140, { CNY: 1 });
    row.entries[0] = { ...row.entries[0], currency: 'USD', exchangeRate: null, amountCny: null };
    const result = analyzeDataHealth(appData([row]), today);

    expect(result.hasNonCnyAssets).toBe(true);
    expect(result.hasMissingExchangeRates).toBe(true);
    expect(result).toMatchObject({ status: 'attention', action: { tab: 'details' } });
  });

  it('does not report NaN days for unnamed imported dates', () => {
    const result = analyzeDataHealth(appData([snapshot('未命名日期 1', 100, 40)]), today);

    expect(result.daysSinceLatest).toBeNull();
  });
});

describe('selectedSnapshotContext', () => {
  it('returns selected snapshot and previous snapshot for point-in-time dashboard', () => {
    const snapshots = [snapshot('2026-01-01', 100, 40), snapshot('2026-02-01', 120, 60), snapshot('2026-03-01', 160, 80)];

    expect(selectedSnapshotContext(snapshots, '2026-02-01')).toMatchObject({
      selected: expect.objectContaining({ date: '2026-02-01' }),
      previous: expect.objectContaining({ date: '2026-01-01' }),
      selectedIndex: 1,
    });
  });

  it('falls back to latest snapshot when selected id is empty or missing', () => {
    const snapshots = [snapshot('2026-01-01', 100, 40), snapshot('2026-02-01', 120, 60)];

    expect(selectedSnapshotContext(snapshots, '').selected?.date).toBe('2026-02-01');
    expect(selectedSnapshotContext(snapshots, 'missing').selected?.date).toBe('2026-02-01');
  });

  it('selects duplicate-date snapshots by id instead of the first matching date', () => {
    const first = { ...snapshot('2026-02-01', 120, 60), id: 'first-same-date' };
    const second = { ...snapshot('2026-02-01', 220, 60), id: 'second-same-date' };
    const snapshots = [snapshot('2026-01-01', 100, 40), first, second];

    expect(selectedSnapshotContext(snapshots, 'second-same-date')).toMatchObject({
      selected: expect.objectContaining({ id: 'second-same-date', computedTotalCny: 280 }),
      previous: expect.objectContaining({ id: 'first-same-date' }),
      selectedIndex: 2,
    });
  });
});

describe('dashboardSummary', () => {
  it('returns latest category leader and risk asset ratio', () => {
    const data: AppData = {
      version: 1,
      snapshots: [snapshot('2026-01-01', 100, 40), snapshot('2026-02-01', 120, 60)],
      accounts: [],
      defaultExchangeRates: { CNY: 1 },
      strategy: { cashReserveTarget: 100, riskAssetMinRatio: 0.2, riskAssetMaxRatio: 0.8, targetCategoryRatios: {} },
      fire: { monthlyExpense: 10000, withdrawalRate: 0.035, emergencyReserveMonthsTarget: 12, expectedAnnualReturn: 0.04 },
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
      strategy: { cashReserveTarget: 100, riskAssetMinRatio: 0.2, riskAssetMaxRatio: 0.8, targetCategoryRatios: {} },
      fire: { monthlyExpense: 10000, withdrawalRate: 0.035, emergencyReserveMonthsTarget: 12, expectedAnnualReturn: 0.04 },
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
      strategy: { cashReserveTarget: 100, riskAssetMinRatio: 0.2, riskAssetMaxRatio: 0.8, targetCategoryRatios: {} },
      fire: { monthlyExpense: 10000, withdrawalRate: 0.035, emergencyReserveMonthsTarget: 12, expectedAnnualReturn: 0.04 },
      preferences: { activeTab: 'dashboard', detailMode: 'compact', categoryFilter: '全部' },
    };

    expect(categoryTrendData(data)).toEqual([
      expect.objectContaining({ date: '2026-01-01', total: 140, 基金: 100, 现金: 40 }),
      expect.objectContaining({ date: '2026-02-01', total: 180, 基金: 120, 现金: 60 }),
    ]);
  });
});

describe('dailyNetChangeRows', () => {
  it('returns daily net asset changes between adjacent snapshots', () => {
    const data: AppData = {
      version: 1,
      snapshots: [snapshot('2026-01-01', 100, 40), snapshot('2026-01-11', 220, 20), snapshot('2026-01-21', 170, 20)],
      accounts: [],
      defaultExchangeRates: { CNY: 1 },
      strategy: { cashReserveTarget: 100, riskAssetMinRatio: 0.2, riskAssetMaxRatio: 0.8, targetCategoryRatios: {} },
      fire: { monthlyExpense: 10000, withdrawalRate: 0.035, emergencyReserveMonthsTarget: 12, expectedAnnualReturn: 0.04 },
      preferences: { activeTab: 'dashboard', detailMode: 'compact', categoryFilter: '全部' },
    };

    expect(dailyNetChangeRows(data)).toEqual([
      { startDate: '2026-01-01', endDate: '2026-01-11', days: 10, totalChange: 100, dailyChange: 10 },
      { startDate: '2026-01-11', endDate: '2026-01-21', days: 10, totalChange: -50, dailyChange: -5 },
    ]);
  });

  it('skips intervals without a positive day span', () => {
    const data: AppData = {
      version: 1,
      snapshots: [snapshot('2026-01-01', 100, 40), snapshot('2026-01-01', 120, 60), snapshot('2026-01-11', 220, 60)],
      accounts: [],
      defaultExchangeRates: { CNY: 1 },
      strategy: { cashReserveTarget: 100, riskAssetMinRatio: 0.2, riskAssetMaxRatio: 0.8, targetCategoryRatios: {} },
      fire: { monthlyExpense: 10000, withdrawalRate: 0.035, emergencyReserveMonthsTarget: 12, expectedAnnualReturn: 0.04 },
      preferences: { activeTab: 'dashboard', detailMode: 'compact', categoryFilter: '全部' },
    };

    expect(dailyNetChangeRows(data)).toEqual([
      { startDate: '2026-01-01', endDate: '2026-01-11', days: 10, totalChange: 100, dailyChange: 10 },
    ]);
  });
});
