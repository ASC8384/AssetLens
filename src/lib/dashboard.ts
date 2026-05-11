import { categoryTotals } from './calculations';
import type { AppData, AssetSnapshot } from './types';

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

export function categoryTrendData(data: AppData): Array<Record<string, number | string>> {
  return data.snapshots.map((snapshot) => ({
    date: snapshot.date,
    total: snapshot.computedTotalCny,
    ...categoryTotals(snapshot, data.accounts),
  }));
}

export function hasImportedData(data: AppData): boolean {
  return data.snapshots.length > 0;
}
