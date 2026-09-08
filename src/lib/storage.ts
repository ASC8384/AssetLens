import type { AccountConfig, AccountEntry, AppData, AssetCategory, AssetSnapshot, StrategyConfig } from './types';
import { classifiedAssetCategories, createEmptyAppData, migrateCategory, migrateVenue } from './defaults';
import { recalculateData } from './calculations';

const storageKey = 'asset-lens-data-v1';

export function loadAppData(): AppData {
  const raw = localStorage.getItem(storageKey);
  if (!raw) return createEmptyAppData();
  try {
    return normalizeAppData(JSON.parse(raw));
  } catch {
    return createEmptyAppData();
  }
}

export function saveAppData(data: AppData): void {
  localStorage.setItem(storageKey, JSON.stringify(data));
}

export function normalizeAppData(value: unknown): AppData {
  const empty = createEmptyAppData();
  if (!value || typeof value !== 'object') return empty;
  const candidate = value as Partial<AppData>;
  const preferences = { ...empty.preferences, ...(candidate.preferences ?? {}) };
  return recalculateData({
    version: 1,
    snapshots: Array.isArray(candidate.snapshots) ? candidate.snapshots.map(migrateSnapshot) : [],
    accounts: Array.isArray(candidate.accounts) ? candidate.accounts.map(migrateAccount) : [],
    defaultExchangeRates: { ...empty.defaultExchangeRates, ...(candidate.defaultExchangeRates ?? {}) },
    strategy: migrateStrategy(empty.strategy, candidate.strategy),
    fire: { ...empty.fire, ...(candidate.fire ?? {}) },
    preferences: {
      ...preferences,
      categoryFilter: preferences.categoryFilter === '全部' ? '全部' : migrateCategory(preferences.categoryFilter),
    },
  });
}

function migrateAccount(account: AccountConfig): AccountConfig {
  return {
    ...account,
    category: migrateCategory(account.category),
    venue: migrateVenue(account.venue, account.name),
  };
}

function migrateSnapshot(snapshot: AssetSnapshot): AssetSnapshot {
  return { ...snapshot, entries: snapshot.entries.map(migrateEntry) };
}

function migrateEntry(entry: AccountEntry): AccountEntry {
  return {
    ...entry,
    category: migrateCategory(entry.category),
    venue: migrateVenue(entry.venue, entry.accountName),
  };
}

/**
 * 旧分类有 5 个资产大类，新分类只有 4 个，迁移时多个旧大类会合并到同一个新大类
 * （基金 + 证券 → 权益类，现金 + 银行卡 → 稳健类），所以目标占比要累加而不是覆盖。
 * 「未分类」不设目标，落到它上面的旧占比直接丢弃。
 */
function migrateStrategy(fallback: StrategyConfig, candidate: Partial<StrategyConfig> | undefined): StrategyConfig {
  if (!candidate) return fallback;
  const merged = { ...fallback, ...candidate };
  if (!candidate.targetCategoryRatios) return merged;

  const targetCategoryRatios: Partial<Record<AssetCategory, number>> = {};
  for (const [key, ratio] of Object.entries(candidate.targetCategoryRatios)) {
    if (typeof ratio !== 'number' || !Number.isFinite(ratio)) continue;
    const category = migrateCategory(key);
    if (category === '未分类') continue;
    targetCategoryRatios[category] = (targetCategoryRatios[category] ?? 0) + ratio;
  }
  const hasAssetTarget = classifiedAssetCategories.some((category) => targetCategoryRatios[category] !== undefined);
  return { ...merged, targetCategoryRatios: hasAssetTarget ? targetCategoryRatios : fallback.targetCategoryRatios };
}

export function exportBackup(data: AppData): string {
  return JSON.stringify({ ...data, exportedAt: new Date().toISOString() }, null, 2);
}

export function importBackup(text: string): AppData {
  return normalizeAppData(JSON.parse(text));
}
