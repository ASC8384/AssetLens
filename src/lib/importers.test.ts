import { describe, expect, it } from 'vitest';
import { buildEntry, recalculateSnapshot } from './calculations';
import { createAccountConfig, createEmptyAppData } from './defaults';
import * as importers from './importers';
import type { AccountConfig, AppData, AssetSnapshot } from './types';

type BuildManualSnapshot = (
  data: AppData,
  date: string,
  amountByAccountId: Record<string, string | undefined>,
) => AssetSnapshot;

const buildManualSnapshot = (importers as typeof importers & {
  buildManualSnapshot?: BuildManualSnapshot;
}).buildManualSnapshot;

function createAccount(id: string, name: string, currency: string): AccountConfig {
  return {
    ...createAccountConfig(name),
    id,
    defaultCurrency: currency,
  };
}

function createSnapshot(
  date: string,
  exchangeRates: Record<string, number>,
  entries: Array<{ account: AccountConfig; amount: number | null }>,
): AssetSnapshot {
  return recalculateSnapshot({
    id: date,
    date,
    exchangeRates,
    computedTotalCny: 0,
    entries: entries.map(({ account, amount }) => buildEntry(account.name, amount, null, account)),
  });
}

describe('buildManualSnapshot', () => {
  it('reuses latest snapshot exchange rates, parses amounts, and turns blank values into null', () => {
    const usdAccount = createAccount('usd-cash', '美元现金', 'USD');
    const cnyAccount = createAccount('cny-cash', '人民币现金', 'CNY');
    const data: AppData = {
      ...createEmptyAppData(),
      accounts: [usdAccount, cnyAccount],
      defaultExchangeRates: { CNY: 1, USD: 7.1 },
      snapshots: [
        createSnapshot('2026-04-01', { CNY: 1, USD: 7.53 }, [
          { account: usdAccount, amount: 10 },
          { account: cnyAccount, amount: 200 },
        ]),
      ],
    };

    expect(buildManualSnapshot).toBeTypeOf('function');
    const snapshot = buildManualSnapshot!(data, '2026-05-01', {
      'usd-cash': '123.45',
      'cny-cash': '',
    });

    expect(snapshot.exchangeRates).toEqual({ CNY: 1, USD: 7.53 });
    expect(snapshot.entries).toHaveLength(2);
    expect(snapshot.entries[0]).toMatchObject({
      accountId: 'usd-cash',
      accountName: '美元现金',
      currency: 'USD',
      originalAmount: 123.45,
      exchangeRate: 7.53,
    });
    expect(snapshot.entries[0].amountCny).toBeCloseTo(929.5785);
    expect(snapshot.entries[1]).toMatchObject({
      accountId: 'cny-cash',
      accountName: '人民币现金',
      currency: 'CNY',
      originalAmount: null,
      exchangeRate: 1,
      amountCny: null,
    });
  });

  it('falls back to default exchange rates when there is no history snapshot', () => {
    const usdAccount = createAccount('usd-brokerage', '美元券商', 'USD');
    const data: AppData = {
      ...createEmptyAppData(),
      accounts: [usdAccount],
      defaultExchangeRates: { CNY: 1, USD: 7.24, HKD: 0.93 },
    };

    expect(buildManualSnapshot).toBeTypeOf('function');
    const snapshot = buildManualSnapshot!(data, '2026-05-01', {
      'usd-brokerage': '100',
    });

    expect(snapshot.exchangeRates).toEqual({ CNY: 1, USD: 7.24, HKD: 0.93 });
    expect(snapshot.entries[0]).toMatchObject({
      accountId: 'usd-brokerage',
      currency: 'USD',
      originalAmount: 100,
      exchangeRate: 7.24,
      amountCny: 724,
    });
  });

  it('works with mergeImportedData overwrite mode to replace an existing date', () => {
    const usdAccount = createAccount('usd-cash', '美元现金', 'USD');
    const cnyAccount = createAccount('cny-cash', '人民币现金', 'CNY');
    const existing = createSnapshot('2026-05-01', { CNY: 1, USD: 7.4 }, [
      { account: usdAccount, amount: 10 },
      { account: cnyAccount, amount: 20 },
    ]);
    const data: AppData = {
      ...createEmptyAppData(),
      accounts: [usdAccount, cnyAccount],
      snapshots: [existing],
      defaultExchangeRates: { CNY: 1, USD: 7.1 },
    };

    expect(buildManualSnapshot).toBeTypeOf('function');
    const manual = buildManualSnapshot!(data, '2026-05-01', {
      'usd-cash': '30',
      'cny-cash': '40',
    });
    const merged = importers.mergeImportedData(data, [manual], data.accounts, 'overwrite');

    expect(merged.snapshots).toHaveLength(1);
    expect(merged.snapshots[0].id).toBe(manual.id);
    expect(merged.snapshots[0].date).toBe('2026-05-01');
    expect(merged.snapshots[0].entries).toEqual(expect.arrayContaining([
      expect.objectContaining({ accountId: 'usd-cash', originalAmount: 30, exchangeRate: 7.4 }),
      expect.objectContaining({ accountId: 'cny-cash', originalAmount: 40, exchangeRate: 1 }),
    ]));
  });
});
