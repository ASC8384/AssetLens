import type { AccountConfig, AccountEntry, AccountVenue, AppData, AssetCategory, AssetSnapshot } from './types';
import { accountIdFromName, categories, createAccountConfig, venues } from './defaults';

type SnapshotInput = Omit<AssetSnapshot, 'computedGrossAssetsCny' | 'computedLiabilityCny' | 'computedTotalCny'> & {
  computedTotalCny?: number;
  computedGrossAssetsCny?: number;
  computedLiabilityCny?: number;
};

export function isLiabilityCategory(category: AssetCategory): boolean {
  return category === '负债';
}

/** 风险资产只算权益类：稳健类虽有净值波动，但量级和股票不是一回事。 */
export function riskAssetTotal(totals: Record<AssetCategory, number>): number {
  return totals['权益类'];
}

/** 稳健池 = 纯现金 + 稳健类，用于应急备用金判断。 */
export function stablePoolTotal(totals: Record<AssetCategory, number>): number {
  return totals['纯现金'] + totals['稳健类'];
}

export function snapshotBookTotal(snapshot: Pick<AssetSnapshot, 'computedGrossAssetsCny' | 'computedLiabilityCny'>): number {
  return snapshot.computedGrossAssetsCny + snapshot.computedLiabilityCny;
}

export function recalculateSnapshot(snapshot: SnapshotInput): AssetSnapshot {
  const entriesWithCny = snapshot.entries.map((entry) => {
    const exchangeRate = entry.currency === 'CNY' ? 1 : snapshot.exchangeRates[entry.currency] ?? entry.exchangeRate;
    const amountCny = entry.originalAmount === null || exchangeRate === null || exchangeRate === undefined
      ? null
      : entry.originalAmount * exchangeRate;
    return { ...entry, exchangeRate: exchangeRate ?? null, amountCny };
  });

  let computedGrossAssetsCny = 0;
  let computedLiabilityCny = 0;
  for (const entry of entriesWithCny) {
    if (!entry.includedInTotal || entry.amountCny === null) continue;
    if (isLiabilityCategory(entry.category)) computedLiabilityCny += entry.amountCny;
    else computedGrossAssetsCny += entry.amountCny;
  }
  const bookTotal = computedGrossAssetsCny + computedLiabilityCny;
  const computedTotalCny = computedGrossAssetsCny - computedLiabilityCny;

  const entries = entriesWithCny.map((entry) => {
    const computedRatio = entry.includedInTotal && entry.amountCny !== null && bookTotal > 0
      ? entry.amountCny / bookTotal
      : null;
    const ratioDiff = computedRatio !== null && entry.excelRatio !== null && entry.excelRatio !== undefined
      ? computedRatio - entry.excelRatio
      : null;
    return { ...entry, computedRatio, ratioDiff };
  });

  return { ...snapshot, entries, computedTotalCny, computedGrossAssetsCny, computedLiabilityCny };
}

export function recalculateData(data: AppData): AppData {
  return { ...data, snapshots: sortSnapshots(data.snapshots.map(recalculateSnapshot)) };
}

export function sortSnapshots(snapshots: AssetSnapshot[]): AssetSnapshot[] {
  return [...snapshots].sort((a, b) => a.date.localeCompare(b.date));
}

export function mergeAccounts(existing: AccountConfig[], snapshots: AssetSnapshot[]): AccountConfig[] {
  const byId = new Map(existing.map((account) => [account.id, account]));
  for (const snapshot of snapshots) {
    for (const entry of snapshot.entries) {
      if (!byId.has(entry.accountId)) {
        byId.set(entry.accountId, {
          id: entry.accountId,
          name: entry.accountName,
          category: entry.category,
          venue: entry.venue,
          defaultCurrency: entry.currency,
          includedInTotal: entry.includedInTotal,
          hidden: false,
        });
      }
    }
  }
  return [...byId.values()];
}

export function categoryTotals(snapshot: AssetSnapshot | undefined, accounts: AccountConfig[]): Record<AssetCategory, number> {
  const totals = Object.fromEntries(categories.map((category) => [category, 0])) as Record<AssetCategory, number>;
  if (!snapshot) return totals;
  const accountMap = new Map(accounts.map((account) => [account.id, account]));
  for (const entry of snapshot.entries) {
    const account = accountMap.get(entry.accountId);
    if (account?.hidden || !entry.includedInTotal || entry.amountCny === null) continue;
    totals[entry.category] += entry.amountCny;
  }
  return totals;
}

/**
 * 参与结构分析（大类、渠道、各种占比）的资产合计。
 * 隐藏但计入净资产的账户只算进净资产总数，所以占比的分母也要把它剔掉，否则百分比加起来不到 100%。
 */
