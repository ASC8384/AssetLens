import { describe, expect, it } from 'vitest';
import { analyzeFire, createDefaultFireConfig, fireDecisionSummary, fireSensitivityMatrix, fireSpeedEstimates } from './fire';
import { recalculateSnapshot } from './calculations';
import { DAYS_PER_MONTH } from './intervals';
import type { AssetSnapshot } from './types';

const months = (days: number) => days / DAYS_PER_MONTH;

function snapshot(date: string, total: number): AssetSnapshot {
  return recalculateSnapshot({
    id: date,
    date,
    exchangeRates: { CNY: 1 },
    computedTotalCny: 0,
    entries: [
      { accountId: 'cash', accountName: '活期账户A', category: '纯现金', venue: '银行', originalAmount: total * 0.2, currency: 'CNY', exchangeRate: 1, amountCny: null, excelRatio: null, computedRatio: null, ratioDiff: null, includedInTotal: true },
      { accountId: 'bank', accountName: '银行理财A', category: '稳健类', venue: '银行', originalAmount: total * 0.1, currency: 'CNY', exchangeRate: 1, amountCny: null, excelRatio: null, computedRatio: null, ratioDiff: null, includedInTotal: true },
      { accountId: 'fund', accountName: '场外基金A', category: '权益类', venue: '场外', originalAmount: total * 0.7, currency: 'CNY', exchangeRate: 1, amountCny: null, excelRatio: null, computedRatio: null, ratioDiff: null, includedInTotal: true },
    ],
  });
}

describe('FIRE decision summary', () => {
  it('summarizes FIRE gap, target date and variable impact', () => {
    const config = createDefaultFireConfig();
    const summary = fireDecisionSummary(snapshot('2026-05-01', 1000000), config, new Date('2026-05-27T00:00:00'));

    expect(summary).toMatchObject({
      fireGap: 120000 / 0.035 - 1000000,
      targetYearMonth: expect.stringMatching(/^\d{4}-\d{2}$/),
      emergencyStatus: '已达标',
    });
    expect(summary.variableImpacts).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: '月支出 +20%' }),
      expect.objectContaining({ label: '提取率降到 3.0%' }),
    ]));
    expect(summary.nextActions.length).toBeGreaterThan(0);
  });
});

describe('FIRE sensitivity matrix', () => {
  it('builds a FIRE sensitivity matrix from expense multipliers and withdrawal rates', () => {
    const matrix = fireSensitivityMatrix(createDefaultFireConfig(), 1000000);

    expect(matrix.rows).toHaveLength(3);
    expect(matrix.rates.map((rate) => rate.withdrawalRate)).toEqual([0.03, 0.035, 0.04]);
    expect(matrix.rows[1]).toMatchObject({ label: '当前支出', monthlyExpense: 10000 });
    expect(matrix.rows[1].cells[1]).toMatchObject({
      target: 120000 / 0.035,
      gap: 120000 / 0.035 - 1000000,
      isCurrent: true,
    });
  });

  it('includes the current withdrawal rate when it is not one of the fixed matrix rates', () => {
    const matrix = fireSensitivityMatrix({ ...createDefaultFireConfig(), withdrawalRate: 0.033 }, 1000000);

    expect(matrix.rates.map((rate) => rate.withdrawalRate)).toContain(0.033);
    expect(matrix.rows.flatMap((row) => row.cells).some((cell) => cell.isCurrent)).toBe(true);
  });
});

describe('FIRE speed estimates', () => {
  it('marks short history speed estimates as sample-limited', () => {
    const estimates = fireSpeedEstimates([
      snapshot('2026-01-01', 1000000),
      snapshot('2026-02-01', 1100000),
    ], 2000000);

    expect(estimates[0]).toMatchObject({ confidenceLabel: '样本不足', months: months(31), incomeAmortized: false });
    expect(estimates[1]).toMatchObject({ confidenceLabel: '样本不足' });
  });

  it('counts months from actual days instead of calendar month boundaries', () => {
    const estimates = fireSpeedEstimates([
      snapshot('2026-04-28', 1000000),
      snapshot('2026-05-06', 1000800),
    ], 2000000);

    expect(estimates[0].months).toBeCloseTo(months(8));
    expect(estimates[0].monthlyChange).toBeCloseTo(100 * DAYS_PER_MONTH);
  });

  it('starts the last-month speed from the latest snapshot at least one month earlier', () => {
    const estimates = fireSpeedEstimates([
      snapshot('2026-03-05', 1000000),
      snapshot('2026-04-28', 1020000),
      snapshot('2026-05-06', 1020800),
    ], 2000000);

    expect(estimates[0]).toMatchObject({ key: 'lastMonth', label: '最近一个月速度', startDate: '2026-03-05', endDate: '2026-05-06' });
    expect(estimates[0].monthlyChange).toBeCloseTo(20800 / months(62));
  });

  it('clamps month-end dates when looking one month back', () => {
    const estimates = fireSpeedEstimates([
      snapshot('2026-02-28', 1000000),
      snapshot('2026-03-03', 1001000),
      snapshot('2026-03-31', 1010000),
    ], 2000000);

    expect(estimates[0].startDate).toBe('2026-02-28');
  });

  it('spreads external income over days for the last-month speed', () => {
    const estimates = fireSpeedEstimates([
      { ...snapshot('2026-01-01', 1000000), externalIncome: 10000 },
      { ...snapshot('2026-01-25', 1012400), externalIncome: 10000 },
      snapshot('2026-02-02', 1013200),
    ], 2000000);

    expect(estimates[0]).toMatchObject({ key: 'lastMonth', startDate: '2026-01-01', incomeAmortized: true });
    expect(estimates[0].monthlyChange).toBeCloseTo((100 + 10000 / 24) * DAYS_PER_MONTH);
  });

  it('marks last-month speed as volatile when it is much larger than all-time speed', () => {
    const estimates = fireSpeedEstimates([
      snapshot('2025-01-01', 1000000),
      snapshot('2025-07-01', 1060000),
      snapshot('2026-01-01', 1120000),
      snapshot('2026-02-01', 1600000),
    ], 2000000);

    expect(estimates.find((estimate) => estimate.key === 'lastMonth')).toMatchObject({
      confidenceLabel: '波动较大',
    });
  });

  it('estimates months to FIRE from last month, last year and all history speeds', () => {
    const snapshots = [
      snapshot('2025-01-01', 1000000),
      snapshot('2025-07-01', 1300000),
      snapshot('2026-01-01', 1600000),
      snapshot('2026-02-01', 1700000),
    ];

    expect(fireSpeedEstimates(snapshots, 2000000)).toEqual([
      expect.objectContaining({ key: 'lastMonth', monthlyChange: expect.closeTo(100000 / months(31)), projectedMonthsToFire: 4 }),
      expect.objectContaining({ key: 'lastYear', monthlyChange: expect.closeTo(400000 / months(215)), projectedMonthsToFire: 6 }),
      expect.objectContaining({ key: 'allTime', monthlyChange: expect.closeTo(700000 / months(396)), projectedMonthsToFire: 6 }),
    ]);
  });
});

