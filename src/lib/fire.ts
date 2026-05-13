import { categoryTotals } from './calculations';
import type { AssetSnapshot, FireConfig } from './types';

export type FireAnalysis = {
  currentNetWorth: number;
  annualExpense: number;
  fireTarget: number;
  fireProgress: number;
  fireGap: number;
  emergencyReserveMonths: number | null;
  monthlyGrowth: number | null;
  estimatedMonthsToFire: number | null;
  scenarios: Array<{ label: string; withdrawalRate: number; target: number; gap: number }>;
};

export function createDefaultFireConfig(): FireConfig {
  return {
    monthlyExpense: 10000,
    withdrawalRate: 0.035,
    emergencyReserveMonthsTarget: 12,
  };
}

export function analyzeFire(snapshots: AssetSnapshot[], config: FireConfig): FireAnalysis {
  const latest = snapshots[snapshots.length - 1];
  const currentNetWorth = latest?.computedTotalCny ?? 0;
  const annualExpense = config.monthlyExpense * 12;
  const fireTarget = config.withdrawalRate > 0 ? annualExpense / config.withdrawalRate : 0;
  const fireGap = Math.max(0, fireTarget - currentNetWorth);
  const monthlyGrowth = averageMonthlyGrowth(snapshots);
  const totals = latest ? categoryTotals(latest, []) : null;
  const emergencyAssets = totals ? totals['现金'] + totals['银行卡'] : 0;
  return {
    currentNetWorth,
    annualExpense,
    fireTarget,
    fireProgress: fireTarget === 0 ? 0 : currentNetWorth / fireTarget,
    fireGap,
    emergencyReserveMonths: config.monthlyExpense > 0 ? emergencyAssets / config.monthlyExpense : null,
    monthlyGrowth,
    estimatedMonthsToFire: monthlyGrowth && monthlyGrowth > 0 ? Math.ceil(fireGap / monthlyGrowth) : null,
    scenarios: [0.03, 0.035, 0.04].map((rate) => {
      const target = annualExpense / rate;
      return { label: `${(rate * 100).toFixed(1)}%`, withdrawalRate: rate, target, gap: Math.max(0, target - currentNetWorth) };
    }),
  };
}

function averageMonthlyGrowth(snapshots: AssetSnapshot[]): number | null {
  if (snapshots.length < 2) return null;
  const first = snapshots[0];
  const last = snapshots[snapshots.length - 1];
  const months = Math.max(1, monthDiff(first.date, last.date));
  return (last.computedTotalCny - first.computedTotalCny) / months;
}

function monthDiff(start: string, end: string): number {
  const startDate = new Date(`${start}T00:00:00`);
  const endDate = new Date(`${end}T00:00:00`);
  return (endDate.getFullYear() - startDate.getFullYear()) * 12 + endDate.getMonth() - startDate.getMonth();
}
