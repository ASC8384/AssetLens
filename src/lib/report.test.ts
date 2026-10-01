import { describe, expect, it } from 'vitest';
import { availableReportRanges, accountContributionRows, applyReviewRangeRequest, buildStructuredReportSummary, syncReportRangeWithData, validateReportRange } from './report';
import { recalculateSnapshot } from './calculations';
import type { AppData, AssetSnapshot } from './types';

function snapshot(date: string, fund: number, cash: number): AssetSnapshot {
  return recalculateSnapshot({
    id: date,
    date,
    exchangeRates: { CNY: 1 },
    computedTotalCny: 0,
    entries: [
      { accountId: 'fund', accountName: '场外基金A', category: '权益类', venue: '场外', originalAmount: fund, currency: 'CNY', exchangeRate: 1, amountCny: null, excelRatio: null, computedRatio: null, ratioDiff: null, includedInTotal: true },
      { accountId: 'cash', accountName: '活期账户A', category: '纯现金', venue: '银行', originalAmount: cash, currency: 'CNY', exchangeRate: 1, amountCny: null, excelRatio: null, computedRatio: null, ratioDiff: null, includedInTotal: true },
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
    targetCategoryRatios: { 权益类: 0.4, 纯现金: 0.2 },
  },
  fire: { monthlyExpense: 10000, withdrawalRate: 0.035, emergencyReserveMonthsTarget: 12, expectedAnnualReturn: 0.04 },
  preferences: { activeTab: 'report', detailMode: 'compact', detailIssueFilter: 'all', categoryFilter: '全部' },
};

describe('report helpers', () => {
  it('provides quick report ranges anchored to the latest snapshot in local time', () => {
    const ranges = availableReportRanges(data);
    expect(ranges.map((range) => range.label)).toEqual(['全部', '本月', '近 1 个月', '近 3 个月', '近 1 年']);
    expect(ranges).toEqual(expect.arrayContaining([
      expect.objectContaining({ preset: 'all', startDate: '2026-01-01', endDate: '2026-04-01' }),
      expect.objectContaining({ preset: 'month', startDate: '2026-04-01', endDate: '2026-04-30' }),
      expect.objectContaining({ preset: '1m', startDate: '2026-03-01', endDate: '2026-04-01' }),
      expect.objectContaining({ preset: '3m', startDate: '2026-01-01', endDate: '2026-04-01' }),
      expect.objectContaining({ preset: '1y', startDate: '2025-04-01', endDate: '2026-04-01' }),
    ]));
  });

  it('keeps shortcut ranges following new snapshots, but leaves custom ranges alone', () => {
    const custom = { startDate: '2026-02-01', endDate: '2026-03-01', preset: 'custom' as const };
    expect(syncReportRangeWithData(data, custom)).toEqual(custom);

    const nextData: AppData = {
      ...data,
      snapshots: [...data.snapshots, snapshot('2026-06-01', 200, 80)],
    };
    expect(syncReportRangeWithData(nextData, { startDate: '2026-01-01', endDate: '2026-04-01', preset: 'all' })).toEqual({
      startDate: '2026-01-01',
      endDate: '2026-06-01',
      preset: 'all',
    });
  });

  it('applies a dashboard month request without rewriting it to the latest month', () => {
    expect(applyReviewRangeRequest({ startDate: '2026-02-01', endDate: '2026-02-28', preset: 'custom' }, data)).toEqual({
      startDate: '2026-02-01',
      endDate: '2026-02-28',
      preset: 'custom',
    });
  });

  it('rejects empty, invalid, and reversed ranges', () => {
    expect(validateReportRange('', '2026-04-01')).toBe('请选择开始和结束日期。');
    expect(validateReportRange('2026-02-31', '2026-04-01')).toBe('日期格式无效，请使用有效的日历日期。');
    expect(validateReportRange('2026-05-01', '2026-04-01')).toBe('开始日期不能晚于结束日期。');
    expect(validateReportRange('2026-01-01', '2026-04-01')).toBeNull();
  });

  it('computes account contribution rows', () => {
    expect(accountContributionRows(data.snapshots[0], data.snapshots[2])).toEqual([
      { accountName: '场外基金A', change: 60 },
      { accountName: '活期账户A', change: 40 },
    ]);
  });

  it('leaves hidden accounts out of contributions and risk ratios but keeps them in net worth', () => {
    const accounts = [{ id: 'cash', name: '活期账户A', category: '纯现金' as const, venue: '银行' as const, defaultCurrency: 'CNY', includedInTotal: true, hidden: true }];
    const summary = buildStructuredReportSummary({ ...data, accounts }, '2026-01-01', '2026-04-01', 'endpoint');

    expect(accountContributionRows(data.snapshots[0], data.snapshots[2], accounts)).toEqual([{ accountName: '场外基金A', change: 60 }]);
    expect(summary).toMatchObject({ startTotal: 150, endTotal: 250, riskAssetRatioChange: { start: 1, end: 1 } });
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
      { accountName: '场外基金A', change: 60 },
      { accountName: '活期账户A', change: 40 },
    ]);
    expect(summary.topDecreases).toEqual([]);
    expect(summary.categoryChanges).toEqual(expect.arrayContaining([
      { category: '权益类', start: 100, end: 160, change: 60 },
      { category: '纯现金', start: 50, end: 90, change: 40 },
    ]));
    expect(summary.externalIncomeTotal).toBeNull();
    expect(summary.endLiability).toBe(0);
    expect(summary.riskAssetRatioChange).toEqual({
      start: 100 / 150,
      end: 160 / 250,
      change: 160 / 250 - 100 / 150,
    });
    expect(summary.dataQualityMessages).toEqual(['数据质量未发现明显异常。']);
  });

  it('excludes the starting snapshot income from the range total', () => {
    const withIncome: AppData = {
      ...data,
      snapshots: [
        { ...snapshot('2026-01-01', 100, 50), externalIncome: 999 },
        { ...snapshot('2026-02-01', 180, 30), externalIncome: 40 },
        { ...snapshot('2026-04-01', 160, 90), externalIncome: 30 },
      ],
    };
    const summary = buildStructuredReportSummary(withIncome, '2026-01-01', '2026-04-01', 'endpoint');

    expect(summary.externalIncomeTotal).toBe(70);
    expect(summary.afterIncomeChange).toBe(30);
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
