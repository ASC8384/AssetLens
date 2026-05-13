import { describe, expect, it } from 'vitest';
import { availableReportRanges, accountContributionRows } from './report';
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
  fire: { monthlyExpense: 10000, withdrawalRate: 0.035, emergencyReserveMonthsTarget: 12, monthlyContribution: 20000, expectedAnnualReturn: 0.04, stressNoContributionMonths: 6 },
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
});
