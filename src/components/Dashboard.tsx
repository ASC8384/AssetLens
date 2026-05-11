import { useState } from 'react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ComposedChart, Legend, Line, LineChart, Pie, PieChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { accountChanges, categoryTotals, totalChange } from '../lib/calculations';
import { accountRankingRows, categoryChangeRows, categoryTrendData, dashboardSummary, riskTrendData, selectedSnapshotContext, totalQuality } from '../lib/dashboard';
import { categories, categoryColors } from '../lib/defaults';
import { formatMoney, formatPercent } from '../lib/format';
import type { AppData } from '../lib/types';

export function Dashboard({ data }: { data: AppData }) {
  const snapshots = data.snapshots;
  const [selectedDate, setSelectedDate] = useState('');
  const { selected, previous } = selectedSnapshotContext(snapshots, selectedDate);
  if (!selected) {
    return <EmptyState />;
  }

  const comparisonSnapshots = previous ? [previous, selected] : [selected];
  const change = totalChange(comparisonSnapshots);
  const totals = categoryTotals(selected, data.accounts);
  const categoryData = categories.map((category) => ({ name: category, value: totals[category] })).filter((item) => item.value > 0);
  const trendData = categoryTrendData(data);
  const topChanges = accountChanges(comparisonSnapshots);
  const rankingRows = accountRankingRows(selected).slice(0, 8);
  const riskRows = riskTrendData(data);
  const categoryChanges = categoryChangeRows(previous, selected).filter((row) => row.change !== 0);
  const comparisonLabel = previous ? `${previous.date} → ${selected.date}` : `${selected.date} 无前一期`;
  const summary = dashboardSummary({ ...data, snapshots: [selected] });
  const quality = totalQuality(selected);

  return (
    <section className="dashboard">
      <div className="dashboard-hero dashboard-hero-v2">
        <div className="hero-copy">
          <span className="eyebrow">PORTFOLIO RADAR</span>
          <h2>{formatMoney(selected.computedTotalCny)}</h2>
          <p>{selectedDate ? '选中时点' : '最新净资产'} · {selected.date}</p>
        </div>
        <div className="hero-orbit" aria-hidden="true">
          <span className="orbit-ring ring-one" />
          <span className="orbit-ring ring-two" />
          <span className="orbit-dot" />
          <strong>{formatPercent(summary.riskAssetRatio)}</strong>
          <small>风险资产占比</small>
        </div>
        <div className="hero-delta">
          <span>较上一期</span>
          <strong className={(change.amount ?? 0) >= 0 ? 'positive' : 'negative'}>{formatMoney(change.amount)}</strong>
          <small>{formatPercent(change.percent)}</small>
        </div>
      </div>

      <div className="dashboard-timebar">
        <label>查看时间节点
          <select value={selected?.date ?? ''} onChange={(event) => setSelectedDate(event.target.value)}>
            {snapshots.map((snapshot) => <option key={snapshot.id} value={snapshot.date}>{snapshot.date}</option>)}
          </select>
        </label>
        <button onClick={() => setSelectedDate(snapshots[snapshots.length - 1]?.date ?? '')}>跳到最新</button>
      </div>

      <div className="insight-strip">
        <div><span>主导资产</span><strong>{summary.leaderCategory ?? '—'}</strong><small>{formatMoney(summary.leaderAmount)}</small></div>
        <div><span>风险资产</span><strong>{formatPercent(summary.riskAssetRatio)}</strong><small>基金 + 证券</small></div>
        <div><span>数据质量</span><strong>{quality.status === 'danger' ? '需检查' : '正常'}</strong><small>{quality.message}</small></div>
      </div>

      <div className="metric-grid">
        <Metric title="网页重算总资产" value={formatMoney(selected.computedTotalCny)} hint={selected.date} />
        <Metric title="Excel 原合计" value={formatMoney(selected.excelTotal)} hint="仅作为导入对照" tone={quality.status === 'danger' ? 'negative' : undefined} />
        <Metric title="较上一期变化" value={formatMoney(change.amount)} hint="金额变化" tone={(change.amount ?? 0) >= 0 ? 'positive' : 'negative'} />
        <Metric title="较上一期变化率" value={formatPercent(change.percent)} hint="百分比变化" tone={(change.percent ?? 0) >= 0 ? 'positive' : 'negative'} />
      </div>

      {quality.status === 'danger' && (
        <div className="quality-banner danger">
          <strong>合计列可能识别错：</strong>{quality.message} 当前差异 {formatMoney(quality.diff)}，建议在导入映射里把“合计”改成“忽略”或修正数据源。
        </div>
      )}

      <div className="chart-grid main-charts dashboard-feature-grid">
        <ChartCard title="总资产趋势（含分资产）" className="feature-chart">
          <ResponsiveContainer width="100%" height={340}>
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis tickFormatter={(value) => `${Math.round(Number(value) / 10000)}万`} />
              <Tooltip formatter={(value) => formatMoney(Number(value))} />
              <Legend />
              <Line type="monotone" dataKey="total" name="总资产" stroke="#0f172a" strokeWidth={3} dot={{ r: 3 }} />
              {categories.map((category) => (
                <Line key={category} type="monotone" dataKey={category} name={category} stroke={categoryColors[category]} strokeWidth={2} dot={false} />
              ))}
              <ReferenceLine x={selected.date} stroke="#d9822b" strokeDasharray="4 4" label="选中" />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title={`选中时点资产结构 · ${selected.date}`} className="structure-card">
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={categoryData} dataKey="value" nameKey="name" innerRadius={58} outerRadius={92} paddingAngle={4}>
                {categoryData.map((item) => <Cell key={item.name} fill={categoryColors[item.name as keyof typeof categoryColors]} />)}
              </Pie>
              <Tooltip formatter={(value) => formatMoney(Number(value))} />
            </PieChart>
          </ResponsiveContainer>
          <div className="legend-list">
            {categoryData.map((item) => <span key={item.name}><i style={{ background: categoryColors[item.name as keyof typeof categoryColors] }} />{item.name} {formatPercent(item.value / selected.computedTotalCny)}</span>)}
          </div>
        </ChartCard>
      </div>

      <div className="chart-grid tertiary-charts">
        <ChartCard title="现金 vs 风险资产趋势">
          <ResponsiveContainer width="100%" height={260}>
            <ComposedChart data={riskRows}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis tickFormatter={(value) => `${Math.round(Number(value) / 10000)}万`} />
              <Tooltip formatter={(value) => formatMoney(Number(value))} />
              <Legend />
              <Area type="monotone" dataKey="safe" name="现金/银行卡" fill="#12b8a6" stroke="#12b8a6" fillOpacity={0.16} />
              <Line type="monotone" dataKey="risk" name="基金/证券" stroke="#d9822b" strokeWidth={3} dot={false} />
              <ReferenceLine x={selected.date} stroke="#d9822b" strokeDasharray="4 4" />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title={`选中时点账户排行 · ${selected.date}`}>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={rankingRows} layout="vertical" margin={{ left: 20, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" tickFormatter={(value) => `${Math.round(Number(value) / 10000)}万`} />
              <YAxis type="category" dataKey="accountName" width={92} />
              <Tooltip formatter={(value) => formatMoney(Number(value))} />
              <Bar dataKey="amount" name="账户金额" fill="#10233f" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title={`大类结构变化 · ${comparisonLabel}`}>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={categoryChanges} margin={{ left: 8, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="category" />
              <YAxis tickFormatter={(value) => `${Math.round(Number(value) / 10000)}万`} />
              <Tooltip formatter={(value) => formatMoney(Number(value))} />
              <Bar dataKey="change" name="变化金额" fill="#2266ff" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="chart-grid secondary-charts">
        <ChartCard title="大类资产堆叠趋势">
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis tickFormatter={(value) => `${Math.round(Number(value) / 10000)}万`} />
              <Tooltip formatter={(value) => formatMoney(Number(value))} />
              <Legend />
              {categories.map((category) => <Area key={category} type="monotone" dataKey={category} stackId="1" stroke={categoryColors[category]} fill={categoryColors[category]} />)}
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title={`账户金额变化 Top 5 · ${comparisonLabel}`}>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={topChanges} layout="vertical" margin={{ left: 20, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis type="category" dataKey="accountName" width={90} />
              <Tooltip formatter={(value) => formatMoney(Number(value))} />
              <Bar dataKey="change" name="变化金额" fill="#2563eb" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="导入质量提示">
          <div className="alert-list">
            <div className={`alert ${quality.status === 'danger' ? 'danger' : 'warning'}`}>
              <strong>{quality.status === 'danger' ? '合计差异过大' : '合计对照'}</strong>
              <span>{formatMoney(quality.diff)}</span>
            </div>
            <p className="muted">占比列已默认忽略，页面中的占比全部由金额重新计算。</p>
          </div>
        </ChartCard>
      </div>
    </section>
  );
}

function Metric({ title, value, hint, tone }: { title: string; value: string; hint: string; tone?: 'positive' | 'negative' }) {
  return (
    <div className="metric-card">
      <span>{title}</span>
      <strong className={tone}>{value}</strong>
      <small>{hint}</small>
    </div>
  );
}

function ChartCard({ title, children, className = '' }: { title: string; children: React.ReactNode; className?: string }) {
  return <div className={`chart-card ${className}`}><h3>{title}</h3>{children}</div>;
}

function EmptyState() {
  return (
    <section className="panel empty-state">
      <h2>还没有资产数据</h2>
      <p>请先上传 Excel、粘贴表格文本，或点击“载入示例数据”查看效果。</p>
    </section>
  );
}
