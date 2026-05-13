import { analyzeFire } from '../lib/fire';
import { formatMoney, formatPercent, formatNumber } from '../lib/format';
import type { AppData } from '../lib/types';

function formatMonths(months: number | null): string {
  if (months === null) return '暂无法估算';
  if (months === 0) return '已达成';
  const years = Math.floor(months / 12);
  const rest = months % 12;
  return years > 0 ? `${years} 年 ${rest} 个月` : `${rest} 个月`;
}

export function FireView({ data, onChange }: { data: AppData; onChange: (data: AppData) => void }) {
  const analysis = analyzeFire(data.snapshots, data.fire);

  function updateFireNumber(key: keyof AppData['fire'], value: string) {
    const number = Number(value);
    if (!Number.isFinite(number)) return;
    onChange({ ...data, fire: { ...data.fire, [key]: key === 'withdrawalRate' || key === 'expectedAnnualReturn' ? number / 100 : number } });
  }

  return (
    <section className="fire-view">
      <div className="dashboard-hero fire-hero">
        <div>
          <span className="eyebrow">FIRE TRACKER</span>
          <h2>{formatPercent(analysis.fireProgress)}</h2>
          <p>当前进度 · 目标资产 {formatMoney(analysis.fireTarget)}</p>
        </div>
        <div className="hero-delta">
          <span>距离 FIRE 还差</span>
          <strong>{formatMoney(analysis.fireGap)}</strong>
          <small>按主动净投入估算：{formatMonths(analysis.forecasts.contributionOnlyMonths)}</small>
        </div>
      </div>

      <div className="fire-grid">
        <section className="chart-card fire-settings">
          <h3>FIRE 设置</h3>
          <label><span>月支出</span><input type="number" value={data.fire.monthlyExpense} onChange={(event) => updateFireNumber('monthlyExpense', event.target.value)} /></label>
          <label><span>安全提取率%</span><input type="number" step="0.1" value={formatNumber(data.fire.withdrawalRate * 100, 1)} onChange={(event) => updateFireNumber('withdrawalRate', event.target.value)} /></label>
          <label><span>应急备用金月数</span><input type="number" value={data.fire.emergencyReserveMonthsTarget} onChange={(event) => updateFireNumber('emergencyReserveMonthsTarget', event.target.value)} /></label>
          <label><span>每月主动净投入</span><input type="number" value={data.fire.monthlyContribution} onChange={(event) => updateFireNumber('monthlyContribution', event.target.value)} /></label>
          <label><span>预期年化收益率%</span><input type="number" step="0.1" value={formatNumber(data.fire.expectedAnnualReturn * 100, 1)} onChange={(event) => updateFireNumber('expectedAnnualReturn', event.target.value)} /></label>
          <label><span>压力场景停投月数</span><input type="number" value={data.fire.stressNoContributionMonths} onChange={(event) => updateFireNumber('stressNoContributionMonths', event.target.value)} /></label>
        </section>

        <section className="chart-card">
          <h3>核心指标</h3>
          <div className="contribution-list">
            <div><span>当前净资产</span><strong>{formatMoney(analysis.currentNetWorth)}</strong></div>
            <div><span>年支出</span><strong>{formatMoney(analysis.annualExpense)}</strong></div>
            <div><span>历史净资产月均变化</span><strong>{formatMoney(analysis.monthlyGrowth)}</strong></div>
            <div><span>应急备用金覆盖</span><strong>{analysis.emergencyReserveMonths === null ? '—' : `${formatNumber(analysis.emergencyReserveMonths, 1)} 个月`}</strong></div>
          </div>
        </section>

        <section className="chart-card">
          <h3>预计达成</h3>
          <div className="contribution-list">
            <div><span>仅按主动净投入</span><strong>{formatMonths(analysis.forecasts.contributionOnlyMonths)}</strong></div>
            <div><span>净投入 + 收益假设</span><strong>{formatMonths(analysis.forecasts.withReturnMonths)}</strong></div>
            <div><span>压力场景</span><strong>{formatMonths(analysis.forecasts.stressMonths)}</strong><small>先停投 {data.fire.stressNoContributionMonths} 个月</small></div>
          </div>
        </section>

        <section className="chart-card">
          <h3>提取率场景</h3>
          <div className="contribution-list">
            {analysis.scenarios.map((scenario) => (
              <div key={scenario.label}><span>{scenario.label}</span><strong>{formatMoney(scenario.target)}</strong><small>缺口 {formatMoney(scenario.gap)}</small></div>
            ))}
          </div>
        </section>
      </div>
    </section>
  );
}
