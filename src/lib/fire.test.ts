import { describe, expect, it } from 'vitest';
import { analyzeFire, createDefaultFireConfig, fireSensitivityMatrix, fireSpeedEstimates } from './fire';
import { recalculateSnapshot } from './calculations';
import type { AssetSnapshot } from './types';

function snapshot(date: string, total: number): AssetSnapshot {
  return recalculateSnapshot({
    id: date,
    date,
    exchangeRates: { CNY: 1 },
    computedTotalCny: 0,
    entries: [
      { accountId: 'cash', accountName: '现金', category: '现金', originalAmount: total * 0.2, currency: 'CNY', exchangeRate: 1, amountCny: null, excelRatio: null, computedRatio: null, ratioDiff: null, includedInTotal: true },
      { accountId: 'bank', accountName: '银行卡', category: '银行卡', originalAmount: total * 0.1, currency: 'CNY', exchangeRate: 1, amountCny: null, excelRatio: null, computedRatio: null, ratioDiff: null, includedInTotal: true },
      { accountId: 'fund', accountName: '基金', category: '基金', originalAmount: total * 0.7, currency: 'CNY', exchangeRate: 1, amountCny: null, excelRatio: null, computedRatio: null, ratioDiff: null, includedInTotal: true },
    ],
  });
}

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

    expect(estimates[0]).toMatchObject({ confidenceLabel: '样本不足', months: 1 });
    expect(estimates[1]).toMatchObject({ confidenceLabel: '样本不足' });
  });

  it('marks latest speed as volatile when it is much larger than all-time speed', () => {
    const estimates = fireSpeedEstimates([
      snapshot('2025-01-01', 1000000),
      snapshot('2025-07-01', 1060000),
      snapshot('2026-01-01', 1120000),
      snapshot('2026-02-01', 1600000),
    ], 2000000);

    expect(estimates.find((estimate) => estimate.key === 'latest')).toMatchObject({
      confidenceLabel: '波动较大',
    });
  });

  it('estimates months to FIRE from latest interval, last year and all history speeds', () => {
    const snapshots = [
      snapshot('2025-01-01', 1000000),
      snapshot('2025-07-01', 1300000),
      snapshot('2026-01-01', 1600000),
      snapshot('2026-02-01', 1700000),
    ];

    expect(fireSpeedEstimates(snapshots, 2000000)).toEqual([
      expect.objectContaining({ key: 'latest', monthlyChange: 100000, projectedMonthsToFire: 3 }),
      expect.objectContaining({ key: 'lastYear', monthlyChange: 400000 / 7, projectedMonthsToFire: 6 }),
      expect.objectContaining({ key: 'allTime', monthlyChange: 700000 / 13, projectedMonthsToFire: 6 }),
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
    expect(result.monthlyGrowth).toBe(100000);
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
    expect(result.monthlyGrowth).toBe(100000);
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
