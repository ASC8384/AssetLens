import { useEffect, useMemo, useState } from 'react';
import type { AppData } from '../lib/types';
import {
  applyReviewRangeRequest,
  availableReportRanges,
  buildStructuredReportSummary,
  defaultReportRange,
  generateMarkdownReport,
  matchingReportPreset,
  snapshotsInRange,
  syncReportRangeWithData,
  validateReportRange,
  type ReportMode,
  type ReportRangePreset,
  type ReviewRangeRequest,
} from '../lib/report';
import { formatMoney, formatPercent } from '../lib/format';

export function ReviewReport({
  data,
  rangeRequest,
}: {
  data: AppData;
  rangeRequest?: ReviewRangeRequest | null;
}) {
  const [range, setRange] = useState(() => defaultReportRange(data));
  const [mode, setMode] = useState<ReportMode>('endpoint');
  const ranges = useMemo(() => availableReportRanges(data), [data]);
  const rangeError = validateReportRange(range.startDate, range.endDate);
  const selectedSnapshots = useMemo(
    () => rangeError ? [] : snapshotsInRange(data, range.startDate, range.endDate),
    [data, range.startDate, range.endDate, rangeError],
  );
  const visualPreset = range.preset === 'custom' ? matchingReportPreset(data, range.startDate, range.endDate) : range.preset;
  const summary = useMemo(
    () => rangeError
      ? emptySummary(rangeError)
      : buildStructuredReportSummary(data, range.startDate, range.endDate, mode),
    [data, range.startDate, range.endDate, mode, rangeError],
  );
  const report = useMemo(
    () => rangeError ? rangeError : generateMarkdownReport(data, range.startDate, range.endDate, mode),
    [data, range.startDate, range.endDate, mode, rangeError],
  );

  useEffect(() => {
    setRange((current) => syncReportRangeWithData(data, current));
  }, [data]);

  useEffect(() => {
    if (!rangeRequest) return;
    setRange(applyReviewRangeRequest(rangeRequest, data));
  }, [rangeRequest]);

  function applyPreset(preset: Exclude<ReportRangePreset, 'custom'>) {
    const next = ranges.find((item) => item.preset === preset);
    if (!next) return;
    setRange({ startDate: next.startDate, endDate: next.endDate, preset: next.preset });
  }

  function updateDate(patch: { startDate?: string; endDate?: string }) {
    setRange((current) => ({ ...current, ...patch, preset: 'custom' }));
  }

  async function copyReport() {
    await navigator.clipboard.writeText(report);
  }

  return (
    <section className="panel report-view">
      <div className="section-header">
        <div>
          <h2>复盘报告</h2>
          <p>选择时间范围，生成可复制的 Markdown 资产总结。</p>
          <p className="report-range-hint">
            {rangeError
              ? rangeError
              : `已选 ${range.startDate} → ${range.endDate} · ${selectedSnapshots.length} 期快照`}
          </p>
        </div>
        <div className="toolbar compact-toolbar report-range-bar">
          <div className="range-buttons">
            {ranges.map((item) => (
              <button
                key={item.preset}
                className={item.preset === visualPreset ? 'active' : ''}
                onClick={() => applyPreset(item.preset)}
              >
                {item.label}
              </button>
            ))}
          </div>
          <label>开始 <input aria-label="开始" type="date" value={range.startDate} onChange={(event) => updateDate({ startDate: event.target.value })} /></label>
          <label>结束 <input aria-label="结束" type="date" value={range.endDate} onChange={(event) => updateDate({ endDate: event.target.value })} /></label>
          <select value={mode} onChange={(event) => setMode(event.target.value as ReportMode)}>
            <option value="endpoint">期初 vs 期末</option>
            <option value="periodic">逐期变化</option>
          </select>
          <button onClick={copyReport}>复制 Markdown</button>
        </div>
      </div>
      {summary.status === 'empty' ? (
        <div className="chart-card report-empty-state">
          <h3>当前范围没有记录</h3>
          <p className="muted">{summary.message}</p>
        </div>
      ) : (
        <>
          <div className="report-summary-grid">
            <div className="chart-card"><span>复盘区间</span><strong>{summary.startDate} → {summary.endDate}</strong><small>{summary.snapshotCount} 期快照</small></div>
            <div className="chart-card"><span>期初 / 期末</span><strong>{formatMoney(summary.startTotal)} → {formatMoney(summary.endTotal)}</strong><small>所选范围首尾快照</small></div>
            <div className="chart-card"><span>净资产变化</span><strong className={(summary.totalChange ?? 0) >= 0 ? 'positive' : 'negative'}>{formatMoney(summary.totalChange)}</strong><small>{formatPercent(summary.growth)}</small></div>
            <div className="chart-card"><span>风险资产占比变化</span><strong>{formatPercent(summary.riskAssetRatioChange.start)} → {formatPercent(summary.riskAssetRatioChange.end)}</strong><small>{formatPercent(summary.riskAssetRatioChange.change)}</small></div>
            <div className="chart-card"><span>负债变化</span><strong className={(summary.liabilityChange ?? 0) > 0 ? 'negative' : 'positive'}>{formatMoney(summary.startLiability)} → {formatMoney(summary.endLiability)}</strong><small>欠款 {formatMoney(summary.liabilityChange)}</small></div>
            <div className="chart-card"><span>外界收入合计</span><strong className="positive">{formatMoney(summary.externalIncomeTotal)}</strong><small>扣除收入后 {formatMoney(summary.afterIncomeChange)}</small></div>
          </div>

          <div className="report-insights">
            <div className="chart-card">
              <h3>主要增长账户 Top 3</h3>
              <div className="contribution-list">
                {(summary.topIncreases.length > 0 ? summary.topIncreases : [{ accountName: '暂无增长账户', change: 0 }]).map((row) => <div key={row.accountName}><span>{row.accountName}</span><strong className={row.change >= 0 ? 'positive' : 'negative'}>{formatMoney(row.change)}</strong></div>)}
              </div>
            </div>
            <div className="chart-card">
              <h3>主要减少账户 Top 3</h3>
              <div className="contribution-list">
                {(summary.topDecreases.length > 0 ? summary.topDecreases : [{ accountName: '暂无减少账户', change: 0 }]).map((row) => <div key={row.accountName}><span>{row.accountName}</span><strong className={row.change >= 0 ? 'positive' : 'negative'}>{formatMoney(row.change)}</strong></div>)}
              </div>
            </div>
            <div className="chart-card">
              <h3>资产结构变化</h3>
              <div className="contribution-list">
                {summary.categoryChanges.map((row) => <div key={row.category}><span>{row.category}</span><strong className={row.change >= 0 ? 'positive' : 'negative'}>{formatMoney(row.change)}</strong><small>{formatMoney(row.start)} → {formatMoney(row.end)}</small></div>)}
              </div>
            </div>
            <div className="chart-card">
              <h3>数据质量提示</h3>
              <div className="alert-list">
                {summary.dataQualityMessages.map((message) => <div className="alert warning" key={message}><span>{message}</span></div>)}
              </div>
            </div>
          </div>
        </>
      )}
      <pre className="markdown-report">{report}</pre>
    </section>
  );
}

function emptySummary(message: string) {
  return {
    status: 'empty' as const,
    message,
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
    dataQualityMessages: [message],
  };
}
