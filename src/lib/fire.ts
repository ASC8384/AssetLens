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
  forecasts: {
    contributionOnlyMonths: number | null;
    withReturnMonths: number | null;
    stressMonths: number | null;
  };
  scenarios: Array<{ label: string; withdrawalRate: number; target: number; gap: number }>;
};

export function createDefaultFireConfig(): FireConfig {
  return {
    monthlyExpense: 10000,
    withdrawalRate: 0.035,
    emergencyReserveMonthsTarget: 12,
    monthlyContribution: 20000,
    expectedAnnualReturn: 0.04,
    stressNoContributionMonths: 6,
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
    forecasts: {
      contributionOnlyMonths: monthsByContributionOnly(fireGap, config.monthlyContribution),
      withReturnMonths: monthsWithReturn(currentNetWorth, fireTarget, config.monthlyContribution, config.expectedAnnualReturn),
      stressMonths: monthsWithStress(currentNetWorth, fireTarget, config.monthlyContribution, config.expectedAnnualReturn, config.stressNoContributionMonths),
    },
    scenarios: [0.03, 0.035, 0.04].map((rate) => {
      const target = annualExpense / rate;
      return { label: `${(rate * 100).toFixed(1)}%`, withdrawalRate: rate, target, gap: Math.max(0, target - currentNetWorth) };
    }),
  };
}

function monthsByContributionOnly(gap: number, monthlyContribution: number): number | null {
  if (gap <= 0) return 0;
  if (monthlyContribution <= 0) return null;
  return Math.ceil(gap / monthlyContribution);
}

function monthsWithReturn(current: number, target: number, monthlyContribution: number, annualReturn: number): number | null {
  if (current >= target) return 0;
  if (monthlyContribution <= 0 && annualReturn <= 0) return null;
  const monthlyReturn = Math.pow(1 + Math.max(annualReturn, 0), 1 / 12) - 1;
  let value = current;
  for (let month = 1; month <= 1200; month += 1) {
    value = value * (1 + monthlyReturn) + monthlyContribution;
    if (value >= target) return month;
  }
  return null;
}

function monthsWithStress(current: number, target: number, monthlyContribution: number, annualReturn: number, stressMonths: number): number | null {
  if (current >= target) return 0;
  const monthlyReturn = Math.pow(1 + Math.max(annualReturn, 0), 1 / 12) - 1;
  const stressedCurrent = current * Math.pow(1 + monthlyReturn, Math.max(stressMonths, 0));
  const afterStress = monthsWithReturn(stressedCurrent, target, monthlyContribution, annualReturn);
  return afterStress === null ? null : Math.max(stressMonths, 0) + afterStress;
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
