import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { accountChanges, categoryTotals, totalChange } from '../lib/calculations';
import { categoryTrendData, totalQuality } from '../lib/dashboard';
import { categories, categoryColors } from '../lib/defaults';
import { formatMoney, formatPercent } from '../lib/format';
import type { AppData } from '../lib/types';

export function Dashboard({ data }: { data: AppData }) {
  const snapshots = data.snapshots;
  const latest = snapshots[snapshots.length - 1];
  const change = totalChange(snapshots);
  const totals = categoryTotals(latest, data.accounts);
  const categoryData = categories.map((category) => ({ name: category, value: totals[category] })).filter((item) => item.value > 0);
  const trendData = categoryTrendData(data);
  const topChanges = accountChanges(snapshots);
  const quality = totalQuality(latest);

  if (!latest) {
    return <EmptyState />;
  }

  return (
    <section className="dashboard">
      <div className="dashboard-hero">
        <div>
          <span className="eyebrow">PORTFOLIO RADAR</span>
          <h2>{formatMoney(latest.computedTotalCny)}</h2>
          <p>最新净资产 · {latest.date}</p>
        </div>
        <div className="hero-delta">
          <span>较上一期</span>
          <strong className={(change.amount ?? 0) >= 0 ? 'positive' : 'negative'}>{formatMoney(change.amount)}</strong>
          <small>{formatPercent(change.percent)}</small>
        </div>
      </div>

      <div className="metric-grid">
        <Metric title="网页重算总资产" value={formatMoney(latest.computedTotalCny)} hint={latest.date} />
        <Metric title="Excel 原合计" value={formatMoney(latest.excelTotal)} hint="仅作为导入对照" tone={quality.status === 'danger' ? 'negative' : undefined} />
        <Metric title="较上一期变化" value={formatMoney(change.amount)} hint="金额变化" tone={(change.amount ?? 0) >= 0 ? 'positive' : 'negative'} />
        <Metric title="较上一期变化率" value={formatPercent(change.percent)} hint="百分比变化" tone={(change.percent ?? 0) >= 0 ? 'positive' : 'negative'} />
      </div>

      {quality.status === 'danger' && (
        <div className="quality-banner danger">
          <strong>合计列可能识别错：</strong>{quality.message} 当前差异 {formatMoney(quality.diff)}，建议在导入映射里把“合计”改成“忽略”或修正数据源。
        </div>
      )}

      <div className="chart-grid main-charts">
        <ChartCard title="总资产趋势（含分资产）">
          <ResponsiveContainer width="100%" height={280}>
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
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="最新资产结构">
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={categoryData} dataKey="value" nameKey="name" innerRadius={58} outerRadius={92} paddingAngle={4}>
                {categoryData.map((item) => <Cell key={item.name} fill={categoryColors[item.name as keyof typeof categoryColors]} />)}
              </Pie>
              <Tooltip formatter={(value) => formatMoney(Number(value))} />
            </PieChart>
          </ResponsiveContainer>
          <div className="legend-list">
            {categoryData.map((item) => <span key={item.name}><i style={{ background: categoryColors[item.name as keyof typeof categoryColors] }} />{item.name} {formatPercent(item.value / latest.computedTotalCny)}</span>)}
          </div>
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

        <ChartCard title="账户金额变化 Top 5">
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

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="chart-card"><h3>{title}</h3>{children}</div>;
}

function EmptyState() {
  return (
    <section className="panel empty-state">
      <h2>还没有资产数据</h2>
      <p>请先上传 Excel、粘贴表格文本，或点击“载入示例数据”查看效果。</p>
    </section>
  );
}
