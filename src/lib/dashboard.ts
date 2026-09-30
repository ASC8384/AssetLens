import { categoryTotals, isLiabilityCategory, riskAssetTotal, snapshotBookTotal, stablePoolTotal } from './calculations';
import { categories, isUnclassifiedCategory } from './defaults';
import { formatPercent } from './format';
import { intervalExternalIncome, resolveExternalIncome } from './income';
import { snapshotIntervalRows, type DailyNetChangeRow } from './intervals';
import type { AccountConfig, AppData, AssetCategory, AssetSnapshot, ConsolePanelId } from './types';

export type TotalQuality = {
  status: 'ok' | 'warning' | 'danger' | 'missing';
  diff: number | null;
  diffRatio: number | null;
  message: string;
};

export function totalQuality(snapshot: AssetSnapshot | undefined): TotalQuality {
  if (!snapshot || snapshot.excelTotal === undefined) {
    return { status: 'missing', diff: null, diffRatio: null, message: '没有 Excel 原合计可对照。' };
  }
  // 表格里的合计列有两种常见口径：已扣负债的净资产，或各账户金额直接相加。
  // 取更接近的一种作对照，否则只要存在负债账户就会把正常数据判成异常。
  const excelTotal = snapshot.excelTotal;
  const comparable = [snapshot.computedTotalCny, snapshotBookTotal(snapshot)]
    .reduce((closest, value) => Math.abs(value - excelTotal) < Math.abs(closest - excelTotal) ? value : closest);
  const diff = comparable - excelTotal;
  const diffRatio = comparable === 0 ? null : diff / comparable;
  const absRatio = Math.abs(diffRatio ?? 0);
  if (absRatio >= 0.05) return { status: 'danger', diff, diffRatio, message: 'Excel 原合计和网页重算合计差异很大，请检查合计列是否识别正确。' };
  if (absRatio >= 0.01) return { status: 'warning', diff, diffRatio, message: 'Excel 原合计和网页重算合计存在差异。' };
  return { status: 'ok', diff, diffRatio, message: 'Excel 原合计和网页重算合计基本一致。' };
}

export type DataHealthStatus = 'empty' | 'single' | 'attention' | 'ok';

export type DataHealthAction = {
  label: string;
  tab?: AppData['preferences']['activeTab'];
  panel?: ConsolePanelId;
};

export type DataHealthAnalysis = {
  status: DataHealthStatus;
  title: string;
  message: string;
  latestDate: string | null;
  daysSinceLatest: number | null;
  snapshotCount: number;
  accountCount: number;
  totalQualityStatus: TotalQuality['status'];
  hasTotalIssue: boolean;
  hasNonCnyAssets: boolean;
  hasMissingExchangeRates: boolean;
  unclassifiedAccountCount: number;
  action: DataHealthAction;
};

