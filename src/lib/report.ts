import type { AppData, AssetCategory, AssetSnapshot } from './types';
import { accountChanges, categoryTotals } from './calculations';
import { categories } from './defaults';
import { formatMoney, formatPercent } from './format';
import { analyzeStrategy } from './strategy';
import { totalQuality } from './dashboard';

export type ReportMode = 'endpoint' | 'periodic';

export type ReportRange = {
  label: string;
  startDate: string;
  endDate: string;
};

export type StructuredReportSummary = {
  status: 'ready' | 'empty';
  message: string;
  startDate: string | null;
  endDate: string | null;
  snapshotCount: number;
  startTotal: number | null;
  endTotal: number | null;
  totalChange: number | null;
  growth: number | null;
  topIncreases: Array<{ accountName: string; change: number }>;
  topDecreases: Array<{ accountName: string; change: number }>;
  categoryChanges: Array<{ category: AssetCategory; start: number; end: number; change: number }>;
  riskAssetRatioChange: { start: number | null; end: number | null; change: number | null };
  startLiability: number | null;
  endLiability: number | null;
  liabilityChange: number | null;
  externalIncomeTotal: number | null;
  afterIncomeChange: number | null;
  dataQualityMessages: string[];
};

export function availableReportRanges(data: AppData): ReportRange[] {
  const first = data.snapshots[0]?.date ?? '';
  const last = data.snapshots[data.snapshots.length - 1]?.date ?? '';
  return [
    { label: '全部', startDate: first, endDate: last },
    { label: '近 1 个月', startDate: shiftMonth(last, -1), endDate: last },
    { label: '近 3 个月', startDate: shiftMonth(last, -3), endDate: last },
    { label: '近 1 年', startDate: shiftMonth(last, -12), endDate: last },
  ];
}

function shiftMonth(date: string, offset: number): string {
  if (!date) return '';
  const current = new Date(`${date}T00:00:00`);
  current.setMonth(current.getMonth() + offset);
  return current.toISOString().slice(0, 10);
}

export function snapshotsInRange(data: AppData, startDate: string, endDate: string): AssetSnapshot[] {
  return data.snapshots.filter((snapshot) => {
    if (startDate && snapshot.date < startDate) return false;
    if (endDate && snapshot.date > endDate) return false;
    return true;
  });
}

export function buildStructuredReportSummary(data: AppData, startDate: string, endDate: string, mode: ReportMode): StructuredReportSummary {
  const snapshots = snapshotsInRange(data, startDate, endDate);
  if (snapshots.length === 0) {
    return {
      status: 'empty',
      message: '当前时间范围内没有资产记录。',
      startDate: null,
      endDate: null,
      snapshotCount: 0,
      startTotal: null,
      endTotal: null,
      totalChange: null,
      growth: null,
      topIncreases: [],
      topDecreases: [],
      categoryChanges: [],
      riskAssetRatioChange: { start: null, end: null, change: null },
      startLiability: null,
      endLiability: null,
      liabilityChange: null,
      externalIncomeTotal: null,
      afterIncomeChange: null,
      dataQualityMessages: ['当前时间范围内没有资产记录。'],
    };
  }

  const first = snapshots[0];
  const last = snapshots[snapshots.length - 1];
  const startTotal = first.computedTotalCny;
  const endTotal = last.computedTotalCny;
  const totalChange = endTotal - startTotal;
  const startTotals = categoryTotals(first, data.accounts);
  const endTotals = categoryTotals(last, data.accounts);
  const contributionRows = accountContributionRows(first, last);
  const topIncreases = contributionRows.filter((row) => row.change > 0).slice(0, 3);
  const topDecreases = [...contributionRows].reverse().filter((row) => row.change < 0).slice(0, 3);
  const startRiskRatio = first.computedGrossAssetsCny === 0 ? null : (startTotals['基金'] + startTotals['证券']) / first.computedGrossAssetsCny;
  const endRiskRatio = last.computedGrossAssetsCny === 0 ? null : (endTotals['基金'] + endTotals['证券']) / last.computedGrossAssetsCny;
  const qualityMessages = dataQualityMessages(snapshots);
  const incomeValues = snapshots.map((snapshot) => snapshot.externalIncome).filter((value): value is number => value !== null && value !== undefined);
  const externalIncomeTotal = incomeValues.length > 0 ? incomeValues.reduce((sum, value) => sum + value, 0) : null;

  return {
    status: 'ready',
    message: mode === 'periodic' ? '结构化摘要基于所选范围内逐期快照生成。' : '结构化摘要基于所选范围的期初与期末生成。',
    startDate: first.date,
    endDate: last.date,
    snapshotCount: snapshots.length,
    startTotal,
    endTotal,
    totalChange,
    growth: startTotal === 0 ? null : totalChange / startTotal,
    topIncreases,
    topDecreases,
    categoryChanges: categories.map((category) => ({ category, start: startTotals[category], end: endTotals[category], change: endTotals[category] - startTotals[category] })),
    riskAssetRatioChange: {
      start: startRiskRatio,
      end: endRiskRatio,
      change: startRiskRatio === null || endRiskRatio === null ? null : endRiskRatio - startRiskRatio,
    },
    startLiability: first.computedLiabilityCny,
    endLiability: last.computedLiabilityCny,
    liabilityChange: last.computedLiabilityCny - first.computedLiabilityCny,
    externalIncomeTotal,
    afterIncomeChange: externalIncomeTotal === null ? null : totalChange - externalIncomeTotal,
    dataQualityMessages: qualityMessages,
  };
}

