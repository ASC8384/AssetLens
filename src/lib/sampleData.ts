import { mergeAccounts, recalculateSnapshot } from './calculations';
import { createEmptyAppData, defaultExchangeRates } from './defaults';
import type { AccountVenue, AppData, AssetCategory, AssetSnapshot } from './types';

export function createSampleData(): AppData {
  const snapshots: AssetSnapshot[] = [
    recalculateSnapshot({
      id: crypto.randomUUID(),
      date: '2026-03-01',
      exchangeRates: { ...defaultExchangeRates },
      excelTotal: 160000,
      computedTotalCny: 0,
      entries: [
        entry('场外基金A', '权益类', '场外', 52000, 0.329),
        entry('活期账户A', '纯现金', '银行', 12000, 0.076),
        entry('货币基金A', '纯现金', '场外', 6000, 0.038),
        entry('债基账户A', '稳健类', '场外', 18000, 0.114),
        entry('券商账户A', '权益类', '场内', 35000, 0.222),
        entry('券商账户B', '权益类', '场内', 14000, 0.089),
        entry('银行理财A', '稳健类', '银行', 15000, 0.095),
        entry('信用卡A', '负债', '银行', 2000, 0.012),
        entry('黄金A', '其他资产', '其他', 6000, 0.038),
      ],
    }),
    recalculateSnapshot({
      id: crypto.randomUUID(),
      date: '2026-04-01',
      exchangeRates: { ...defaultExchangeRates },
      excelTotal: 169000,
      computedTotalCny: 0,
      entries: [
        entry('场外基金A', '权益类', '场外', 56000, 0.336),
        entry('活期账户A', '纯现金', '银行', 11000, 0.066),
        entry('货币基金A', '纯现金', '场外', 5000, 0.03),
        entry('债基账户A', '稳健类', '场外', 20000, 0.12),
        entry('券商账户A', '权益类', '场内', 39000, 0.234),
        entry('券商账户B', '权益类', '场内', 16000, 0.096),
        entry('银行理财A', '稳健类', '银行', 14000, 0.084),
        entry('信用卡A', '负债', '银行', 2500, 0.015),
        entry('黄金A', '其他资产', '其他', 5500, 0.033),
      ],
    }),
    recalculateSnapshot({
      id: crypto.randomUUID(),
      date: '2026-05-01',
      exchangeRates: { ...defaultExchangeRates },
      excelTotal: 175000,
      computedTotalCny: 0,
      externalIncome: 12000,
      note: '工资到账',
      entries: [
        entry('场外基金A', '权益类', '场外', 59000, 0.343),
        entry('活期账户A', '纯现金', '银行', 10000, 0.058),
        entry('货币基金A', '纯现金', '场外', 4500, 0.026),
        entry('债基账户A', '稳健类', '场外', 21500, 0.125),
        entry('券商账户A', '权益类', '场内', 42000, 0.244),
        entry('券商账户B', '权益类', '场内', 17500, 0.102),
        entry('银行理财A', '稳健类', '银行', 12500, 0.073),
        entry('信用卡A', '负债', '银行', 3000, 0.017),
        entry('黄金A', '其他资产', '其他', 5000, 0.029),
      ],
    }),
  ];
  const data = createEmptyAppData();
  return { ...data, snapshots, accounts: mergeAccounts([], snapshots) };
}

function entry(accountName: string, category: AssetCategory, venue: AccountVenue, amount: number, excelRatio: number) {
  return {
    accountId: accountName,
    accountName,
    category,
    venue,
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