export function analyzeDataHealth(data: AppData, today = new Date()): DataHealthAnalysis {
  const latest = data.snapshots[data.snapshots.length - 1];
  const quality = totalQuality(latest);
  const hasNonCnyAssets = data.snapshots.some((snapshot) => snapshot.entries.some((entry) => entry.currency !== 'CNY'));
  const hasMissingExchangeRates = data.snapshots.some((snapshot) => snapshot.entries.some((entry) => entry.currency !== 'CNY' && (entry.exchangeRate === null || snapshot.exchangeRates[entry.currency] === undefined)));
  const latestTime = latest ? new Date(`${latest.date}T00:00:00`).getTime() : NaN;
  const daysSinceLatest = latest && Number.isFinite(latestTime) ? Math.max(0, Math.floor((today.getTime() - latestTime) / 86400000)) : null;
  const hasTotalIssue = quality.status === 'danger' || quality.status === 'warning';
  const unclassified = unclassifiedSummary(latest, data.accounts);
  const base = {
    latestDate: latest?.date ?? null,
    daysSinceLatest,
    snapshotCount: data.snapshots.length,
    accountCount: data.accounts.length,
    totalQualityStatus: quality.status,
    hasTotalIssue,
    hasNonCnyAssets,
    hasMissingExchangeRates,
    unclassifiedAccountCount: unclassified.accountCount,
  };

  if (!latest) {
    return {
      ...base,
      status: 'empty',
      title: '还没有数据',
      message: '还没有数据：先导入 Excel 或载入示例数据。',
      hasTotalIssue: false,
      action: { label: '展开导入区开始导入', panel: 'import' },
    };
  }

  if (hasTotalIssue || hasMissingExchangeRates) {
    return {
      ...base,
      status: 'attention',
      title: '数据需要检查',
      message: hasTotalIssue ? '发现合计差异，建议前往明细表检查异常。' : '发现非 CNY 资产汇率缺失，建议前往明细表检查。',
      action: { label: '去明细表检查', tab: 'details' },
    };
  }

  // 未分类不算数据错误，但会让大类结构、风险占比和策略建议全部失真，所以同样要拦一下。
  if (unclassified.accountCount > 0) {
    return {
      ...base,
      status: 'attention',
      title: '有账户还没归类',
      message: `${unclassified.accountCount} 个账户仍是「未分类」，占总资产 ${formatPercent(unclassified.ratio)}，大类结构和风险占比会失真。`,
      action: { label: '在「账户与汇率配置」里批量归类', panel: 'config' },
    };
  }

  if (data.snapshots.length === 1) {
    return {
      ...base,
      status: 'single',
      title: '已有一期快照',
      message: '已有数据但只有一期：再导入一期后即可查看趋势。',
      action: { label: '继续导入下一期', panel: 'import' },
    };
  }

  return {
    ...base,
    status: 'ok',
    title: '数据正常',
    message: '数据正常：可以查看仪表盘，或生成本月复盘。',
    action: { label: '生成复盘', tab: 'report' },
  };
}

export type SelectedSnapshotContext = {
  selected: AssetSnapshot | undefined;
  previous: AssetSnapshot | undefined;
  selectedIndex: number;
};

export function selectedSnapshotContext(snapshots: AssetSnapshot[], selectedSnapshotId: string): SelectedSnapshotContext {
  if (snapshots.length === 0) return { selected: undefined, previous: undefined, selectedIndex: -1 };
  const foundIndex = selectedSnapshotId ? snapshots.findIndex((snapshot) => snapshot.id === selectedSnapshotId) : -1;
  const selectedIndex = foundIndex === -1 ? snapshots.length - 1 : foundIndex;
  return {
    selected: snapshots[selectedIndex],
    previous: selectedIndex > 0 ? snapshots[selectedIndex - 1] : undefined,
    selectedIndex,
  };
}

export type AccountInsightSummary = {
  topIncreases: Array<{ accountName: string; change: number }>;
  topDecreases: Array<{ accountName: string; change: number }>;
  newAccounts: string[];
  removedAccounts: string[];
  concentrationRatio: number | null;
};

