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

describe('import date handling', () => {
  it('normalizes slash and non-padded dates to sortable ISO date strings', () => {
    const draft = importers.createImportDraft({
      headers: ['时间', '基金账户'],
      rows: [
        ['2026/5/1', '100'],
        ['2026-10-01', '200'],
      ],
    });

    const result = importers.buildSnapshotsFromDraft(draft, []);

    expect(result.snapshots.map((snapshot) => snapshot.date)).toEqual(['2026-05-01', '2026-10-01']);
  });

  it('keeps duplicate records without corrupting the snapshot date field', () => {
    const account = createAccount('fund', '基金账户', 'CNY');
    const data: AppData = {
      ...createEmptyAppData(),
      accounts: [account],
      snapshots: [createSnapshot('2026-05-01', { CNY: 1 }, [{ account, amount: 100 }])],
    };
    const incoming = createSnapshot('2026-05-01', { CNY: 1 }, [{ account, amount: 200 }]);

    const merged = importers.mergeImportedData(data, [incoming], data.accounts, 'keep');

    expect(merged.snapshots).toHaveLength(2);
    expect(merged.snapshots.map((snapshot) => snapshot.date)).toEqual(['2026-05-01', '2026-05-01']);
  });

  it('overwrites duplicate dates within the same import batch', () => {
    const account = createAccount('fund', '基金账户', 'CNY');
    const first = createSnapshot('2026-05-01', { CNY: 1 }, [{ account, amount: 100 }]);
    const second = createSnapshot('2026-05-01', { CNY: 1 }, [{ account, amount: 200 }]);

    const merged = importers.mergeImportedData(createEmptyAppData(), [first, second], [account], 'overwrite');

    expect(merged.snapshots).toHaveLength(1);
    expect(merged.snapshots[0].entries[0].originalAmount).toBe(200);
  });

  it('skips duplicate dates within the same import batch after the first record', () => {
    const account = createAccount('fund', '基金账户', 'CNY');
    const first = createSnapshot('2026-05-01', { CNY: 1 }, [{ account, amount: 100 }]);
    const second = createSnapshot('2026-05-01', { CNY: 1 }, [{ account, amount: 200 }]);

    const merged = importers.mergeImportedData(createEmptyAppData(), [first, second], [account], 'skip');

    expect(merged.snapshots).toHaveLength(1);
    expect(merged.snapshots[0].entries[0].originalAmount).toBe(100);
  });

  it('overwrites all existing records for the same date', () => {
    const account = createAccount('fund', '基金账户', 'CNY');
    const data: AppData = {
      ...createEmptyAppData(),
      accounts: [account],
      snapshots: [
        createSnapshot('2026-05-01', { CNY: 1 }, [{ account, amount: 100 }]),
        createSnapshot('2026-05-01', { CNY: 1 }, [{ account, amount: 150 }]),
      ],
    };
    const incoming = createSnapshot('2026-05-01', { CNY: 1 }, [{ account, amount: 300 }]);

    const merged = importers.mergeImportedData(data, [incoming], data.accounts, 'overwrite');

    expect(merged.snapshots).toHaveLength(1);
    expect(merged.snapshots[0].entries[0].originalAmount).toBe(300);
  });
});

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

  it('fills missing latest snapshot exchange rates from default exchange rates', () => {
    const eurAccount = createAccount('eur-brokerage', '欧元券商', 'EUR');
    const cnyAccount = createAccount('cny-cash', '人民币现金', 'CNY');
    const data: AppData = {
      ...createEmptyAppData(),
      accounts: [eurAccount],
      defaultExchangeRates: { CNY: 1, EUR: 8 },
      snapshots: [createSnapshot('2026-04-01', { CNY: 1 }, [{ account: cnyAccount, amount: 100 }])],
    };

    const snapshot = buildManualSnapshot!(data, '2026-05-01', {
      'eur-brokerage': '10',
    });

    expect(snapshot.exchangeRates).toEqual({ CNY: 1, EUR: 8 });
    expect(snapshot.entries[0]).toMatchObject({
      accountId: 'eur-brokerage',
      currency: 'EUR',
      originalAmount: 10,
      exchangeRate: 8,
      amountCny: 80,
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

describe('spreadsheet column inference', () => {
  it('does not treat a payroll-like account name as the income column', () => {
    const draft = importers.createImportDraft({
      headers: ['时间', '基金账户A', '占比', '工资卡A', '占比', '美元账户A', '占比', '示例Visa', '占比', '示例普卡', '占比', '合计', '备注', '时长', '变动', '日均', '收入', '结余'],
      rows: [['2026/9/4', '10000', '80%', '200', '1.6%', '$1,000.00', '8%', '500', '4%', '800', '6.4%', '12500', '示例备注', '15', '-200', '-13', '0', '200']],
    });
    const byHeader = Object.fromEntries(draft.mappings.map((mapping) => [mapping.header, mapping]));

    expect(byHeader['工资卡A']).toMatchObject({ role: 'account', category: '杂项' });
    expect(byHeader['美元账户A']).toMatchObject({ role: 'account', currency: 'USD' });
    expect(byHeader['示例Visa']).toMatchObject({ role: 'account', category: '负债' });
    expect(byHeader['示例普卡']).toMatchObject({ role: 'account', category: '负债' });
    expect(byHeader['收入']).toMatchObject({ role: 'income' });
    expect(byHeader['备注']).toMatchObject({ role: 'note' });
    expect(byHeader['结余']).toMatchObject({ role: 'ignore' });
  });
});
