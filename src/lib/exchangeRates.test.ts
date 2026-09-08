import { describe, expect, it, vi } from 'vitest';
import { buildEntry, recalculateSnapshot } from './calculations';
import { createAccountConfig, createEmptyAppData } from './defaults';
import { applyHistoricalRates, applyRateSeries, collectForeignCurrencies, fetchRateSeries, ratesForDate } from './exchangeRates';
import type { AppData, AssetSnapshot } from './types';

const usdAccount = { ...createAccountConfig('美元账户A'), defaultCurrency: 'USD' };
const cnyAccount = createAccountConfig('现金账户A');

function snapshot(date: string, usdAmount: number, cnyAmount: number): AssetSnapshot {
  return recalculateSnapshot({
    id: date,
    date,
    exchangeRates: { CNY: 1, USD: 7 },
    computedTotalCny: 0,
    entries: [
      buildEntry(usdAccount.name, usdAmount, null, usdAccount),
      buildEntry(cnyAccount.name, cnyAmount, null, cnyAccount),
    ],
  });
}

function dataWithSnapshots(snapshots: AssetSnapshot[]): AppData {
  return { ...createEmptyAppData(), accounts: [usdAccount, cnyAccount], snapshots };
}

// 接口以 CNY 为基准返回「1 CNY = x 外币」
const series = {
  '2026-05-01': { USD: 0.125 },
  '2026-05-06': { USD: 0.2 },
};

describe('collectForeignCurrencies', () => {
  it('lists non-CNY currencies from accounts and snapshot entries', () => {
    expect(collectForeignCurrencies(dataWithSnapshots([snapshot('2026-05-01', 10, 20)]))).toEqual(['USD']);
  });

  it('returns nothing when every account is in CNY', () => {
    const data: AppData = { ...createEmptyAppData(), accounts: [cnyAccount] };
    expect(collectForeignCurrencies(data)).toEqual([]);
  });
});

describe('ratesForDate', () => {
  it('inverts the CNY-based quote into a foreign-to-CNY rate', () => {
    expect(ratesForDate(series, '2026-05-01')).toEqual({ USD: 8 });
  });

  it('falls back to the closest earlier trading day for weekends and holidays', () => {
    expect(ratesForDate(series, '2026-05-04')).toEqual({ USD: 8 });
    expect(ratesForDate(series, '2026-05-07')).toEqual({ USD: 5 });
  });

  it('returns null when the date precedes all available quotes', () => {
    expect(ratesForDate(series, '2026-04-30')).toBeNull();
  });
});

describe('applyRateSeries', () => {
  it('applies a per-date rate to each snapshot and recalculates CNY amounts', () => {
    const { snapshots, appliedCount, missingDates } = applyRateSeries(
      [snapshot('2026-05-01', 10, 100), snapshot('2026-05-06', 10, 100)],
      series,
    );

    expect(appliedCount).toBe(2);
    expect(missingDates).toEqual([]);
    expect(snapshots[0].exchangeRates.USD).toBe(8);
    expect(snapshots[0].computedTotalCny).toBeCloseTo(10 * 8 + 100);
    expect(snapshots[1].exchangeRates.USD).toBe(5);
    expect(snapshots[1].computedTotalCny).toBeCloseTo(10 * 5 + 100);
  });

  it('skips snapshots whose date is not a real date', () => {
    const { appliedCount, missingDates, snapshots } = applyRateSeries([snapshot('未命名日期 1', 10, 100)], series);

    expect(appliedCount).toBe(0);
    expect(missingDates).toEqual(['未命名日期 1']);
    expect(snapshots[0].exchangeRates.USD).toBe(7);
  });
});

describe('fetchRateSeries', () => {
  it('requests the whole date range in one CNY-based call', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ rates: series }) });

    const result = await fetchRateSeries(['USD', 'HKD'], '2026-05-01', '2026-05-06', fetchImpl as unknown as typeof fetch);

    expect(result).toEqual(series);
    const requestedUrl = String(fetchImpl.mock.calls[0][0]);
    expect(requestedUrl).toContain('2026-05-01..2026-05-06');
    expect(requestedUrl).toContain('base=CNY');
    expect(requestedUrl).toContain('symbols=USD,HKD');
  });

  it('skips the network call when there is no foreign currency', async () => {
    const fetchImpl = vi.fn();

    expect(await fetchRateSeries([], '2026-05-01', '2026-05-06', fetchImpl as unknown as typeof fetch)).toEqual({});
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('reports a failed response', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false, status: 503 });

    await expect(fetchRateSeries(['USD'], '2026-05-01', '2026-05-06', fetchImpl as unknown as typeof fetch)).rejects.toThrow('503');
  });
});

describe('applyHistoricalRates', () => {
  it('updates every snapshot and syncs the default rate to the latest quote', async () => {
    const data = dataWithSnapshots([snapshot('2026-05-01', 10, 100), snapshot('2026-05-06', 10, 100)]);
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ rates: series }) });

    const outcome = await applyHistoricalRates(data, fetchImpl as unknown as typeof fetch);

    expect(outcome.currencies).toEqual(['USD']);
    expect(outcome.appliedCount).toBe(2);
    expect(outcome.data.snapshots[0].exchangeRates.USD).toBe(8);
    expect(outcome.data.snapshots[1].exchangeRates.USD).toBe(5);
    expect(outcome.data.defaultExchangeRates.USD).toBe(5);
  });

  it('does nothing without foreign accounts', async () => {
    const data: AppData = { ...createEmptyAppData(), accounts: [cnyAccount] };
    const fetchImpl = vi.fn();

    const outcome = await applyHistoricalRates(data, fetchImpl as unknown as typeof fetch);

    expect(outcome.appliedCount).toBe(0);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
