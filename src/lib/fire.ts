import { categoryTotals } from './calculations';
import type { AssetSnapshot, FireConfig } from './types';

export type FireSpeedEstimate = {
  key: 'latest' | 'lastYear' | 'allTime';
  label: string;
  monthlyChange: number | null;
  projectedMonthsToFire: number | null;
};

export type FireAnalysis = {
  currentNetWorth: number;
  annualExpense: number;
  fireTarget: number;
  fireProgress: number;
  fireGap: number;
  emergencyReserveMonths: number | null;
  emergencyReserveTarget: number;
  emergencyReserveGap: number;
  monthlyGrowth: number | null;
  estimatedMonthsToFire: number | null;
  expectedAnnualReturn: number;
  forecasts: {
    contributionOnlyMonths: number | null;
    withReturnMonths: number | null;
    stressMonths: number | null;
  };
  speedEstimates: FireSpeedEstimate[];
  scenarios: Array<{ label: string; withdrawalRate: number; target: number; gap: number }>;
};

export function createDefaultFireConfig(): FireConfig {
  return {
    monthlyExpense: 10000,
    withdrawalRate: 0.035,
    emergencyReserveMonthsTarget: 12,
    expectedAnnualReturn: 0.04,
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
  const emergencyReserveTarget = config.monthlyExpense * config.emergencyReserveMonthsTarget;
  const emergencyReserveGap = Math.max(0, emergencyReserveTarget - emergencyAssets);
  return {
    currentNetWorth,
    annualExpense,
    fireTarget,
    fireProgress: fireTarget === 0 ? 0 : currentNetWorth / fireTarget,
    fireGap,
    emergencyReserveMonths: config.monthlyExpense > 0 ? emergencyAssets / config.monthlyExpense : null,
    emergencyReserveTarget,
    emergencyReserveGap,
    monthlyGrowth,
    estimatedMonthsToFire: monthlyGrowth && monthlyGrowth > 0 ? Math.ceil(fireGap / monthlyGrowth) : null,
    expectedAnnualReturn: config.expectedAnnualReturn,
    forecasts: {
      contributionOnlyMonths: null,
      withReturnMonths: monthsWithReturnOnly(currentNetWorth, fireTarget, config.expectedAnnualReturn),
      stressMonths: null,
    },
    speedEstimates: fireSpeedEstimates(snapshots, fireTarget),
    scenarios: [0.03, 0.035, 0.04].map((rate) => {
      const target = annualExpense / rate;
      return { label: `${(rate * 100).toFixed(1)}%`, withdrawalRate: rate, target, gap: Math.max(0, target - currentNetWorth) };
    }),
  };
}

export function fireSpeedEstimates(snapshots: AssetSnapshot[], fireTarget: number): FireSpeedEstimate[] {
  const latest = latestIntervalEstimate(snapshots, fireTarget);
  const lastYear = rangeEstimate(snapshots, fireTarget, 'lastYear', '近一年速度', 12);
  const allTime = rangeEstimate(snapshots, fireTarget, 'allTime', '历史以来速度');
  return [latest, lastYear, allTime];
}

function latestIntervalEstimate(snapshots: AssetSnapshot[], fireTarget: number): FireSpeedEstimate {
  if (snapshots.length < 2) return { key: 'latest', label: '最近一次更新', monthlyChange: null, projectedMonthsToFire: null };
  const previous = snapshots[snapshots.length - 2];
  const latest = snapshots[snapshots.length - 1];
  const months = Math.max(1, monthDiff(previous.date, latest.date));
  const monthlyChange = (latest.computedTotalCny - previous.computedTotalCny) / months;
  return { key: 'latest', label: '最近一次更新', monthlyChange, projectedMonthsToFire: monthsToFire(fireTarget, latest.computedTotalCny, monthlyChange) };
}

function rangeEstimate(snapshots: AssetSnapshot[], fireTarget: number, key: 'lastYear' | 'allTime', label: string, maxMonths?: number): FireSpeedEstimate {
  if (snapshots.length < 2) return { key, label, monthlyChange: null, projectedMonthsToFire: null };
  const latest = snapshots[snapshots.length - 1];
  const start = maxMonths === undefined ? snapshots[0] : findStartWithinMonths(snapshots, latest.date, maxMonths);
  const months = Math.max(1, monthDiff(start.date, latest.date));
  const monthlyChange = (latest.computedTotalCny - start.computedTotalCny) / months;
  return { key, label, monthlyChange, projectedMonthsToFire: monthsToFire(fireTarget, latest.computedTotalCny, monthlyChange) };
}

function findStartWithinMonths(snapshots: AssetSnapshot[], latestDate: string, months: number): AssetSnapshot {
  const latest = new Date(`${latestDate}T00:00:00`);
  const threshold = new Date(latest);
  threshold.setMonth(threshold.getMonth() - months);
  return snapshots.find((snapshot) => new Date(`${snapshot.date}T00:00:00`) >= threshold) ?? snapshots[0];
}

function monthsToFire(fireTarget: number, currentNetWorth: number, monthlyChange: number): number | null {
  const gap = fireTarget - currentNetWorth;
  if (gap <= 0) return 0;
  if (monthlyChange <= 0) return null;
  return Math.ceil(gap / monthlyChange);
}

function monthsWithReturnOnly(current: number, target: number, annualReturn: number): number | null {
  if (current >= target) return 0;
  if (current <= 0 || annualReturn <= 0) return null;
  const monthlyReturn = Math.pow(1 + annualReturn, 1 / 12) - 1;
  if (monthlyReturn <= 0) return null;
  return Math.ceil(Math.log(target / current) / Math.log(1 + monthlyReturn));
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
