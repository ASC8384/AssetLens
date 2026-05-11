import { useMemo, useState } from 'react';
import type { AppData } from '../lib/types';
import { generateMarkdownReport, type ReportMode } from '../lib/report';

export function ReviewReport({ data }: { data: AppData }) {
  const firstDate = data.snapshots[0]?.date ?? '';
  const lastDate = data.snapshots[data.snapshots.length - 1]?.date ?? '';
  const [startDate, setStartDate] = useState(firstDate);
  const [endDate, setEndDate] = useState(lastDate);
  const [mode, setMode] = useState<ReportMode>('endpoint');
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
          <label>开始 <input value={startDate} onChange={(event) => setStartDate(event.target.value)} placeholder={firstDate} /></label>
          <label>结束 <input value={endDate} onChange={(event) => setEndDate(event.target.value)} placeholder={lastDate} /></label>
          <select value={mode} onChange={(event) => setMode(event.target.value as ReportMode)}>
            <option value="endpoint">期初 vs 期末</option>
            <option value="periodic">逐期变化</option>
          </select>
          <button onClick={copyReport}>复制 Markdown</button>
        </div>
      </div>
      <pre className="markdown-report">{report}</pre>
    </section>
  );
}
