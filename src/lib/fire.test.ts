import { describe, expect, it } from 'vitest';
import { analyzeFire, createDefaultFireConfig, fireSpeedEstimates } from './fire';
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

describe('FIRE speed estimates', () => {
  it('estimates months to FIRE from latest interval, last year and all history speeds', () => {
    const snapshots = [
      snapshot('2025-01-01', 1000000),
      snapshot('2025-07-01', 1300000),
      snapshot('2026-01-01', 1600000),
      snapshot('2026-02-01', 1700000),
    ];

    expect(fireSpeedEstimates(snapshots, 2000000)).toEqual([
      expect.objectContaining({ key: 'latest', monthlyChange: 100000, monthsToFire: 3 }),
      expect.objectContaining({ key: 'lastYear', monthlyChange: 400000 / 7, monthsToFire: 6 }),
      expect.objectContaining({ key: 'allTime', monthlyChange: 700000 / 13, monthsToFire: 6 }),
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
    expect(result.monthlyGrowth).toBe(100000);
  });

  it('keeps return-rate context but does not forecast with future contribution assumptions', () => {
    const config = {
      ...createDefaultFireConfig(),
      expectedAnnualReturn: 0.04,
    };
    const result = analyzeFire([snapshot('2026-01-01', 1000000), snapshot('2026-02-01', 1100000)], config);

    expect(result.forecasts.contributionOnlyMonths).toBeNull();
    expect(result.forecasts.withReturnMonths).toBeNull();
    expect(result.forecasts.stressMonths).toBeNull();
    expect(result.expectedAnnualReturn).toBe(0.04);
    expect(result.monthlyGrowth).toBe(100000);
  });
});
