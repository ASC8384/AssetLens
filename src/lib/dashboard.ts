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

export type SelectedSnapshotContext = {
  selected: AssetSnapshot | undefined;
  previous: AssetSnapshot | undefined;
  selectedIndex: number;
};

export function selectedSnapshotContext(snapshots: AssetSnapshot[], selectedDate: string): SelectedSnapshotContext {
  if (snapshots.length === 0) return { selected: undefined, previous: undefined, selectedIndex: -1 };
  const foundIndex = selectedDate ? snapshots.findIndex((snapshot) => snapshot.date === selectedDate) : -1;
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
