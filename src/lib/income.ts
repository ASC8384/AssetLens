import type { AssetSnapshot } from './types';

export type ResolvedExternalIncome = {
  amount: number | null;
  sourceDate: string | null;
  inherited: boolean;
};

export function hasRecordedExternalIncome(snapshot: Pick<AssetSnapshot, 'externalIncome'>): boolean {
  return snapshot.externalIncome !== null && snapshot.externalIncome !== undefined;
}

export function resolveExternalIncome(snapshots: AssetSnapshot[], selected: AssetSnapshot | undefined): ResolvedExternalIncome {
  if (!selected) return { amount: null, sourceDate: null, inherited: false };
  if (hasRecordedExternalIncome(selected)) {
    return { amount: selected.externalIncome ?? null, sourceDate: selected.date, inherited: false };
  }

  const selectedIndex = snapshots.findIndex((snapshot) => snapshot.id === selected.id);
  const start = selectedIndex === -1 ? snapshots.length - 1 : selectedIndex - 1;
  for (let index = start; index >= 0; index -= 1) {
    const candidate = snapshots[index];
    if (hasRecordedExternalIncome(candidate)) {
      return { amount: candidate.externalIncome ?? null, sourceDate: candidate.date, inherited: true };
    }
  }

  return { amount: null, sourceDate: null, inherited: false };
}

export type IntervalExternalIncome = {
  amount: number | null;
  recorded: boolean;
};

// 外界收入是上一期到这一期之间实际到账的钱：开始填写之后，某期没填就表示这段时间没有收入。
export function intervalExternalIncome(snapshots: AssetSnapshot[], selected: AssetSnapshot): IntervalExternalIncome {
  if (hasRecordedExternalIncome(selected)) return { amount: selected.externalIncome ?? null, recorded: true };
  const selectedIndex = snapshots.findIndex((snapshot) => snapshot.id === selected.id);
  const earlier = selectedIndex === -1 ? snapshots : snapshots.slice(0, selectedIndex);
  return { amount: earlier.some(hasRecordedExternalIncome) ? 0 : null, recorded: false };
}

export function intervalExternalIncomeLabel(income: IntervalExternalIncome, date: string, today = new Date()): string | null {
  if (income.recorded) return externalIncomeDateLabel({ amount: income.amount, sourceDate: date, inherited: false }, today);
  return income.amount === null ? null : '本期未填，按 0 计';
}

export function daysSinceDate(date: string, today = new Date()): number | null {
  const time = new Date(`${date}T00:00:00`).getTime();
  if (!Number.isFinite(time)) return null;
  return Math.max(0, Math.floor((today.getTime() - time) / 86400000));
}

export function externalIncomeDateLabel(resolved: ResolvedExternalIncome, today = new Date()): string | null {
  if (!resolved.sourceDate) return null;
  const prefix = resolved.inherited ? `沿用 ${resolved.sourceDate}` : `记录于 ${resolved.sourceDate}`;
  const days = daysSinceDate(resolved.sourceDate, today);
  if (days === null) return prefix;
  if (days === 0) return `${prefix} · 今天`;
  return `${prefix} · 距今 ${days} 天`;
}
