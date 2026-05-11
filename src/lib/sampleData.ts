import { mergeAccounts, recalculateSnapshot } from './calculations';
import { createEmptyAppData, defaultExchangeRates } from './defaults';
import type { AppData, AssetSnapshot } from './types';

export function createSampleData(): AppData {
  const snapshots: AssetSnapshot[] = [
    recalculateSnapshot({
      id: crypto.randomUUID(),
      date: '2026-03-01',
      exchangeRates: { ...defaultExchangeRates },
      excelTotal: 158000,
      computedTotalCny: 0,
      entries: [
        entry('基金账户A', '基金', 52000, 0.329),
        entry('现金账户A', '现金', 12000, 0.076),
        entry('现金账户B', '现金', 6000, 0.038),
        entry('基金账户B', '基金', 18000, 0.114),
        entry('证券', '证券', 35000, 0.222),
        entry('证券账户B', '证券', 14000, 0.089),
        entry('银行卡D', '银行卡', 15000, 0.095),
        entry('杂', '杂项', 6000, 0.038),
      ],
    }),
    recalculateSnapshot({
      id: crypto.randomUUID(),
      date: '2026-04-01',
      exchangeRates: { ...defaultExchangeRates },
      excelTotal: 166500,
      computedTotalCny: 0,
      entries: [
        entry('基金账户A', '基金', 56000, 0.336),
        entry('现金账户A', '现金', 11000, 0.066),
        entry('现金账户B', '现金', 5000, 0.03),
        entry('基金账户B', '基金', 20000, 0.12),
        entry('证券', '证券', 39000, 0.234),
        entry('证券账户B', '证券', 16000, 0.096),
        entry('银行卡D', '银行卡', 14000, 0.084),
        entry('杂', '杂项', 5500, 0.033),
      ],
    }),
    recalculateSnapshot({
      id: crypto.randomUUID(),
      date: '2026-05-01',
      exchangeRates: { ...defaultExchangeRates },
      excelTotal: 172000,
      computedTotalCny: 0,
      entries: [
        entry('基金账户A', '基金', 59000, 0.343),
        entry('现金账户A', '现金', 10000, 0.058),
        entry('现金账户B', '现金', 4500, 0.026),
        entry('基金账户B', '基金', 21500, 0.125),
        entry('证券', '证券', 42000, 0.244),
        entry('证券账户B', '证券', 17500, 0.102),
        entry('银行卡D', '银行卡', 12500, 0.073),
        entry('杂', '杂项', 5000, 0.029),
      ],
    }),
  ];
  const data = createEmptyAppData();
  return { ...data, snapshots, accounts: mergeAccounts([], snapshots) };
}

function entry(accountName: string, category: '基金' | '现金' | '证券' | '银行卡' | '杂项', amount: number, excelRatio: number) {
  return {
    accountId: accountName,
    accountName,
    category,
    originalAmount: amount,
    currency: 'CNY',
    exchangeRate: 1,
    amountCny: amount,
    excelRatio,
    computedRatio: null,
    ratioDiff: null,
    includedInTotal: true,
  };
}