export function accountInsightSummary(previous: AssetSnapshot | undefined, selected: AssetSnapshot, accounts: AccountConfig[] = []): AccountInsightSummary {
  const previousEntries = new Map(previous?.entries.map((entry) => [entry.accountId, entry]) ?? []);
  const selectedEntries = new Map(selected.entries.map((entry) => [entry.accountId, entry]));
  const hiddenIds = hiddenAccountIds(accounts);
  const visibleAssets = selected.entries.filter((entry) => entry.includedInTotal && !hiddenIds.has(entry.accountId) && !isLiabilityCategory(entry.category));
  const currentTotal = visibleAssets.reduce((sum, entry) => sum + (entry.amountCny ?? 0), 0);
  const changes = accountChangeRows(previous, selected, accounts).map((row) => ({ accountName: row.accountName, change: row.impact }));
  const selectedAmounts = visibleAssets
    .filter((entry) => entry.amountCny !== null)
    .map((entry) => entry.amountCny ?? 0)
    .sort((a, b) => b - a);
  const topThree = selectedAmounts.slice(0, 3).reduce((sum, value) => sum + value, 0);
  return {
    topIncreases: changes.filter((row) => row.change > 0).sort((a, b) => b.change - a.change).slice(0, 5),
    topDecreases: changes.filter((row) => row.change < 0).sort((a, b) => a.change - b.change).slice(0, 5),
    newAccounts: selected.entries.filter((entry) => !previousEntries.has(entry.accountId)).map((entry) => entry.accountName),
    removedAccounts: [...previousEntries.values()].filter((entry) => !selectedEntries.has(entry.accountId)).map((entry) => entry.accountName),
    concentrationRatio: currentTotal === 0 ? null : topThree / currentTotal,
  };
}

export type UnclassifiedSummary = {
  accountCount: number;
  amount: number;
  ratio: number | null;
  accountNames: string[];
};

/**
 * 未分类账户会同时让饼图、风险占比和策略建议失真，所以要显式报出来，
 * 而不是默默算进某个大类里让人误以为数据是对的。
 */
export function unclassifiedSummary(snapshot: AssetSnapshot | undefined, accounts: AccountConfig[]): UnclassifiedSummary {
  if (!snapshot) return { accountCount: 0, amount: 0, ratio: null, accountNames: [] };
  const accountMap = new Map(accounts.map((account) => [account.id, account]));
  const rows = snapshot.entries.filter((entry) => {
    if (accountMap.get(entry.accountId)?.hidden) return false;
    return entry.includedInTotal && isUnclassifiedCategory(entry.category);
  });
  const amount = rows.reduce((sum, entry) => sum + (entry.amountCny ?? 0), 0);
  const grossAssets = snapshot.computedGrossAssetsCny;
  return {
    accountCount: rows.length,
    amount,
    ratio: grossAssets === 0 ? null : amount / grossAssets,
    accountNames: rows.map((entry) => entry.accountName),
  };
}

export type DashboardSummary = {
  leaderCategory: AssetCategory | null;
  leaderAmount: number;
  riskAssetRatio: number | null;
  grossAssets: number;
  liabilityAmount: number;
  netWorth: number;
  externalIncome: number | null;
};

export function dashboardSummary(data: AppData): DashboardSummary {
  const latest = data.snapshots[data.snapshots.length - 1];
  if (!latest) return { leaderCategory: null, leaderAmount: 0, riskAssetRatio: null, grossAssets: 0, liabilityAmount: 0, netWorth: 0, externalIncome: null };
  const totals = categoryTotals(latest, data.accounts);
  const leader = categories
    .filter((category) => !isLiabilityCategory(category))
    .map((category) => ({ category, amount: totals[category] }))
    .sort((a, b) => b.amount - a.amount)[0];
  const riskAmount = riskAssetTotal(totals);
  const grossAssets = latest.computedGrossAssetsCny;
  return {
    leaderCategory: leader?.category ?? null,
    leaderAmount: leader?.amount ?? 0,
    riskAssetRatio: grossAssets === 0 ? null : riskAmount / grossAssets,
    grossAssets,
    liabilityAmount: latest.computedLiabilityCny,
    netWorth: latest.computedTotalCny,
    externalIncome: resolveExternalIncome(data.snapshots, latest).amount,
  };
}

export type PeriodCashflow = {
  netChange: number | null;
  externalIncome: number | null;
  externalIncomeRecorded: boolean;
  afterIncomeChange: number | null;
};

