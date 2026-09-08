import { recalculateSnapshot } from './calculations';
import type { AppData, AssetSnapshot } from './types';

/** Frankfurter：欧洲央行公开数据，免费、无需 token、可查 1999 年至今的历史汇率。 */
const frankfurterBase = 'https://api.frankfurter.dev/v1';

export type RateSeries = Record<string, Record<string, number>>;

export type HistoricalRateOutcome = {
  data: AppData;
  appliedCount: number;
  missingDates: string[];
  currencies: string[];
};

const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;

export function collectForeignCurrencies(data: AppData): string[] {
  const currencies = new Set<string>();
  for (const account of data.accounts) currencies.add(account.defaultCurrency);
  for (const snapshot of data.snapshots) {
    for (const entry of snapshot.entries) currencies.add(entry.currency);
  }
  return [...currencies].filter((currency) => currency && currency !== 'CNY').sort();
}

export async function fetchRateSeries(
  currencies: string[],
  startDate: string,
  endDate: string,
  fetchImpl: typeof fetch = fetch,
): Promise<RateSeries> {
  if (currencies.length === 0) return {};
  const url = `${frankfurterBase}/${startDate}..${endDate}?base=CNY&symbols=${currencies.join(',')}`;
  const response = await fetchImpl(url);
  if (!response.ok) throw new Error(`汇率接口返回 ${response.status}`);
  const payload = (await response.json()) as { rates?: RateSeries };
  return payload.rates ?? {};
}

/**
 * 汇率接口只有交易日数据，快照日期落在周末或节假日时回退到之前最近的交易日。
 * 接口以 CNY 为基准返回「1 CNY = x 外币」，本应用需要的是外币折人民币，所以取倒数。
 */
export function ratesForDate(series: RateSeries, date: string): Record<string, number> | null {
  const availableDates = Object.keys(series).sort();
  let picked: string | null = null;
  for (const available of availableDates) {
    if (available > date) break;
    picked = available;
  }
  if (picked === null) return null;
  const converted: Record<string, number> = {};
  for (const [currency, perCny] of Object.entries(series[picked])) {
    if (perCny > 0) converted[currency] = 1 / perCny;
  }
  return converted;
}

export function applyRateSeries(snapshots: AssetSnapshot[], series: RateSeries): { snapshots: AssetSnapshot[]; appliedCount: number; missingDates: string[] } {
  const missingDates: string[] = [];
  let appliedCount = 0;
  const updated = snapshots.map((snapshot) => {
    const rates = isoDatePattern.test(snapshot.date) ? ratesForDate(series, snapshot.date) : null;
    if (!rates) {
      missingDates.push(snapshot.date);
      return snapshot;
    }
    appliedCount += 1;
    return recalculateSnapshot({
      ...snapshot,
      exchangeRates: { ...snapshot.exchangeRates, ...rates, CNY: 1 },
    });
  });
  return { snapshots: updated, appliedCount, missingDates };
}

export async function applyHistoricalRates(data: AppData, fetchImpl: typeof fetch = fetch): Promise<HistoricalRateOutcome> {
  const currencies = collectForeignCurrencies(data);
  if (currencies.length === 0) {
    return { data, appliedCount: 0, missingDates: [], currencies };
  }
  const validDates = data.snapshots.map((snapshot) => snapshot.date).filter((date) => isoDatePattern.test(date)).sort();
  if (validDates.length === 0) {
    return { data, appliedCount: 0, missingDates: data.snapshots.map((snapshot) => snapshot.date), currencies };
  }
  const series = await fetchRateSeries(currencies, validDates[0], validDates[validDates.length - 1], fetchImpl);
  const { snapshots, appliedCount, missingDates } = applyRateSeries(data.snapshots, series);
  const latestRates = ratesForDate(series, validDates[validDates.length - 1]);
  return {
    data: {
      ...data,
      defaultExchangeRates: latestRates ? { ...data.defaultExchangeRates, ...latestRates, CNY: 1 } : data.defaultExchangeRates,
      snapshots,
    },
    appliedCount,
    missingDates,
    currencies,
  };
}