describe('FIRE analysis', () => {
  it('calculates target, progress, gap and emergency reserve months', () => {
    const result = analyzeFire([snapshot('2026-01-01', 900000), snapshot('2026-02-01', 1000000)], createDefaultFireConfig());

    expect(result.fireTarget).toBeCloseTo(120000 / 0.035);
    expect(result.currentNetWorth).toBe(1000000);
    expect(result.fireProgress).toBeCloseTo(1000000 / (120000 / 0.035));
    expect(result.fireGap).toBeCloseTo(120000 / 0.035 - 1000000);
    expect(result.emergencyReserveMonths).toBe(30);
    expect(result.emergencyReserveTarget).toBe(120000);
    expect(result.emergencyReserveGap).toBe(0);
    expect(result.fireTarget).toBeCloseTo(120000 / 0.035);
    expect(result.monthlyGrowth).toBeCloseTo(100000 / months(31));
  });

  it('keeps hidden accounts in FIRE progress but out of the emergency reserve', () => {
    const accounts = [{ id: 'cash', name: '活期账户A', category: '纯现金' as const, venue: '银行' as const, defaultCurrency: 'CNY', includedInTotal: true, hidden: true }];
    const result = analyzeFire([snapshot('2026-01-01', 900000), snapshot('2026-02-01', 1000000)], createDefaultFireConfig(), accounts);

    expect(result.currentNetWorth).toBe(1000000);
    expect(result.emergencyReserveMonths).toBe(10);
    expect(result.emergencyReserveGap).toBe(20000);
    expect(result.decisionSummary.emergencyStatus).toBe('需补齐');
  });

  it('keeps historical speed independent from expected annual return', () => {
    const snapshots = [snapshot('2025-01-01', 1000000), snapshot('2026-01-01', 1300000)];
    const lowReturn = analyzeFire(snapshots, { ...createDefaultFireConfig(), expectedAnnualReturn: 0.01 });
    const highReturn = analyzeFire(snapshots, { ...createDefaultFireConfig(), expectedAnnualReturn: 0.08 });

    expect(highReturn.speedEstimates).toEqual(lowReturn.speedEstimates);
  });

  it('uses expected annual return for return-only FIRE estimate without future contribution assumptions', () => {
    const config = {
      ...createDefaultFireConfig(),
      expectedAnnualReturn: 0.04,
    };
    const result = analyzeFire([snapshot('2026-01-01', 1000000), snapshot('2026-02-01', 1100000)], config);

    expect(result.forecasts.contributionOnlyMonths).toBeNull();
    expect(result.forecasts.withReturnMonths).toBeGreaterThan(0);
    expect(result.forecasts.stressMonths).toBeNull();
    expect(result.expectedAnnualReturn).toBe(0.04);
    expect(result.monthlyGrowth).toBeCloseTo(100000 / months(31));
  });

  it('does not estimate return-only FIRE when assets or returns cannot compound', () => {
    const noAsset = analyzeFire([snapshot('2026-01-01', 0)], createDefaultFireConfig());
    const noReturn = analyzeFire([snapshot('2026-01-01', 1000000)], { ...createDefaultFireConfig(), expectedAnnualReturn: 0 });

    expect(noAsset.forecasts.withReturnMonths).toBeNull();
    expect(noReturn.forecasts.withReturnMonths).toBeNull();
  });

  it('returns zero return-only months when FIRE target is already reached', () => {
    const result = analyzeFire([snapshot('2026-01-01', 4000000)], createDefaultFireConfig());

    expect(result.forecasts.withReturnMonths).toBe(0);
  });
});
