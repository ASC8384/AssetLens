import { categoryTotals } from './calculations';
import { externalIncomeDateLabel, resolveExternalIncome } from './income';
import type { AssetSnapshot, FireConfig } from './types';

export type FireSpeedEstimate = {
  key: 'latest' | 'lastYear' | 'allTime';
  label: string;
  monthlyChange: number | null;
  projectedMonthsToFire: number | null;
  startDate: string | null;
  endDate: string | null;
  months: number | null;
  confidenceLabel: '样本不足' | '波动较大' | '无法外推' | '可参考';
  note: string;
};

export type FireSensitivityRate = { label: string; withdrawalRate: number };
export type FireSensitivityCell = { withdrawalRate: number; target: number; gap: number; progress: number; isCurrent: boolean };
export type FireSensitivityRow = { label: string; expenseMultiplier: number; monthlyExpense: number; cells: FireSensitivityCell[] };
export type FireSensitivityMatrix = { rates: FireSensitivityRate[]; rows: FireSensitivityRow[] };
export type FireDecisionSummary = {
  fireGap: number;
  targetYearMonth: string | null;
  emergencyStatus: '已达标' | '需补齐';
  variableImpacts: Array<{ label: string; amount: number }>;
  nextActions: string[];
};

export type FireAnalysis = {
  currentNetWorth: number;
  currentGrossAssets: number;
  currentLiability: number;
  latestExternalIncome: number | null;
  latestExternalIncomeLabel: string | null;
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
  sensitivityMatrix: FireSensitivityMatrix;
  decisionSummary: FireDecisionSummary;
};

export function createDefaultFireConfig(): FireConfig {
  return {
    monthlyExpense: 10000,
    withdrawalRate: 0.035,
    emergencyReserveMonthsTarget: 12,
    expectedAnnualReturn: 0.04,
  };
}

export function fireSensitivityMatrix(config: FireConfig, currentNetWorth: number): FireSensitivityMatrix {
  const rates = [0.03, 0.035, 0.04];
  if (!rates.some((rate) => Math.abs(rate - config.withdrawalRate) < 0.000001)) rates.push(config.withdrawalRate);
  const sortedRates = rates.sort((a, b) => a - b).map((rate) => ({ label: `${(rate * 100).toFixed(1)}%`, withdrawalRate: rate }));
  const rows = [
    { label: '支出 -20%', expenseMultiplier: 0.8 },
    { label: '当前支出', expenseMultiplier: 1 },
    { label: '支出 +20%', expenseMultiplier: 1.2 },
  ].map((row) => {
    const monthlyExpense = config.monthlyExpense * row.expenseMultiplier;
    return {
      ...row,
      monthlyExpense,
      cells: sortedRates.map(({ withdrawalRate }) => {
        const target = withdrawalRate > 0 ? monthlyExpense * 12 / withdrawalRate : 0;
        return {
          withdrawalRate,
          target,
          gap: Math.max(0, target - currentNetWorth),
          progress: target === 0 ? 0 : currentNetWorth / target,
          isCurrent: row.expenseMultiplier === 1 && Math.abs(withdrawalRate - config.withdrawalRate) < 0.000001,
        };
      }),
    };
  });
  return { rates: sortedRates, rows };
}

export function fireDecisionSummary(latest: AssetSnapshot | undefined, config: FireConfig, today = new Date()): FireDecisionSummary {
  const currentNetWorth = latest?.computedTotalCny ?? 0;
  const annualExpense = config.monthlyExpense * 12;
  const fireTarget = config.withdrawalRate > 0 ? annualExpense / config.withdrawalRate : 0;
  const fireGap = Math.max(0, fireTarget - currentNetWorth);
  const totals = latest ? categoryTotals(latest, []) : null;
  const emergencyAssets = totals ? totals['现金'] + totals['银行卡'] : 0;
  const emergencyReserveTarget = config.monthlyExpense * config.emergencyReserveMonthsTarget;
  const matrix = fireSensitivityMatrix(config, currentNetWorth);
  const currentTarget = matrix.rows[1].cells.find((cell) => cell.isCurrent)?.target ?? fireTarget;
  const lowerExpenseTarget = matrix.rows[0].cells.find((cell) => cell.isCurrent)?.target ?? currentTarget;
  const higherExpenseTarget = matrix.rows[2].cells.find((cell) => cell.isCurrent)?.target ?? currentTarget;
  const lowerRateTarget = annualExpense / 0.03;
  const higherRateTarget = annualExpense / 0.04;
  const withReturnMonths = monthsWithReturnOnly(currentNetWorth, fireTarget, config.expectedAnnualReturn);
  return {
    fireGap,
    targetYearMonth: targetYearMonth(today, withReturnMonths),
    emergencyStatus: emergencyAssets >= emergencyReserveTarget ? '已达标' : '需补齐',
    variableImpacts: [
      { label: '月支出 +20%', amount: higherExpenseTarget - currentTarget },
      { label: '月支出 -20%', amount: lowerExpenseTarget - currentTarget },
      { label: '提取率降到 3.0%', amount: lowerRateTarget - currentTarget },
      { label: '提取率升到 4.0%', amount: higherRateTarget - currentTarget },
    ],
    nextActions: fireGap <= 0 ? ['当前资产已达到 FIRE 目标。'] : emergencyAssets < emergencyReserveTarget ? ['先补齐应急备用金，再看长期 FIRE 进度。'] : ['优先观察月支出和安全提取率假设对目标的影响。'],
  };
}

