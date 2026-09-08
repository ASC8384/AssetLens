import { describe, expect, it } from 'vitest';
import { normalizeAppData } from './storage';
import { categoryForAccount, venueForAccount } from './defaults';

function legacyEntry(accountId: string, accountName: string, category: string, amount: number) {
  return {
    accountId,
    accountName,
    category,
    originalAmount: amount,
    currency: 'CNY',
    exchangeRate: 1,
    amountCny: amount,
    excelRatio: null,
    computedRatio: null,
    ratioDiff: null,
    includedInTotal: true,
  };
}

const legacyBackup = {
  version: 1,
  snapshots: [{
    id: 's1',
    date: '2026-05-01',
    exchangeRates: { CNY: 1 },
    computedTotalCny: 0,
    entries: [
      legacyEntry('fund', '场外基金A', '基金', 100),
      legacyEntry('stock', '券商账户A', '证券', 200),
      legacyEntry('cash', '活期账户A', '现金', 300),
      legacyEntry('bank', '某银行卡', '银行卡', 400),
      legacyEntry('misc', '未知账户A', '杂项', 500),
      legacyEntry('visa', '信用卡A', '负债', 50),
    ],
  }],
  accounts: [
    { id: 'fund', name: '场外基金A', category: '基金', defaultCurrency: 'CNY', includedInTotal: true, hidden: false },
    { id: 'misc', name: '未知账户A', category: '杂项', defaultCurrency: 'CNY', includedInTotal: true, hidden: false },
  ],
};

describe('legacy category migration', () => {
  it('maps the old five asset categories onto the new liquidity-based ones', () => {
    const data = normalizeAppData(legacyBackup);
    const categoryByAccountId = new Map(data.snapshots[0].entries.map((entry) => [entry.accountId, entry.category]));

    expect(categoryByAccountId.get('fund')).toBe('权益类');
    expect(categoryByAccountId.get('stock')).toBe('权益类');
    expect(categoryByAccountId.get('cash')).toBe('稳健类');
    expect(categoryByAccountId.get('bank')).toBe('稳健类');
    expect(categoryByAccountId.get('visa')).toBe('负债');
  });

  it('turns the old catch-all 杂项 into 未分类 so the UI can ask the user to confirm', () => {
    const data = normalizeAppData(legacyBackup);

    expect(data.snapshots[0].entries.find((entry) => entry.accountId === 'misc')?.category).toBe('未分类');
    expect(data.accounts.find((account) => account.id === 'misc')?.category).toBe('未分类');
  });

  it('infers a venue for accounts saved before the venue field existed', () => {
    const data = normalizeAppData(legacyBackup);

    expect(data.accounts.find((account) => account.id === 'fund')?.venue).toBe('场外');
    expect(data.snapshots[0].entries.find((entry) => entry.accountId === 'stock')?.venue).toBe('场内');
    expect(data.snapshots[0].entries.find((entry) => entry.accountId === 'misc')?.venue).toBe('其他');
  });

  it('keeps net worth unchanged across the migration', () => {
    const data = normalizeAppData(legacyBackup);

    expect(data.snapshots[0].computedGrossAssetsCny).toBe(1500);
    expect(data.snapshots[0].computedLiabilityCny).toBe(50);
    expect(data.snapshots[0].computedTotalCny).toBe(1450);
  });

  it('sums target ratios when several old categories collapse into one new category', () => {
    const data = normalizeAppData({
      ...legacyBackup,
      strategy: {
        cashReserveTarget: 30000,
        riskAssetMinRatio: 0.35,
        riskAssetMaxRatio: 0.65,
        targetCategoryRatios: { 基金: 0.35, 证券: 0.2, 现金: 0.15, 银行卡: 0.25, 杂项: 0.05, 负债: 0 },
      },
    });

    expect(data.strategy.targetCategoryRatios).toEqual({ 权益类: 0.35 + 0.2, 稳健类: 0.15 + 0.25, 负债: 0 });
  });

  it('migrates a saved category filter instead of leaving an unknown value selected', () => {
    const data = normalizeAppData({
      ...legacyBackup,
      preferences: { activeTab: 'details', detailMode: 'compact', detailIssueFilter: 'all', categoryFilter: '银行卡' },
    });

    expect(data.preferences.categoryFilter).toBe('稳健类');
  });
});

describe('account name inference', () => {
  it('only classifies high-confidence keywords', () => {
    expect(categoryForAccount('招商银行卡')).toBe('稳健类');
    expect(categoryForAccount('债基账户')).toBe('稳健类');
    expect(categoryForAccount('余额宝')).toBe('纯现金');
    expect(categoryForAccount('券商A股账户')).toBe('权益类');
    expect(categoryForAccount('沪深300ETF')).toBe('权益类');
    expect(categoryForAccount('信用卡A')).toBe('负债');
    expect(categoryForAccount('黄金实物')).toBe('其他资产');
  });

  it('leaves genuinely ambiguous names unclassified instead of guessing', () => {
    // 「基金」既可能是货基也可能是股票基金，猜错会同时污染饼图、风险占比和策略建议。
    expect(categoryForAccount('基金')).toBe('未分类');
    expect(categoryForAccount('未知账户A')).toBe('未分类');
    expect(categoryForAccount('')).toBe('未分类');
  });

  it('treats venue as an independent dimension from risk', () => {
    expect(venueForAccount('券商账户A')).toBe('场内');
    expect(venueForAccount('招商银行卡')).toBe('银行');
    expect(venueForAccount('支付宝理财')).toBe('场外');
    expect(venueForAccount('未知账户A')).toBe('其他');
  });
});