export function periodCashflow(previous: AssetSnapshot | undefined, selected: AssetSnapshot, snapshots: AssetSnapshot[] = []): PeriodCashflow {
  const netChange = previous ? selected.computedTotalCny - previous.computedTotalCny : null;
  const income = intervalExternalIncome(snapshots.length > 0 ? snapshots : [selected], selected);
  return {
    netChange,
    externalIncome: income.amount,
    externalIncomeRecorded: income.recorded,
    afterIncomeChange: netChange === null || income.amount === null ? null : netChange - income.amount,
  };
}

export function categoryTrendData(data: AppData): Array<Record<string, number | string>> {
  return data.snapshots.map((snapshot) => ({
    id: snapshot.id,
    date: snapshot.date,
    total: snapshot.computedTotalCny,
    ...categoryTotals(snapshot, data.accounts),
  }));
}

export function accountRankingRows(snapshot: AssetSnapshot, accounts: AccountConfig[] = []): Array<{ accountName: string; category: AssetCategory; amount: number }> {
  const hiddenIds = hiddenAccountIds(accounts);
  return snapshot.entries
    .filter((entry) => entry.includedInTotal && entry.amountCny !== null && !hiddenIds.has(entry.accountId))
    .map((entry) => ({ accountName: entry.accountName, category: entry.category, amount: entry.amountCny ?? 0 }))
    .sort((a, b) => b.amount - a.amount);
}

export type AccountChangeRow = {
  accountId: string;
  accountName: string;
  category: AssetCategory;
  /** 账户余额本身的变化。 */
  change: number;
  /** 对净资产的影响：负债余额增加会拉低净资产，所以和 change 反号。 */
  impact: number;
};

/** 按对净资产影响的绝对值排序；上一期有、这一期消失的账户按清零计入。 */
export function accountChangeRows(previous: AssetSnapshot | undefined, selected: AssetSnapshot, accounts: AccountConfig[] = []): AccountChangeRow[] {
  const hiddenIds = hiddenAccountIds(accounts);
  const countedEntries = (snapshot: AssetSnapshot | undefined) => new Map((snapshot?.entries ?? [])
    .filter((entry) => entry.includedInTotal && !hiddenIds.has(entry.accountId))
    .map((entry) => [entry.accountId, entry]));
  const before = countedEntries(previous);
  const after = countedEntries(selected);
  const accountIds = new Set([...after.keys(), ...before.keys()]);
  return [...accountIds]
    .map((accountId) => {
      const current = after.get(accountId);
      const prior = before.get(accountId);
      const entry = current ?? prior!;
      const change = (current?.amountCny ?? 0) - (prior?.amountCny ?? 0);
      return { accountId, accountName: entry.accountName, category: entry.category, change, impact: isLiabilityCategory(entry.category) ? -change : change };
    })
    .filter((row) => row.change !== 0)
    .sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact));
}

export function riskTrendData(data: AppData): Array<{ id: string; date: string; risk: number; safe: number }> {
  return data.snapshots.map((snapshot) => {
    const totals = categoryTotals(snapshot, data.accounts);
    return {
      id: snapshot.id,
      date: snapshot.date,
      risk: riskAssetTotal(totals),
      safe: stablePoolTotal(totals),
    };
  });
}

export type { DailyNetChangeRow };

export function dailyNetChangeRows(data: AppData): DailyNetChangeRow[] {
  return snapshotIntervalRows(data.snapshots);
}

export function categoryChangeRows(previous: AssetSnapshot | undefined, selected: AssetSnapshot, accounts: AccountConfig[] = []): Array<{ category: AssetCategory; change: number }> {
  const previousTotals = categoryTotals(previous, accounts);
  const selectedTotals = categoryTotals(selected, accounts);
  return categories.map((category) => ({
    category,
    change: selectedTotals[category] - previousTotals[category],
  }));
}

export function hasImportedData(data: AppData): boolean {
  return data.snapshots.length > 0;
}

function hiddenAccountIds(accounts: AccountConfig[]): Set<string> {
  return new Set(accounts.filter((account) => account.hidden).map((account) => account.id));
}
