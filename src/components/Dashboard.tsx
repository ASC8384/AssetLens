import { useState } from 'react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ComposedChart, Legend, Line, LineChart, Pie, PieChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { accountChanges, categoryTotals, totalChange, venueTotals } from '../lib/calculations';
import { accountInsightSummary, accountRankingRows, categoryChangeRows, categoryTrendData, dailyNetChangeRows, dashboardSummary, periodCashflow, riskTrendData, selectedSnapshotContext, unclassifiedSummary } from '../lib/dashboard';
import { assetCategories, categories, categoryColors, venueColors, venues } from '../lib/defaults';
import { formatMoney, formatPercent } from '../lib/format';
import { externalIncomeDateLabel } from '../lib/income';
import { analyzeStrategy } from '../lib/strategy';
import { calendarMonthRange, snapshotDateLabel } from '../lib/dates';
import type { DailyNetChangeRow } from '../lib/dashboard';
import type { ReviewRangeRequest } from '../lib/report';
import type { AppData } from '../lib/types';

export function Dashboard({ data, onOpenMonthlyReview }: { data: AppData; onOpenMonthlyReview?: (range: ReviewRangeRequest) => void }) {
  const snapshots = data.snapshots;
  const [selectedSnapshotId, setSelectedSnapshotId] = useState('');
  const { selected, previous, selectedIndex } = selectedSnapshotContext(snapshots, selectedSnapshotId);
  const isFollowingLatest = !selectedSnapshotId;
  if (!selected) {
    return <EmptyState />;
  }

  const comparisonSnapshots = previous ? [previous, selected] : [selected];
  const change = totalChange(comparisonSnapshots);
  const totals = categoryTotals(selected, data.accounts);
  const categoryData = assetCategories.map((category) => ({ name: category, value: totals[category] })).filter((item) => item.value > 0);
  const venueAmounts = venueTotals(selected, data.accounts);
  const venueData = venues.map((venue) => ({ name: venue, value: venueAmounts[venue] })).filter((item) => item.value > 0);
  const unclassified = unclassifiedSummary(selected, data.accounts);
  const trendData = categoryTrendData(data);
  const topChanges = accountChanges(comparisonSnapshots);
  const rankingRows = accountRankingRows(selected).slice(0, 8);
  const riskRows = riskTrendData(data);
  const dailyRows = dailyNetChangeRows(data);
  const categoryChanges = categoryChangeRows(previous, selected).filter((row) => row.change !== 0);
  const comparisonLabel = previous ? `${previous.date} → ${selected.date}` : `${selected.date} 无前一期`;
  const summary = dashboardSummary({ ...data, snapshots: [selected] });
  const accountInsights = accountInsightSummary(previous, selected);
  const strategy = analyzeStrategy(selected, data.strategy);
  const cashflow = periodCashflow(previous, selected, snapshots);
  const ratioBase = selected.computedGrossAssetsCny;
  const incomeStatus = cashflow.externalIncomeRecorded
    ? externalIncomeDateLabel({ amount: cashflow.externalIncome, sourceDate: selected.date, inherited: false })
    : cashflow.externalIncome === null ? null : '本期未填，按 0 计';
  const incomeHint = incomeStatus
    ? (selected.note ? `${incomeStatus} · ${selected.note}` : incomeStatus)
    : '尚未记录外界收入';

  return (
    <section className="dashboard">
      <div className="dashboard-hero dashboard-hero-v2">
        <div className="hero-copy">
          <span className="eyebrow">PORTFOLIO RADAR</span>
          <h2>{formatMoney(selected.computedTotalCny)}</h2>
          <p>{isFollowingLatest ? '最新净资产' : '选中时点'} · {selected.date}</p>
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

      {unclassified.accountCount > 0 && (
        <div className="quality-banner attention unclassified-banner">
          <strong>{unclassified.accountCount} 个账户还没归类，占总资产 {formatPercent(unclassified.ratio)}</strong>
          <span>
            下面的大类结构、风险资产占比和策略建议都会因此失真。
            展开「账户与汇率配置」勾选这些账户批量归类：{unclassified.accountNames.slice(0, 6).join('、')}
            {unclassified.accountNames.length > 6 ? ` 等 ${unclassified.accountNames.length} 个` : ''}
          </span>
        </div>
      )}

      <div className="dashboard-action-card chart-card">
        <div>
          <span className="eyebrow">MONTHLY REVIEW</span>
          <h3>本月资产复盘入口</h3>
          <p>最近一期较上一期变化 {formatMoney(change.amount)}，风险资产占比 {formatPercent(summary.riskAssetRatio)}。</p>
        </div>
        <button className="primary" onClick={() => onOpenMonthlyReview?.({ ...calendarMonthRange(selected.date), preset: 'custom' })}>生成本月复盘</button>
      </div>

      <SnapshotNavigator
        snapshots={snapshots}
        selected={selected}
        previous={previous}
        selectedIndex={selectedIndex}
        isFollowingLatest={isFollowingLatest}
        onSelect={setSelectedSnapshotId}
      />

      <div className="insight-strip">
        <div><span>主导资产</span><strong>{summary.leaderCategory ?? '—'}</strong><small>{formatMoney(summary.leaderAmount)}</small></div>
        <div><span>风险资产</span><strong>{formatPercent(summary.riskAssetRatio)}</strong><small>权益类 / 总资产</small></div>
        <div><span>负债</span><strong className={summary.liabilityAmount > 0 ? 'negative' : ''}>{formatMoney(summary.liabilityAmount)}</strong><small>信用卡等欠款</small></div>
        <div><span>选中时点</span><strong>{selected.date}</strong><small>{previous ? `对比 ${previous.date}` : '暂无前一期'}</small></div>
      </div>

      <div className="strategy-radar chart-card">
        <div>
          <h3>策略雷达</h3>
          <p>应急备用金：{strategy.cashReserveGap >= 0 ? '已达标' : `缺口 ${formatMoney(Math.abs(strategy.cashReserveGap))}`} · 风险资产：{strategy.riskStatus === 'above' ? '高于上限' : strategy.riskStatus === 'below' ? '低于下限' : '目标区间内'}</p>
        </div>
        <ul>
          {(strategy.suggestions.length > 0 ? strategy.suggestions : ['当前资产结构落在策略目标内。']).slice(0, 4).map((item) => <li key={item}>{item}</li>)}
        </ul>
      </div>

      <div className="metric-grid">
        <Metric title="净资产" value={formatMoney(selected.computedTotalCny)} hint="总资产 − 负债" />
        <Metric title="总资产" value={formatMoney(selected.computedGrossAssetsCny)} hint="不含信用卡等欠款" />
        <Metric title="负债" value={formatMoney(selected.computedLiabilityCny)} hint="欠款按正数记录" tone={selected.computedLiabilityCny > 0 ? 'negative' : undefined} />
        <Metric title="账户数" value={`${selected.entries.length}`} hint="当前时点账户数量" />
      </div>

      <div className="insight-strip cashflow-strip">
        <div><span>较上一期净资产</span><strong className={(cashflow.netChange ?? 0) >= 0 ? 'positive' : 'negative'}>{formatMoney(cashflow.netChange)}</strong><small>{comparisonLabel}</small></div>
        <div><span>本期外界收入</span><strong className="positive">{formatMoney(cashflow.externalIncome)}</strong><small>{incomeHint}</small></div>
        <div><span>扣除收入后变化</span><strong className={(cashflow.afterIncomeChange ?? 0) >= 0 ? 'positive' : 'negative'}>{formatMoney(cashflow.afterIncomeChange)}</strong><small>剩余部分含理财与支出</small></div>
      </div>

      <div className="chart-grid main-charts dashboard-feature-grid">
        <ChartCard title="净资产趋势（含分资产）" className="feature-chart">
          <ResponsiveContainer width="100%" height={340}>
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis tickFormatter={(value) => `${Math.round(Number(value) / 10000)}万`} />
              <Tooltip formatter={(value) => formatMoney(Number(value))} />
              <Legend />
              <Line type="monotone" dataKey="total" name="净资产" stroke="#0f172a" strokeWidth={3} dot={{ r: 3 }} />
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
            {categoryData.map((item) => <span key={item.name}><i style={{ background: categoryColors[item.name as keyof typeof categoryColors] }} />{item.name} {formatPercent(ratioBase === 0 ? null : item.value / ratioBase)}</span>)}
          </div>
        </ChartCard>
      </div>

      <div className="chart-grid tertiary-charts">
        <ChartCard title="区间日均资产净增">
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={dailyRows} margin={{ left: 8, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="endDate" />
              <YAxis tickFormatter={(value) => `${Math.round(Number(value))}/日`} />
              <Tooltip content={<DailyNetChangeTooltip />} />
              <Legend />
              <ReferenceLine y={0} stroke="#98a2b3" strokeDasharray="4 4" />
              <Line type="monotone" dataKey="dailyChange" name="日均净增" stroke="#2266ff" strokeWidth={3} dot={{ r: 4 }} />
              <Line type="monotone" dataKey="amortizedDailyChange" name="收入摊平后日均" stroke="#d9822b" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="afterIncomeDailyChange" name="扣除外界收入后日均" stroke="#12b8a6" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="稳健池 vs 权益类趋势">
          <ResponsiveContainer width="100%" height={260}>
            <ComposedChart data={riskRows}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis tickFormatter={(value) => `${Math.round(Number(value) / 10000)}万`} />
              <Tooltip formatter={(value) => formatMoney(Number(value))} />
              <Legend />
              <Area type="monotone" dataKey="safe" name="纯现金 + 稳健类" fill="#12b8a6" stroke="#12b8a6" fillOpacity={0.16} />
              <Line type="monotone" dataKey="risk" name="权益类" stroke="#d9822b" strokeWidth={3} dot={false} />
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
        <ChartCard title="账户洞察" className="account-insight-card">
          <div className="account-insight-grid">
            <div>
              <h4>增长账户 Top 5</h4>
              <div className="contribution-list">
                {(accountInsights.topIncreases.length > 0 ? accountInsights.topIncreases : [{ accountName: '暂无增长账户', change: 0 }]).map((row) => <div key={row.accountName}><span>{row.accountName}</span><strong className="positive">{formatMoney(row.change)}</strong></div>)}
              </div>
            </div>
            <div>
              <h4>下降账户 Top 5</h4>
              <div className="contribution-list">
                {(accountInsights.topDecreases.length > 0 ? accountInsights.topDecreases : [{ accountName: '暂无下降账户', change: 0 }]).map((row) => <div key={row.accountName}><span>{row.accountName}</span><strong className="negative">{formatMoney(row.change)}</strong></div>)}
              </div>
            </div>
            <div>
              <h4>账户集中度</h4>
              <strong>{formatPercent(accountInsights.concentrationRatio)}</strong>
              <small>当前 Top 3 账户占总资产比例</small>
            </div>
            <div>
              <h4>账户变化</h4>
              <small>新增：{accountInsights.newAccounts.length > 0 ? accountInsights.newAccounts.join('、') : '无'}</small>
              <small>消失：{accountInsights.removedAccounts.length > 0 ? accountInsights.removedAccounts.join('、') : '无'}</small>
            </div>
          </div>
        </ChartCard>

        <ChartCard title="大类资产堆叠趋势">
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis tickFormatter={(value) => `${Math.round(Number(value) / 10000)}万`} />
              <Tooltip formatter={(value) => formatMoney(Number(value))} />
              <Legend />
              {assetCategories.map((category) => <Area key={category} type="monotone" dataKey={category} stackId="1" stroke={categoryColors[category]} fill={categoryColors[category]} />)}
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title={`渠道结构 · ${selected.date}`} className="structure-card">
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={venueData} dataKey="value" nameKey="name" innerRadius={46} outerRadius={76} paddingAngle={4}>
                {venueData.map((item) => <Cell key={item.name} fill={venueColors[item.name]} />)}
              </Pie>
              <Tooltip formatter={(value) => formatMoney(Number(value))} />
            </PieChart>
          </ResponsiveContainer>
          <div className="legend-list">
            {venueData.map((item) => <span key={item.name}><i style={{ background: venueColors[item.name] }} />{item.name} {formatPercent(ratioBase === 0 ? null : item.value / ratioBase)}</span>)}
          </div>
          <p className="chart-note">渠道和风险大类是两条独立的维度：同一渠道里可以有不同风险的资产。</p>
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
      </div>
    </section>
  );
}

function SnapshotNavigator({
  snapshots,
  selected,
  previous,
  selectedIndex,
  isFollowingLatest,
  onSelect,
}: {
  snapshots: AppData['snapshots'];
  selected: AppData['snapshots'][number];
  previous: AppData['snapshots'][number] | undefined;
  selectedIndex: number;
  isFollowingLatest: boolean;
  onSelect: (snapshotId: string) => void;
}) {
  const yearGroups = groupSnapshotsByYear(snapshots);

  return (
    <div className="snapshot-navigator chart-card">
      <div className="snapshot-navigator-header">
        <div>
          <span className="eyebrow">TIMEPOINT</span>
          <h3>查看时点</h3>
          <p>{isFollowingLatest ? '正在看最新一期' : '正在看选中时点'} · {snapshotDateLabel(snapshots, selected)}</p>
          <p className="snapshot-navigator-meta">
            <span className="snapshot-count-pill">{selectedIndex + 1} / {snapshots.length}</span>
            {previous ? `对比上一期 ${previous.date}` : '暂无前一期'}
          </p>
        </div>
        <div className="snapshot-navigator-actions">
          <button disabled={selectedIndex <= 0} onClick={() => onSelect(snapshots[selectedIndex - 1]?.id ?? '')}>上一期</button>
          <button disabled={selectedIndex >= snapshots.length - 1} onClick={() => onSelect(snapshots[selectedIndex + 1]?.id ?? '')}>下一期</button>
          <button className="snapshot-latest-button" disabled={isFollowingLatest} onClick={() => onSelect('')}>最新一期</button>
        </div>
      </div>
      {yearGroups.map((group) => (
        <div className="snapshot-year-group" key={group.year}>
          <span>{group.year} 年</span>
          <div className="snapshot-points" aria-label={`${group.year} 年快照`}>
            {group.items.map((snapshot) => {
              const extra = snapshotDateExtra(snapshots, snapshot);
              const parts = snapshotChipParts(snapshot.date);
              return (
                <button
                  key={snapshot.id}
                  className={snapshot.id === selected.id ? 'active' : ''}
                  aria-current={snapshot.id === selected.id ? 'true' : undefined}
                  aria-label={snapshotDateLabel(snapshots, snapshot)}
                  onClick={() => onSelect(snapshot.id)}
                >
                  <i className="snapshot-point-dot" aria-hidden="true" />
                  {parts ? (
                    <span className="snapshot-point-text">
                      <small>{parts.month}</small>
                      <strong>{parts.day}</strong>
                    </span>
                  ) : (
                    <strong>{snapshot.date}</strong>
                  )}
                  {extra ? <small className="snapshot-point-extra">{extra}</small> : null}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function groupSnapshotsByYear<T extends { date: string }>(snapshots: T[]): Array<{ year: string; items: T[] }> {
  const groups: Array<{ year: string; items: T[] }> = [];
  for (const snapshot of snapshots) {
    const year = snapshot.date.slice(0, 4);
    const current = groups[groups.length - 1];
    if (current?.year === year) current.items.push(snapshot);
    else groups.push({ year, items: [snapshot] });
  }
  return groups;
}

function snapshotChipParts(date: string): { month: string; day: string } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) return null;
  return { month: `${Number(match[2])}月`, day: match[3] };
}

function snapshotDateExtra(snapshots: AppData['snapshots'], snapshot: AppData['snapshots'][number]): string | null {
  const label = snapshotDateLabel(snapshots, snapshot);
  return label === snapshot.date ? null : label.replace(`${snapshot.date} · `, '');
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

type TooltipPayload = {
  payload?: DailyNetChangeRow;
};

function DailyNetChangeTooltip({ active, payload }: { active?: boolean; payload?: TooltipPayload[] }) {
  const row = payload?.[0]?.payload;
  if (!active || !row) return null;

  return (
    <div className="custom-tooltip">
      <strong>{row.startDate} → {row.endDate}</strong>
      <span>{row.days} 天</span>
      <span>总变化：{formatMoney(row.totalChange)}</span>
      <span>日均净增：{formatMoney(row.dailyChange)}</span>
      <span>外界收入：{row.externalIncome === null ? '尚未开始记录' : formatMoney(row.externalIncome)}{row.externalIncome !== null && !row.externalIncomeRecorded ? '（本期未填）' : ''}</span>
      <span>扣除外界收入后日均：{formatMoney(row.afterIncomeDailyChange)}</span>
      <span>收入摊平后日均：{formatMoney(row.amortizedDailyChange)}{row.amortizedDailyIncome === null ? '' : `（每日收入 ${formatMoney(row.amortizedDailyIncome)}）`}</span>
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
