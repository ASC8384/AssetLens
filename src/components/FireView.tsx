import { analyzeFire } from '../lib/fire';
import { formatMoney, formatPercent, formatNumber } from '../lib/format';
import type { AppData } from '../lib/types';

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
          <small>历史月均变化仅供观察：{formatMoney(analysis.monthlyGrowth)}</small>
        </div>
      </div>

      <div className="fire-grid">
        <section className="chart-card fire-settings">
          <h3>FIRE 设置</h3>
          <label><span>月支出</span><input type="number" value={data.fire.monthlyExpense} onChange={(event) => updateFireNumber('monthlyExpense', event.target.value)} /></label>
          <label><span>安全提取率%</span><input type="number" step="0.1" value={formatNumber(data.fire.withdrawalRate * 100, 1)} onChange={(event) => updateFireNumber('withdrawalRate', event.target.value)} /></label>
          <label><span>应急备用金月数</span><input type="number" value={data.fire.emergencyReserveMonthsTarget} onChange={(event) => updateFireNumber('emergencyReserveMonthsTarget', event.target.value)} /></label>
          <label><span>预期年化收益率%</span><input type="number" step="0.1" value={formatNumber(data.fire.expectedAnnualReturn * 100, 1)} onChange={(event) => updateFireNumber('expectedAnnualReturn', event.target.value)} /></label>
        </section>

        <section className="chart-card">
          <h3>核心指标</h3>
          <div className="contribution-list">
            <div><span>当前净资产</span><strong>{formatMoney(analysis.currentNetWorth)}</strong></div>
            <div><span>年支出</span><strong>{formatMoney(analysis.annualExpense)}</strong></div>
            <div><span>历史净资产月均变化</span><strong>{formatMoney(analysis.monthlyGrowth)}</strong></div>
            <div><span>现金/银行卡可支撑月数</span><strong>{analysis.emergencyReserveMonths === null ? '—' : `${formatNumber(analysis.emergencyReserveMonths, 1)} 个月`}</strong></div>
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
