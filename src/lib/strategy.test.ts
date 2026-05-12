import { describe, expect, it } from 'vitest';
import { analyzeStrategy, createDefaultStrategyConfig } from './strategy';
import { recalculateSnapshot } from './calculations';
import type { AssetSnapshot } from './types';

function snapshot(): AssetSnapshot {
  return recalculateSnapshot({
    id: 's1',
    date: '2026-05-01',
    exchangeRates: { CNY: 1 },
    computedTotalCny: 0,
    entries: [
      { accountId: 'cash', accountName: '现金', category: '现金', originalAmount: 10000, currency: 'CNY', exchangeRate: 1, amountCny: null, excelRatio: null, computedRatio: null, ratioDiff: null, includedInTotal: true },
      { accountId: 'fund', accountName: '基金', category: '基金', originalAmount: 70000, currency: 'CNY', exchangeRate: 1, amountCny: null, excelRatio: null, computedRatio: null, ratioDiff: null, includedInTotal: true },
      { accountId: 'stock', accountName: '证券', category: '证券', originalAmount: 20000, currency: 'CNY', exchangeRate: 1, amountCny: null, excelRatio: null, computedRatio: null, ratioDiff: null, includedInTotal: true },
    ],
  });
}

describe('strategy analysis', () => {
  it('detects cash reserve deficit and risk asset overflow', () => {
    const config = createDefaultStrategyConfig();
    const result = analyzeStrategy(snapshot(), config);

    expect(result.cashReserveGap).toBe(-20000);
    expect(result.riskAssetRatio).toBe(0.9);
    expect(result.riskStatus).toBe('above');
    expect(result.suggestions).toContain('现金低于安全垫目标 ¥20,000.00');
    expect(result.suggestions.some((item) => item.startsWith('风险资产占比高于上限'))).toBe(true);
  });
});
