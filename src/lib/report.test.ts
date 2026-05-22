import { describe, expect, it } from 'vitest';
import { availableReportRanges, accountContributionRows, buildStructuredReportSummary } from './report';
import { recalculateSnapshot } from './calculations';
import type { AppData, AssetSnapshot } from './types';

function snapshot(date: string, fund: number, cash: number): AssetSnapshot {
  return recalculateSnapshot({
    id: date,
    date,
    exchangeRates: { CNY: 1 },
    computedTotalCny: 0,
    entries: [
      { accountId: 'fund', accountName: '基金', category: '基金', originalAmount: fund, currency: 'CNY', exchangeRate: 1, amountCny: null, excelRatio: null, computedRatio: null, ratioDiff: null, includedInTotal: true },
      { accountId: 'cash', accountName: '现金', category: '现金', originalAmount: cash, currency: 'CNY', exchangeRate: 1, amountCny: null, excelRatio: null, computedRatio: null, ratioDiff: null, includedInTotal: true },
    ],
  });
}

const data: AppData = {
  version: 1,
  snapshots: [snapshot('2026-01-01', 100, 50), snapshot('2026-02-01', 180, 30), snapshot('2026-04-01', 160, 90)],
  accounts: [],
  defaultExchangeRates: { CNY: 1 },
  strategy: {
    cashReserveTarget: 100,
    riskAssetMinRatio: 0.2,
    riskAssetMaxRatio: 0.7,
    targetCategoryRatios: { 基金: 0.4, 现金: 0.2 },
  },
  fire: { monthlyExpense: 10000, withdrawalRate: 0.035, emergencyReserveMonthsTarget: 12, expectedAnnualReturn: 0.04 },
  preferences: { activeTab: 'report', detailMode: 'compact', categoryFilter: '全部' },
};

describe('report helpers', () => {
  it('provides quick report ranges', () => {
    expect(availableReportRanges(data).map((range) => range.label)).toEqual(['全部', '近 1 个月', '近 3 个月', '近 1 年']);
  });

  it('computes account contribution rows', () => {
    expect(accountContributionRows(data.snapshots[0], data.snapshots[2])).toEqual([
      { accountName: '基金', change: 60 },
      { accountName: '现金', change: 40 },
    ]);
  });

  it('builds a structured report summary from the selected range', () => {
    const summary = buildStructuredReportSummary(data, '2026-01-01', '2026-04-01', 'endpoint');

    expect(summary).toMatchObject({
      status: 'ready',
      startDate: '2026-01-01',
      endDate: '2026-04-01',
      snapshotCount: 3,
      startTotal: 150,
      endTotal: 250,
      totalChange: 100,
      growth: 100 / 150,
    });
    expect(summary.topIncreases).toEqual([
      { accountName: '基金', change: 60 },
      { accountName: '现金', change: 40 },
    ]);
    expect(summary.topDecreases).toEqual([]);
    expect(summary.categoryChanges).toEqual(expect.arrayContaining([
      { category: '基金', start: 100, end: 160, change: 60 },
      { category: '现金', start: 50, end: 90, change: 40 },
    ]));
    expect(summary.riskAssetRatioChange).toEqual({
      start: 100 / 150,
      end: 160 / 250,
      change: 160 / 250 - 100 / 150,
    });
    expect(summary.dataQualityMessages).toEqual(['数据质量未发现明显异常。']);
  });

  it('returns an empty structured report summary for an empty range', () => {
    const summary = buildStructuredReportSummary(data, '2030-01-01', '2030-12-31', 'endpoint');

    expect(summary).toMatchObject({
      status: 'empty',
      message: '当前时间范围内没有资产记录。',
      snapshotCount: 0,
    });
  });
});
