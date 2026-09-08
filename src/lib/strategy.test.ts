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
      { accountId: 'cash', accountName: '稳健池A', category: '稳健类', venue: '银行', originalAmount: 10000, currency: 'CNY', exchangeRate: 1, amountCny: null, excelRatio: null, computedRatio: null, ratioDiff: null, includedInTotal: true },
      { accountId: 'fund', accountName: '场外基金A', category: '权益类', venue: '场外', originalAmount: 70000, currency: 'CNY', exchangeRate: 1, amountCny: null, excelRatio: null, computedRatio: null, ratioDiff: null, includedInTotal: true },
      { accountId: 'stock', accountName: '券商账户A', category: '权益类', venue: '场内', originalAmount: 20000, currency: 'CNY', exchangeRate: 1, amountCny: null, excelRatio: null, computedRatio: null, ratioDiff: null, includedInTotal: true },
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
    expect(result.suggestions).toContain('应急备用金低于目标 ¥20,000.00');
    expect(result.suggestions.some((item) => item.startsWith('风险资产占比高于上限'))).toBe(true);
  });
});