function targetYearMonth(today: Date, months: number | null): string | null {
  if (months === null) return null;
  const target = new Date(today);
  target.setMonth(target.getMonth() + months);
  return `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, '0')}`;
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
  const latestIncome = resolveExternalIncome(snapshots, latest);
  return {
    currentNetWorth,
    currentGrossAssets: latest?.computedGrossAssetsCny ?? 0,
    currentLiability: latest?.computedLiabilityCny ?? 0,
    latestExternalIncome: latestIncome.amount,
    latestExternalIncomeLabel: externalIncomeDateLabel(latestIncome),
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
    sensitivityMatrix: fireSensitivityMatrix(config, currentNetWorth),
    decisionSummary: fireDecisionSummary(latest, config),
  };
}

export function fireSpeedEstimates(snapshots: AssetSnapshot[], fireTarget: number): FireSpeedEstimate[] {
  const allTimeMonthlyChange = snapshots.length >= 2 ? (snapshots[snapshots.length - 1].computedTotalCny - snapshots[0].computedTotalCny) / Math.max(1, monthDiff(snapshots[0].date, snapshots[snapshots.length - 1].date)) : null;
  const latest = latestIntervalEstimate(snapshots, fireTarget, allTimeMonthlyChange);
  const lastYear = rangeEstimate(snapshots, fireTarget, 'lastYear', '近一年速度', 12);
  const allTime = rangeEstimate(snapshots, fireTarget, 'allTime', '历史以来速度');
  return [latest, lastYear, allTime];
}

function latestIntervalEstimate(snapshots: AssetSnapshot[], fireTarget: number, allTimeMonthlyChange: number | null): FireSpeedEstimate {
  if (snapshots.length < 2) return emptySpeedEstimate('latest', '最近一次更新');
  const previous = snapshots[snapshots.length - 2];
  const latest = snapshots[snapshots.length - 1];
  const months = Math.max(1, monthDiff(previous.date, latest.date));
  const monthlyChange = (latest.computedTotalCny - previous.computedTotalCny) / months;
  return createSpeedEstimate('latest', '最近一次更新', previous.date, latest.date, months, monthlyChange, fireTarget, latest.computedTotalCny, snapshots.length, allTimeMonthlyChange);
}

function rangeEstimate(snapshots: AssetSnapshot[], fireTarget: number, key: 'lastYear' | 'allTime', label: string, maxMonths?: number): FireSpeedEstimate {
  if (snapshots.length < 2) return emptySpeedEstimate(key, label);
  const latest = snapshots[snapshots.length - 1];
  const start = maxMonths === undefined ? snapshots[0] : findStartWithinMonths(snapshots, latest.date, maxMonths);
  const months = Math.max(1, monthDiff(start.date, latest.date));
  const monthlyChange = (latest.computedTotalCny - start.computedTotalCny) / months;
  return createSpeedEstimate(key, label, start.date, latest.date, months, monthlyChange, fireTarget, latest.computedTotalCny, snapshots.length, null);
}

function emptySpeedEstimate(key: FireSpeedEstimate['key'], label: string): FireSpeedEstimate {
  return { key, label, monthlyChange: null, projectedMonthsToFire: null, startDate: null, endDate: null, months: null, confidenceLabel: '样本不足', note: '至少需要两期快照。' };
}

function createSpeedEstimate(key: FireSpeedEstimate['key'], label: string, startDate: string, endDate: string, months: number, monthlyChange: number, fireTarget: number, currentNetWorth: number, snapshotCount: number, allTimeMonthlyChange: number | null): FireSpeedEstimate {
  const confidence = speedConfidence(key, months, monthlyChange, snapshotCount, allTimeMonthlyChange);
  return {
    key,
    label,
    monthlyChange,
    projectedMonthsToFire: monthsToFire(fireTarget, currentNetWorth, monthlyChange),
    startDate,
    endDate,
    months,
    ...confidence,
  };
}

function speedConfidence(key: FireSpeedEstimate['key'], months: number, monthlyChange: number, snapshotCount: number, allTimeMonthlyChange: number | null): Pick<FireSpeedEstimate, 'confidenceLabel' | 'note'> {
  if (monthlyChange <= 0) return { confidenceLabel: '无法外推', note: '当前速度无法外推到 FIRE。' };
  if (key === 'latest' && snapshotCount >= 3 && allTimeMonthlyChange !== null && Math.abs(monthlyChange) > Math.abs(allTimeMonthlyChange) * 2) {
    return { confidenceLabel: '波动较大', note: '最近一次变化可能受单次大额波动影响。' };
  }
  if (months < 3) return { confidenceLabel: '样本不足', note: '样本跨度少于 3 个月。' };
  return { confidenceLabel: '可参考', note: '仍需结合市场波动和主动投入理解。' };
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
