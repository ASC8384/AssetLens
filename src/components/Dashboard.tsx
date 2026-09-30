import { useState } from 'react';
import { Area, AreaChart, Bar, BarChart, Brush, CartesianGrid, Cell, ComposedChart, Label, Line, LineChart, Pie, PieChart, ReferenceLine, Tooltip, XAxis, YAxis, type MouseHandlerDataParam } from 'recharts';
import { categoryTotals, isLiabilityCategory, totalChange, venueTotals } from '../lib/calculations';
import { accountChangeRows, accountInsightSummary, accountRankingRows, categoryChangeRows, categoryTrendData, dailyNetChangeRows, dashboardSummary, periodCashflow, riskTrendData, selectedSnapshotContext, unclassifiedSummary } from '../lib/dashboard';
import { assetCategories, categories, categoryColors, venueColors, venues } from '../lib/defaults';
import { formatCompactNumber, formatMoney, formatPercent } from '../lib/format';
import { intervalExternalIncomeLabel } from '../lib/income';
import { analyzeStrategy } from '../lib/strategy';
import { calendarMonthRange, snapshotDateLabel } from '../lib/dates';
import { ChartCard, type ChartLegendItem } from './ChartCard';
import type { DailyNetChangeRow } from '../lib/dashboard';
import type { ReviewRangeRequest } from '../lib/report';
import type { AppData, AssetCategory } from '../lib/types';

const axisTick = { fill: '#667085', fontSize: 12 };
const gridStroke = 'rgba(16,35,63,.1)';
const selectedMarkerColor = '#475467';
const barCursor = { fill: 'rgba(16,35,63,.05)' };
const chartMargin = { top: 20, right: 16, left: 0, bottom: 0 };
const barChartMargin = { top: 4, right: 24, left: 4, bottom: 0 };

