import { useMemo, useState } from 'react';
import type { AppData } from '../lib/types';
import { availableReportRanges, buildStructuredReportSummary, generateMarkdownReport, snapshotsInRange, type ReportMode } from '../lib/report';
import { formatMoney, formatPercent } from '../lib/format';

export function ReviewReport({ data }: { data: AppData }) {
  const firstDate = data.snapshots[0]?.date ?? '';
  const lastDate = data.snapshots[data.snapshots.length - 1]?.date ?? '';
  const [startDate, setStartDate] = useState(firstDate);
  const [endDate, setEndDate] = useState(lastDate);
  const [mode, setMode] = useState<ReportMode>('endpoint');
  const ranges = useMemo(() => availableReportRanges(data), [data]);
  const selectedSnapshots = useMemo(() => snapshotsInRange(data, startDate || firstDate, endDate || lastDate), [data, startDate, endDate, firstDate, lastDate]);
  const effectiveStartDate = startDate || firstDate;
  const effectiveEndDate = endDate || lastDate;
  const summary = useMemo(() => buildStructuredReportSummary(data, effectiveStartDate, effectiveEndDate, mode), [data, effectiveStartDate, effectiveEndDate, mode]);
  const report = useMemo(() => generateMarkdownReport(data, effectiveStartDate, effectiveEndDate, mode), [data, effectiveStartDate, effectiveEndDate, mode]);

  async function copyReport() {
    await navigator.clipboard.writeText(report);
  }

  return (
    <section className="panel report-view">
      <div className="section-header">
        <div>
          <h2>复盘报告</h2>
          <p>选择时间范围，生成可复制的 Markdown 资产总结。</p>
        </div>
        <div className="toolbar compact-toolbar">
          <div className="range-buttons">
            {ranges.map((range) => <button key={range.label} onClick={() => { setStartDate(range.startDate); setEndDate(range.endDate); }}>{range.label}</button>)}
          </div>
          <label>开始 <input value={startDate} onChange={(event) => setStartDate(event.target.value)} placeholder={firstDate} /></label>
          <label>结束 <input value={endDate} onChange={(event) => setEndDate(event.target.value)} placeholder={lastDate} /></label>
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
