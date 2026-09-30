import { intervalExternalIncome } from './income';
import type { AssetSnapshot } from './types';

export const DAYS_PER_MONTH = 365.25 / 12;

export type DailyNetChangeRow = {
  startDate: string;
  endDate: string;
  days: number;
  totalChange: number;
  dailyChange: number;
  externalIncome: number | null;
  externalIncomeRecorded: boolean;
  afterIncomeDailyChange: number | null;
  amortizedDailyIncome: number | null;
  amortizedDailyChange: number | null;
};

export function daysBetween(start: string, end: string): number {
  return (new Date(end).getTime() - new Date(start).getTime()) / 86400000;
}

export function snapshotIntervalRows(snapshots: AssetSnapshot[]): DailyNetChangeRow[] {
  const rows = snapshots.flatMap((snapshot, index): DailyNetChangeRow[] => {
    const previous = snapshots[index - 1];
    if (!previous) return [];

    const days = daysBetween(previous.date, snapshot.date);
    if (days <= 0 || !Number.isFinite(days)) return [];

    const totalChange = snapshot.computedTotalCny - previous.computedTotalCny;
    const income = intervalExternalIncome(snapshots, snapshot);
    return [{
      startDate: previous.date,
      endDate: snapshot.date,
      days,
      totalChange,
      dailyChange: totalChange / days,
      externalIncome: income.amount,
      externalIncomeRecorded: income.recorded,
      afterIncomeDailyChange: income.amount === null ? null : (totalChange - income.amount) / days,
      amortizedDailyIncome: null,
      amortizedDailyChange: null,
    }];
  });
  return withAmortizedIncome(rows);
}

// 每笔收入平摊到「上一笔收入之后到这一笔为止」的每一天；最后一笔收入之后的区间沿用最近的摊平速度。
function withAmortizedIncome(rows: DailyNetChangeRow[]): DailyNetChangeRow[] {
  const rates: Array<number | null> = rows.map(() => null);
  let pending: number[] = [];
  let lastRate: number | null = null;
  rows.forEach((row, index) => {
    if (row.externalIncome === null) return;
    pending.push(index);
    if (row.externalIncome === 0) return;
    const days = pending.reduce((sum, pendingIndex) => sum + rows[pendingIndex].days, 0);
    const rate = row.externalIncome / days;
    pending.forEach((pendingIndex) => { rates[pendingIndex] = rate; });
    pending = [];
    lastRate = rate;
  });
  pending.forEach((pendingIndex) => { rates[pendingIndex] = lastRate ?? 0; });

  return rows.map((row, index) => {
    const rate = rates[index];
    return {
      ...row,
      amortizedDailyIncome: rate,
      amortizedDailyChange: rate === null || row.afterIncomeDailyChange === null ? null : row.afterIncomeDailyChange + rate,
    };
  });
}