function dataQualityMessages(snapshots: AssetSnapshot[]): string[] {
  if (snapshots.length < 2) return ['当前范围只有一期快照，变化分析有限。'];
  if (snapshots.some((snapshot) => {
    const quality = totalQuality(snapshot);
    return quality.status === 'danger' || quality.status === 'warning';
  })) return ['发现合计差异，建议先检查明细表。'];
  return ['数据质量未发现明显异常。'];
}

export function generateMarkdownReport(data: AppData, startDate: string, endDate: string, mode: ReportMode): string {
  const snapshots = snapshotsInRange(data, startDate, endDate);
  if (snapshots.length === 0) return '当前时间范围内没有资产记录。';
  const first = snapshots[0];
  const last = snapshots[snapshots.length - 1];
  const change = last.computedTotalCny - first.computedTotalCny;
  const growth = first.computedTotalCny === 0 ? null : change / first.computedTotalCny;
  const startTotals = categoryTotals(first, data.accounts);
  const endTotals = categoryTotals(last, data.accounts);
  const accountDiffs = diffAccounts(first, last);
  const largestIncrease = accountDiffs[0];
  const largestDecrease = [...accountDiffs].reverse()[0];
  const contributionRows = accountContributionRows(first, last).slice(0, 8);
  const strategy = analyzeStrategy(last, data.strategy);

  return [
    `# 资产复盘报告（${first.date} 至 ${last.date}）`,
    '',
    `- 对比方式：${mode === 'endpoint' ? '期初 vs 期末' : '逐期变化'}`,
    `- 期初净资产：${formatMoney(first.computedTotalCny)}`,
    `- 期末净资产：${formatMoney(last.computedTotalCny)}`,
    `- 净资产变化：${formatMoney(change)}`,
    `- 净资产增长率：${formatPercent(growth)}`,
    `- 期初负债：${formatMoney(first.computedLiabilityCny)}`,
    `- 期末负债：${formatMoney(last.computedLiabilityCny)}`,
    `- 区间外界收入合计：${formatMoney(sumExternalIncome(snapshots))}`,
    `- 扣除外界收入后变化：${formatMoney(afterIncomeChange(change, snapshots))}`,
    `- 最大增长账户：${largestIncrease ? `${largestIncrease.accountName}（${formatMoney(largestIncrease.change)}）` : '—'}`,
    `- 最大减少账户：${largestDecrease ? `${largestDecrease.accountName}（${formatMoney(largestDecrease.change)}）` : '—'}`,
    '',
    '## 大类资产结构变化',
    ...categories.map((category) => categoryLine(category, startTotals[category], endTotals[category])),
    '',
    '## 汇率影响',
    exchangeRateSummary(first, last),
    '',
    '## 账户贡献榜',
    ...contributionRows.map((row) => `- ${row.accountName}：${formatMoney(row.change)}`),
    '',
    '## 策略偏离提示',
    ...(strategy.suggestions.length > 0 ? strategy.suggestions.map((item) => `- ${item}`) : ['- 当前资产结构落在策略目标内。']),
    '',
    periodicSummary(snapshots, mode),
  ].join('\n');
}

export function accountContributionRows(first: AssetSnapshot, last: AssetSnapshot): Array<{ accountName: string; change: number }> {
  const firstAmounts = new Map(first.entries.map((entry) => [entry.accountId, entry.amountCny ?? 0]));
  return last.entries
    .map((entry) => ({ accountName: entry.accountName, change: (entry.amountCny ?? 0) - (firstAmounts.get(entry.accountId) ?? 0) }))
    .sort((a, b) => b.change - a.change);
}

function diffAccounts(first: AssetSnapshot, last: AssetSnapshot): Array<{ accountName: string; change: number }> {
  return accountContributionRows(first, last);
}

function categoryLine(category: AssetCategory, start: number, end: number): string {
  return `- ${category}：${formatMoney(start)} → ${formatMoney(end)}，变化 ${formatMoney(end - start)}`;
}

function exchangeRateSummary(first: AssetSnapshot, last: AssetSnapshot): string {
  const currencies = new Set([...Object.keys(first.exchangeRates), ...Object.keys(last.exchangeRates)].filter((currency) => currency !== 'CNY'));
  if (currencies.size === 0) return '- 仅使用 CNY，未发现外币汇率影响。';
  return [...currencies]
    .map((currency) => `- ${currency}：${first.exchangeRates[currency] ?? '—'} → ${last.exchangeRates[currency] ?? '—'}`)
    .join('\n');
}

function periodicSummary(snapshots: AssetSnapshot[], mode: ReportMode): string {
  if (mode !== 'periodic' || snapshots.length < 2) return '';
  return [
    '## 逐期变化',
    ...snapshots.slice(1).map((snapshot, index) => {
      const previous = snapshots[index];
      const change = snapshot.computedTotalCny - previous.computedTotalCny;
      return `- ${previous.date} → ${snapshot.date}：${formatMoney(change)}`;
    }),
  ].join('\n');
}

export { accountChanges };

function sumExternalIncome(snapshots: AssetSnapshot[]): number | null {
  const values = snapshots.map((snapshot) => snapshot.externalIncome).filter((value): value is number => value !== null && value !== undefined);
  return values.length > 0 ? values.reduce((sum, value) => sum + value, 0) : null;
}

function afterIncomeChange(netChange: number, snapshots: AssetSnapshot[]): number | null {
  const income = sumExternalIncome(snapshots);
  return income === null ? null : netChange - income;
}