type DailySeriesKey = 'dailyChange' | 'amortizedDailyChange' | 'afterIncomeDailyChange';
const dailySeries: Array<ChartLegendItem & { key: DailySeriesKey }> = [
  { key: 'dailyChange', label: '日均净增', color: '#2266ff' },
  { key: 'amortizedDailyChange', label: '收入摊平后日均', color: '#d9822b' },
  { key: 'afterIncomeDailyChange', label: '扣除外界收入后日均', color: '#12b8a6' },
];

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
  const rankingRows = accountRankingRows(selected, data.accounts);
  const riskRows = riskTrendData(data);
  const dailyRows = dailyNetChangeRows(data);
  const categoryImpactRows = categoryChangeRows(previous, selected, data.accounts)
    .filter((row) => row.change !== 0)
    .map((row) => ({ ...row, impact: isLiabilityCategory(row.category) ? -row.change : row.change }));
  const accountImpactRows = accountChangeRows(previous, selected, data.accounts);
  const comparisonLabel = previous ? `${previous.date} → ${selected.date}` : `${selected.date} 无前一期`;
  const summary = dashboardSummary({ ...data, snapshots: [selected] });
  const accountInsights = accountInsightSummary(previous, selected, data.accounts);
  const strategy = analyzeStrategy(selected, data.strategy);
  const cashflow = periodCashflow(previous, selected, snapshots);
  const ratioBase = selected.computedGrossAssetsCny;
  const shareOfAssets = (value: number) => formatPercent(ratioBase === 0 ? null : value / ratioBase);
  const incomeStatus = intervalExternalIncomeLabel({ amount: cashflow.externalIncome, recorded: cashflow.externalIncomeRecorded }, selected.date);
  const incomeHint = incomeStatus
    ? (selected.note ? `${incomeStatus} · ${selected.note}` : incomeStatus)
    : '尚未记录外界收入';

  const snapshotById = new Map(snapshots.map((snapshot) => [snapshot.id, snapshot]));
  const snapshotAxisDate = (id: unknown) => snapshotById.get(String(id))?.date ?? String(id);
  const snapshotTooltipLabel = (id: unknown) => {
    const snapshot = snapshotById.get(String(id));
    return snapshot ? snapshotDateLabel(snapshots, snapshot) : String(id);
  };
  const selectSnapshotFromChart = (state: MouseHandlerDataParam) => {
    const id = String(state.activeLabel ?? '');
    if (snapshotById.has(id)) setSelectedSnapshotId(id);
  };
  const hasValue = (key: string) => trendData.some((row) => Number(row[key] ?? 0) !== 0);
  const trendLegend: ChartLegendItem[] = [
    { key: 'total', label: '净资产', color: '#10233f' },
    ...categories.filter(hasValue).map((category) => ({ key: category, label: category, color: categoryColors[category] })),
  ];
  const stackLegend: ChartLegendItem[] = assetCategories.filter(hasValue).map((category) => ({ key: category, label: category, color: categoryColors[category] }));
  const riskLegend: ChartLegendItem[] = [
    { key: 'safe', label: '纯现金 + 稳健类', color: '#12b8a6' },
    { key: 'risk', label: '权益类', color: categoryColors['权益类'] },
  ];
  const dailyLegend = dailySeries.filter((series) => dailyRows.some((row) => row[series.key] !== null));
  const categoryLegend: ChartLegendItem[] = categoryData.map((item) => ({ key: item.name, label: item.name, color: categoryColors[item.name], detail: shareOfAssets(item.value) }));
  const venueLegend: ChartLegendItem[] = venueData.map((item) => ({ key: item.name, label: item.name, color: venueColors[item.name], detail: shareOfAssets(item.value) }));
  const categoryImpactLegend: ChartLegendItem[] = categoryImpactRows.map((row) => ({ key: row.category, label: row.category, color: categoryColors[row.category], detail: signedCompact(row.impact) }));
  const selectedHasInterval = dailyRows.some((row) => row.endDate === selected.date);
  const timeSeriesHint = '拖动底部滑块可只看一段时间，点图上任一日期可切换查看时点';
  const noPreviousMessage = '这是第一期快照，没有上一期可对比。';
  const selectedMarker = (x: string) => (
    <ReferenceLine x={x} stroke={selectedMarkerColor} strokeDasharray="4 4" label={{ value: '选中', position: 'top', fill: selectedMarkerColor, fontSize: 12 }} />
  );
  const timeAxis = <XAxis dataKey="id" tickFormatter={snapshotAxisDate} tick={axisTick} tickMargin={8} minTickGap={18} />;
  const moneyAxis = <YAxis tickFormatter={axisMoney} tick={axisTick} width={56} axisLine={false} tickLine={false} />;
  const brush = (expanded: boolean, rowCount: number, dataKey: 'date' | 'endDate') => (expanded && rowCount > 2
    ? <Brush dataKey={dataKey} height={28} travellerWidth={10} stroke="#10233f" fill="rgba(255,255,255,.7)" />
    : null);

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

      <p className="chart-section-hint">点图例可暂时隐藏对应项目，再点一次恢复；点图表右上角「放大」看大图。趋势图上点任一日期可切换查看时点。</p>

      <div className="chart-grid main-charts dashboard-feature-grid">
        <ChartCard title="净资产趋势（含分资产）" className="feature-chart" height={340} legend={trendLegend} expandedHint={timeSeriesHint}>
          {({ expanded, isVisible }) => (
            <LineChart data={trendData} margin={chartMargin} onClick={selectSnapshotFromChart} style={{ cursor: 'pointer' }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
              {timeAxis}
              {moneyAxis}
              <Tooltip formatter={tooltipMoney} labelFormatter={snapshotTooltipLabel} />
              {trendLegend.filter((series) => isVisible(series.key)).map((series) => (
                series.key === 'total'
                  ? <Line key={series.key} type="monotone" dataKey="total" name="净资产" stroke={series.color} strokeWidth={3} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                  : <Line key={series.key} type="monotone" dataKey={series.key} name={series.label} stroke={series.color} strokeWidth={2} dot={expanded ? { r: 2 } : false} />
              ))}
              {selectedMarker(selected.id)}
              {brush(expanded, trendData.length, 'date')}
            </LineChart>
          )}
        </ChartCard>

        <ChartCard title={`选中时点资产结构 · ${selected.date}`} className="structure-card" height={260} legend={categoryLegend} emptyMessage={categoryData.length === 0 ? '该时点没有正资产。' : undefined}>
          {({ expanded, isVisible }) => {
            const visible = categoryData.filter((item) => isVisible(item.name));
            return (
              <PieChart>
                <Pie data={visible} dataKey="value" nameKey="name" innerRadius="56%" outerRadius="82%" paddingAngle={3} label={expanded ? pieSliceLabel : false} labelLine={expanded}>
                  {visible.map((item) => <Cell key={item.name} fill={categoryColors[item.name]} />)}
                  <Label position="center" content={<PieCenterLabel caption={visible.length === categoryData.length ? '总资产' : '已选合计'} value={sumValues(visible)} />} />
                </Pie>
                <Tooltip formatter={(value, name) => [`${formatMoney(Number(value))} · 占总资产 ${shareOfAssets(Number(value))}`, name]} />
              </PieChart>
            );
          }}
        </ChartCard>
      </div>

      <div className="chart-grid tertiary-charts">
        <ChartCard title="区间日均资产净增" height={260} legend={dailyLegend} expandedHint="拖动底部滑块可只看一段时间" emptyMessage={dailyRows.length === 0 ? '至少需要两期不同日期的快照，才能算区间日均净增。' : undefined}>
          {({ expanded, isVisible }) => (
            <LineChart data={dailyRows} margin={chartMargin}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
              <XAxis dataKey="endDate" tick={axisTick} tickMargin={8} minTickGap={18} />
              <YAxis tickFormatter={(value) => `${formatCompactNumber(Number(value))}/日`} tick={axisTick} width={64} axisLine={false} tickLine={false} />
              <Tooltip content={<DailyNetChangeTooltip />} />
              <ReferenceLine y={0} stroke="#98a2b3" strokeDasharray="4 4" />
              {selectedHasInterval ? selectedMarker(selected.date) : null}
              {dailyLegend.filter((series) => isVisible(series.key)).map((series) => (
                <Line key={series.key} type="monotone" dataKey={series.key} name={series.label} stroke={series.color} strokeWidth={series.key === 'dailyChange' ? 3 : 2} dot={{ r: series.key === 'dailyChange' ? 4 : 3 }} />
              ))}
              {brush(expanded, dailyRows.length, 'endDate')}
            </LineChart>
          )}
        </ChartCard>

        <ChartCard title="稳健池 vs 权益类趋势" height={260} legend={riskLegend} expandedHint={timeSeriesHint}>
          {({ expanded, isVisible }) => (
            <ComposedChart data={riskRows} margin={chartMargin} onClick={selectSnapshotFromChart} style={{ cursor: 'pointer' }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
              {timeAxis}
              {moneyAxis}
              <Tooltip formatter={tooltipMoney} labelFormatter={snapshotTooltipLabel} />
              {isVisible('safe') ? <Area type="monotone" dataKey="safe" name="纯现金 + 稳健类" fill="#12b8a6" stroke="#12b8a6" fillOpacity={0.16} strokeWidth={2} /> : null}
              {isVisible('risk') ? <Line type="monotone" dataKey="risk" name="权益类" stroke={categoryColors['权益类']} strokeWidth={3} dot={expanded ? { r: 3 } : false} /> : null}
              {selectedMarker(selected.id)}
              {brush(expanded, riskRows.length, 'date')}
            </ComposedChart>
          )}
        </ChartCard>

        <ChartCard
          title={`选中时点账户排行 · ${selected.date}`}
          height={260}
          legend={categoryCountLegend(rankingRows)}
          expandedHint="显示前 20 个账户，颜色对应大类"
          emptyMessage={rankingRows.length === 0 ? '该时点没有可排行的账户。' : undefined}
        >
          {({ expanded, isVisible }) => {
            const visible = rankingRows.filter((row) => isVisible(row.category)).slice(0, expanded ? 20 : 8);
            return (
              <BarChart data={visible} layout="vertical" margin={barChartMargin}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} horizontal={false} />
                <XAxis type="number" tickFormatter={axisMoney} tick={axisTick} />
                <YAxis type="category" dataKey="accountName" width={expanded ? 150 : 96} tick={axisTick} tickFormatter={expanded ? undefined : shortAccountName} interval={0} />
                <Tooltip content={<AccountAmountTooltip ratioBase={ratioBase} />} cursor={barCursor} />
                <Bar dataKey="amount" name="账户金额" radius={[0, 6, 6, 0]} maxBarSize={22}>
                  {visible.map((row, index) => <Cell key={`${row.accountName}-${index}`} fill={categoryColors[row.category]} />)}
                </Bar>
              </BarChart>
            );
          }}
        </ChartCard>

        <ChartCard
          title={`大类结构变化 · ${comparisonLabel}`}
          height={260}
          legend={categoryImpactLegend}
          emptyMessage={!previous ? noPreviousMessage : categoryImpactRows.length === 0 ? '两期之间各大类金额没有变化。' : undefined}
          footer={<p className="chart-note">按对净资产的影响计：负债增加显示为负值。</p>}
        >
          {({ isVisible }) => {
            const visible = categoryImpactRows.filter((row) => isVisible(row.category));
            return (
              <BarChart data={visible} margin={chartMargin}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
                <XAxis dataKey="category" tick={axisTick} tickLine={false} />
                {moneyAxis}
                <Tooltip content={<ImpactTooltip />} cursor={barCursor} />
                <ReferenceLine y={0} stroke="#98a2b3" />
                <Bar dataKey="impact" name="对净资产的影响" radius={4} maxBarSize={56}>
                  {visible.map((row) => <Cell key={row.category} fill={categoryColors[row.category]} />)}
                </Bar>
              </BarChart>
            );
          }}
        </ChartCard>
      </div>

      <div className="chart-grid secondary-charts">
        <ChartCard title="大类资产堆叠趋势" height={260} legend={stackLegend} expandedHint={timeSeriesHint} emptyMessage={stackLegend.length === 0 ? '暂无资产数据。' : undefined}>
          {({ expanded, isVisible }) => (
            <AreaChart data={trendData} margin={chartMargin} onClick={selectSnapshotFromChart} style={{ cursor: 'pointer' }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
              {timeAxis}
              {moneyAxis}
              <Tooltip formatter={tooltipMoney} labelFormatter={snapshotTooltipLabel} />
              {stackLegend.filter((series) => isVisible(series.key)).map((series) => (
                <Area key={series.key} type="monotone" dataKey={series.key} name={series.label} stackId="assets" stroke={series.color} fill={series.color} fillOpacity={0.55} />
              ))}
              {selectedMarker(selected.id)}
              {brush(expanded, trendData.length, 'date')}
            </AreaChart>
          )}
        </ChartCard>

        <ChartCard
          title={`渠道结构 · ${selected.date}`}
          className="structure-card"
          height={220}
          legend={venueLegend}
          emptyMessage={venueData.length === 0 ? '该时点没有正资产。' : undefined}
          footer={<p className="chart-note">渠道和风险大类是两条独立的维度：同一渠道里可以有不同风险的资产。</p>}
        >
          {({ expanded, isVisible }) => {
            const visible = venueData.filter((item) => isVisible(item.name));
            return (
              <PieChart>
                <Pie data={visible} dataKey="value" nameKey="name" innerRadius="56%" outerRadius="82%" paddingAngle={3} label={expanded ? pieSliceLabel : false} labelLine={expanded}>
                  {visible.map((item) => <Cell key={item.name} fill={venueColors[item.name]} />)}
                  <Label position="center" content={<PieCenterLabel caption={visible.length === venueData.length ? '总资产' : '已选合计'} value={sumValues(visible)} />} />
                </Pie>
                <Tooltip formatter={(value, name) => [`${formatMoney(Number(value))} · 占总资产 ${shareOfAssets(Number(value))}`, name]} />
              </PieChart>
            );
          }}
        </ChartCard>

        <ChartCard
          title={`账户金额变化 Top 5 · ${comparisonLabel}`}
          expandedTitle={`账户金额变化 Top 15 · ${comparisonLabel}`}
          height={260}
          legend={categoryCountLegend(accountImpactRows)}
          expandedHint="颜色对应大类"
          emptyMessage={!previous ? noPreviousMessage : accountImpactRows.length === 0 ? '两期之间账户金额没有变化。' : undefined}
          footer={<p className="chart-note">按对净资产的影响排序：负债增加显示为负值；上一期有、本期消失的账户按清零计。</p>}
        >
          {({ expanded, isVisible }) => {
            const visible = accountImpactRows.filter((row) => isVisible(row.category)).slice(0, expanded ? 15 : 5);
            return (
              <BarChart data={visible} layout="vertical" margin={barChartMargin}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} horizontal={false} />
                <XAxis type="number" tickFormatter={axisMoney} tick={axisTick} />
                <YAxis type="category" dataKey="accountName" width={expanded ? 150 : 96} tick={axisTick} tickFormatter={expanded ? undefined : shortAccountName} interval={0} />
                <Tooltip content={<ImpactTooltip />} cursor={barCursor} />
                <ReferenceLine x={0} stroke="#98a2b3" />
                <Bar dataKey="impact" name="对净资产的影响" radius={4} maxBarSize={22}>
                  {visible.map((row) => <Cell key={row.accountId} fill={categoryColors[row.category]} />)}
                </Bar>
              </BarChart>
            );
          }}
        </ChartCard>

        <div className="chart-card account-insight-card">
          <h3>账户洞察</h3>
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
          <p className="chart-note">增长 / 下降按对净资产的影响计：负债增加算作下降。</p>
        </div>
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

function axisMoney(value: unknown): string {
  return formatCompactNumber(Number(value));
}

function tooltipMoney(value: unknown): string {
  return formatMoney(Number(value));
}

function signedCompact(value: number): string {
  return `${value > 0 ? '+' : ''}${formatCompactNumber(value)}`;
}

function signedMoney(value: number): string {
  return `${value > 0 ? '+' : ''}${formatMoney(value)}`;
}

function shortAccountName(name: unknown): string {
  const text = String(name);
  return text.length > 7 ? `${text.slice(0, 6)}…` : text;
}

function sumValues(items: Array<{ value: number }>): number {
  return items.reduce((sum, item) => sum + item.value, 0);
}

function pieSliceLabel({ name, value }: { name?: unknown; value?: unknown }): string {
  return `${String(name ?? '')} ${formatCompactNumber(Number(value))}`;
}

function categoryCountLegend(rows: Array<{ category: AssetCategory }>): ChartLegendItem[] {
  return categories
    .map((category) => ({ category, count: rows.filter((row) => row.category === category).length }))
    .filter((item) => item.count > 0)
    .map((item) => ({ key: item.category, label: item.category, color: categoryColors[item.category], detail: `${item.count} 个` }));
}

function PieCenterLabel({ viewBox, caption, value }: { viewBox?: unknown; caption: string; value: number }) {
  // position="center" 时 Recharts 给的是图表矩形区域，而不是饼图的 cx/cy。
  const box = (viewBox ?? {}) as { cx?: number; cy?: number; x?: number; y?: number; width?: number; height?: number };
  const cx = box.cx ?? (box.x !== undefined && box.width !== undefined ? box.x + box.width / 2 : undefined);
  const cy = box.cy ?? (box.y !== undefined && box.height !== undefined ? box.y + box.height / 2 : undefined);
  if (cx === undefined || cy === undefined) return null;
  return (
    <text x={cx} y={cy} textAnchor="middle" className="pie-center-label">
      <tspan x={cx} dy="-0.4em" className="pie-center-caption">{caption}</tspan>
      <tspan x={cx} dy="1.5em" className="pie-center-value">¥{formatCompactNumber(value)}</tspan>
    </text>
  );
}

type ImpactRow = { category: AssetCategory; change: number; impact: number };

function ImpactTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ payload?: ImpactRow }>; label?: unknown }) {
  const row = payload?.[0]?.payload;
  if (!active || !row) return null;
  const isAccountRow = 'accountName' in row;

  return (
    <div className="custom-tooltip">
      <strong>{String(label ?? row.category)}</strong>
      {isAccountRow ? <span>大类：{row.category}</span> : null}
      <span>对净资产：<b className={row.impact >= 0 ? 'positive' : 'negative'}>{signedMoney(row.impact)}</b></span>
      {isLiabilityCategory(row.category) ? <span>负债余额变化：{signedMoney(row.change)}</span> : null}
    </div>
  );
}

function AccountAmountTooltip({ active, payload, ratioBase }: { active?: boolean; payload?: Array<{ payload?: { accountName: string; category: AssetCategory; amount: number } }>; ratioBase: number }) {
  const row = payload?.[0]?.payload;
  if (!active || !row) return null;
  const isLiability = isLiabilityCategory(row.category);

  return (
    <div className="custom-tooltip">
      <strong>{row.accountName}</strong>
      <span>大类：{row.category}</span>
      <span>{isLiability ? '负债余额' : '账户金额'}：{formatMoney(row.amount)}</span>
      {isLiability ? null : <span>占总资产：{formatPercent(ratioBase === 0 ? null : row.amount / ratioBase)}</span>}
    </div>
  );
}

function EmptyState() {
  return (
    <section className="panel empty-state">
      <h2>还没有资产数据</h2>
      <p>请先上传 Excel、粘贴表格文本，或点击“载入示例数据”查看效果。</p>
    </section>
  );
}
