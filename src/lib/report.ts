import type { AppData, AssetCategory, AssetSnapshot } from './types';
import { accountChanges, categoryTotals } from './calculations';
import { categories } from './defaults';
import { formatMoney, formatPercent } from './format';

export type ReportMode = 'endpoint' | 'periodic';

export function snapshotsInRange(data: AppData, startDate: string, endDate: string): AssetSnapshot[] {
  return data.snapshots.filter((snapshot) => {
    if (startDate && snapshot.date < startDate) return false;
    if (endDate && snapshot.date > endDate) return false;
    return true;
  });
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
  const ratioDiffs = last.entries
    .filter((entry) => entry.ratioDiff !== null && entry.ratioDiff !== undefined)
    .sort((a, b) => Math.abs(b.ratioDiff ?? 0) - Math.abs(a.ratioDiff ?? 0))
    .slice(0, 5);

  return [
    `# 资产复盘报告（${first.date} 至 ${last.date}）`,
    '',
    `- 对比方式：${mode === 'endpoint' ? '期初 vs 期末' : '逐期变化'}`,
    `- 期初总资产：${formatMoney(first.computedTotalCny)}`,
    `- 期末总资产：${formatMoney(last.computedTotalCny)}`,
    `- 总资产变化：${formatMoney(change)}`,
    `- 总资产增长率：${formatPercent(growth)}`,
    `- 最大增长账户：${largestIncrease ? `${largestIncrease.accountName}（${formatMoney(largestIncrease.change)}）` : '—'}`,
    `- 最大减少账户：${largestDecrease ? `${largestDecrease.accountName}（${formatMoney(largestDecrease.change)}）` : '—'}`,
    '',
    '## 大类资产结构变化',
    ...categories.map((category) => categoryLine(category, startTotals[category], endTotals[category])),
    '',
    '## 汇率影响',
    exchangeRateSummary(first, last),
    '',
    '## 占比差异较大项目',
    ...(ratioDiffs.length === 0 ? ['- 无明显占比差异。'] : ratioDiffs.map((entry) => `- ${entry.accountName}：${formatPercent(entry.ratioDiff)}`)),
    '',
    periodicSummary(snapshots, mode),
  ].join('\n');
}

function diffAccounts(first: AssetSnapshot, last: AssetSnapshot): Array<{ accountName: string; change: number }> {
  const firstAmounts = new Map(first.entries.map((entry) => [entry.accountId, entry.amountCny ?? 0]));
  return last.entries
    .map((entry) => ({ accountName: entry.accountName, change: (entry.amountCny ?? 0) - (firstAmounts.get(entry.accountId) ?? 0) }))
    .sort((a, b) => b.change - a.change);
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
