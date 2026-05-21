import { categoryTotals } from './calculations';
import { categories } from './defaults';
import type { AppData, AssetCategory, AssetSnapshot } from './types';

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
  const diff = snapshot.computedTotalCny - snapshot.excelTotal;
  const diffRatio = snapshot.computedTotalCny === 0 ? null : diff / snapshot.computedTotalCny;
  const absRatio = Math.abs(diffRatio ?? 0);
  if (absRatio >= 0.05) return { status: 'danger', diff, diffRatio, message: 'Excel 原合计和网页重算合计差异很大，请检查合计列是否识别正确。' };
  if (absRatio >= 0.01) return { status: 'warning', diff, diffRatio, message: 'Excel 原合计和网页重算合计存在差异。' };
  return { status: 'ok', diff, diffRatio, message: 'Excel 原合计和网页重算合计基本一致。' };
}

export type DataHealthStatus = 'empty' | 'single' | 'attention' | 'ok';

export type DataHealthAction = {
  label: string;
  tab?: AppData['preferences']['activeTab'];
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
  const base = {
    latestDate: latest?.date ?? null,
    daysSinceLatest,
    snapshotCount: data.snapshots.length,
    accountCount: data.accounts.length,
    totalQualityStatus: quality.status,
    hasTotalIssue,
    hasNonCnyAssets,
    hasMissingExchangeRates,
  };

  if (!latest) {
    return {
      ...base,
      status: 'empty',
      title: '还没有数据',
      message: '还没有数据：先导入 Excel 或载入示例数据。',
      hasTotalIssue: false,
      action: { label: '展开导入区开始导入' },
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

  if (data.snapshots.length === 1) {
    return {
      ...base,
      status: 'single',
      title: '已有一期快照',
      message: '已有数据但只有一期：再导入一期后即可查看趋势。',
      action: { label: '继续导入下一期' },
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

export type DashboardSummary = {
  leaderCategory: AssetCategory | null;
  leaderAmount: number;
  riskAssetRatio: number | null;
};

export function dashboardSummary(data: AppData): DashboardSummary {
  const latest = data.snapshots[data.snapshots.length - 1];
  if (!latest) return { leaderCategory: null, leaderAmount: 0, riskAssetRatio: null };
  const totals = categoryTotals(latest, data.accounts);
  const leader = categories
    .map((category) => ({ category, amount: totals[category] }))
    .sort((a, b) => b.amount - a.amount)[0];
  const riskAmount = totals['基金'] + totals['证券'];
  return {
    leaderCategory: leader?.category ?? null,
    leaderAmount: leader?.amount ?? 0,
    riskAssetRatio: latest.computedTotalCny === 0 ? null : riskAmount / latest.computedTotalCny,
  };
}

export function categoryTrendData(data: AppData): Array<Record<string, number | string>> {
  return data.snapshots.map((snapshot) => ({
    date: snapshot.date,
    total: snapshot.computedTotalCny,
    ...categoryTotals(snapshot, data.accounts),
  }));
}

export function accountRankingRows(snapshot: AssetSnapshot): Array<{ accountName: string; amount: number }> {
  return snapshot.entries
    .filter((entry) => entry.includedInTotal && entry.amountCny !== null)
    .map((entry) => ({ accountName: entry.accountName, amount: entry.amountCny ?? 0 }))
    .sort((a, b) => b.amount - a.amount);
}

export function riskTrendData(data: AppData): Array<{ date: string; risk: number; safe: number }> {
  return data.snapshots.map((snapshot) => {
    const totals = categoryTotals(snapshot, data.accounts);
    return {
      date: snapshot.date,
      risk: totals['基金'] + totals['证券'],
      safe: totals['现金'] + totals['银行卡'],
    };
  });
}

export type DailyNetChangeRow = {
  startDate: string;
  endDate: string;
  days: number;
  totalChange: number;
  dailyChange: number;
};

export function dailyNetChangeRows(data: AppData): DailyNetChangeRow[] {
  return data.snapshots.flatMap((snapshot, index) => {
    const previous = data.snapshots[index - 1];
    if (!previous) return [];

    const days = (new Date(snapshot.date).getTime() - new Date(previous.date).getTime()) / 86400000;
    if (days <= 0 || !Number.isFinite(days)) return [];

    const totalChange = snapshot.computedTotalCny - previous.computedTotalCny;
    return [{
      startDate: previous.date,
      endDate: snapshot.date,
      days,
      totalChange,
      dailyChange: totalChange / days,
    }];
  });
}

export function categoryChangeRows(previous: AssetSnapshot | undefined, selected: AssetSnapshot): Array<{ category: AssetCategory; change: number }> {
  const previousTotals = previous ? categoryTotals(previous, []) : Object.fromEntries(categories.map((category) => [category, 0])) as Record<AssetCategory, number>;
  const selectedTotals = categoryTotals(selected, []);
  return categories.map((category) => ({
    category,
    change: selectedTotals[category] - previousTotals[category],
  }));
}

export function hasImportedData(data: AppData): boolean {
  return data.snapshots.length > 0;
}