export function analysisAssetTotal(snapshot: AssetSnapshot | undefined, accounts: AccountConfig[]): number {
  const totals = categoryTotals(snapshot, accounts);
  return categories.filter((category) => !isLiabilityCategory(category)).reduce((sum, category) => sum + totals[category], 0);
}

/** 隐藏但仍计入净资产的账户：金额进净资产总数，但不参与结构分析、不按名字出现。 */
export function hiddenCountedSummary(snapshot: AssetSnapshot | undefined, accounts: AccountConfig[]): { accountCount: number; netAmount: number } {
  const hiddenIds = new Set(accounts.filter((account) => account.hidden).map((account) => account.id));
  const entries = (snapshot?.entries ?? []).filter((entry) => hiddenIds.has(entry.accountId) && entry.includedInTotal && entry.amountCny !== null);
  return {
    accountCount: entries.length,
    netAmount: entries.reduce((sum, entry) => sum + (isLiabilityCategory(entry.category) ? -1 : 1) * (entry.amountCny ?? 0), 0),
  };
}

/** 渠道视图只看资产，负债按渠道分组没有意义。 */
export function venueTotals(snapshot: AssetSnapshot | undefined, accounts: AccountConfig[]): Record<AccountVenue, number> {
  const totals = Object.fromEntries(venues.map((venue) => [venue, 0])) as Record<AccountVenue, number>;
  if (!snapshot) return totals;
  const accountMap = new Map(accounts.map((account) => [account.id, account]));
  for (const entry of snapshot.entries) {
    const account = accountMap.get(entry.accountId);
    if (account?.hidden || !entry.includedInTotal || entry.amountCny === null) continue;
    if (isLiabilityCategory(entry.category)) continue;
    const venue = account?.venue ?? entry.venue;
    totals[venues.includes(venue) ? venue : '其他'] += entry.amountCny;
  }
  return totals;
}

export function totalChange(snapshots: AssetSnapshot[]): { amount: number | null; percent: number | null } {
  if (snapshots.length < 2) return { amount: null, percent: null };
  const current = snapshots[snapshots.length - 1].computedTotalCny;
  const previous = snapshots[snapshots.length - 2].computedTotalCny;
  const amount = current - previous;
  return { amount, percent: previous === 0 ? null : amount / previous };
}

export function accountChanges(snapshots: AssetSnapshot[]): Array<{ accountName: string; change: number }> {
  if (snapshots.length < 2) return [];
  const previous = snapshots[snapshots.length - 2];
  const current = snapshots[snapshots.length - 1];
  const previousAmounts = new Map(previous.entries.map((entry) => [entry.accountId, entry.amountCny ?? 0]));
  return current.entries
    .map((entry) => ({
      accountName: entry.accountName,
      change: (entry.amountCny ?? 0) - (previousAmounts.get(entry.accountId) ?? 0),
    }))
    .sort((a, b) => Math.abs(b.change) - Math.abs(a.change))
    .slice(0, 5);
}

export function ratioAlerts(snapshot: AssetSnapshot | undefined): AccountEntry[] {
  if (!snapshot) return [];
  return snapshot.entries
    .filter((entry) => entry.ratioDiff !== null && entry.ratioDiff !== undefined && Math.abs(entry.ratioDiff) >= 0.002)
    .sort((a, b) => Math.abs(b.ratioDiff ?? 0) - Math.abs(a.ratioDiff ?? 0));
}

export function applyAccountsToSnapshots(snapshots: AssetSnapshot[], accounts: AccountConfig[]): AssetSnapshot[] {
  const accountMap = new Map(accounts.map((account) => [account.id, account]));
  return snapshots.map((snapshot) => recalculateSnapshot({
    ...snapshot,
    entries: snapshot.entries.map((entry) => {
      const account = accountMap.get(entry.accountId);
      if (!account) return entry;
      return {
        ...entry,
        accountName: account.name,
        category: account.category,
        venue: account.venue,
        currency: account.defaultCurrency,
        includedInTotal: account.includedInTotal,
      };
    }),
  }));
}

export function applyExchangeRateToSnapshots(snapshots: AssetSnapshot[], currency: string, rate: number): AssetSnapshot[] {
  return snapshots.map((snapshot) => recalculateSnapshot({
    ...snapshot,
    exchangeRates: { ...snapshot.exchangeRates, [currency]: rate },
  }));
}

export function buildEntry(accountName: string, amount: number | null, excelRatio: number | null, account?: AccountConfig): AccountEntry {
  const config = account ?? createAccountConfig(accountName);
  return {
    accountId: config.id || accountIdFromName(accountName),
    accountName: config.name || accountName,
    category: config.category,
    venue: config.venue,
    originalAmount: amount,
    currency: config.defaultCurrency,
    exchangeRate: config.defaultCurrency === 'CNY' ? 1 : null,
    amountCny: null,
    excelRatio,
    computedRatio: null,
    ratioDiff: null,
    includedInTotal: config.includedInTotal,
  };
}
