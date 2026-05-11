import { useMemo, useState } from 'react';
import type { AppData } from '../lib/types';
import { accountContributionRows, availableReportRanges, generateMarkdownReport, snapshotsInRange, type ReportMode } from '../lib/report';
import { categoryTotals } from '../lib/calculations';
import { categories } from '../lib/defaults';
import { formatMoney } from '../lib/format';

export function ReviewReport({ data }: { data: AppData }) {
  const firstDate = data.snapshots[0]?.date ?? '';
  const lastDate = data.snapshots[data.snapshots.length - 1]?.date ?? '';
  const [startDate, setStartDate] = useState(firstDate);
  const [endDate, setEndDate] = useState(lastDate);
  const [mode, setMode] = useState<ReportMode>('endpoint');
  const ranges = useMemo(() => availableReportRanges(data), [data]);
  const selectedSnapshots = useMemo(() => snapshotsInRange(data, startDate || firstDate, endDate || lastDate), [data, startDate, endDate, firstDate, lastDate]);
  const first = selectedSnapshots[0];
  const last = selectedSnapshots[selectedSnapshots.length - 1];
  const contributions = first && last ? accountContributionRows(first, last).slice(0, 8) : [];
  const report = useMemo(() => generateMarkdownReport(data, startDate || firstDate, endDate || lastDate, mode), [data, startDate, endDate, mode, firstDate, lastDate]);

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
      {first && last && (
        <div className="report-insights">
          <div className="chart-card">
            <h3>账户贡献榜</h3>
            <div className="contribution-list">
              {contributions.map((row) => <div key={row.accountName}><span>{row.accountName}</span><strong className={row.change >= 0 ? 'positive' : 'negative'}>{formatMoney(row.change)}</strong></div>)}
            </div>
          </div>
          <div className="chart-card">
            <h3>资产结构变化</h3>
            <div className="contribution-list">
              {categories.map((category) => {
                const start = categoryTotals(first, data.accounts)[category];
                const end = categoryTotals(last, data.accounts)[category];
                return <div key={category}><span>{category}</span><strong className={end - start >= 0 ? 'positive' : 'negative'}>{formatMoney(end - start)}</strong></div>;
              })}
            </div>
          </div>
        </div>
      )}
      <pre className="markdown-report">{report}</pre>
    </section>
  );
}
