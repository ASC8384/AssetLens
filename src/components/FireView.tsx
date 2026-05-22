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
      <div className="dashboard-hero fire-hero fire-hero-visual">
        <div>
          <span className="eyebrow">FIRE TRACKER</span>
          <h2>FIRE 仪表盘</h2>
          <p>当前进度 · 目标资产 {formatMoney(analysis.fireTarget)}</p>
        </div>
        <div className="fire-progress-orbit" aria-label="进度环">
          <span className="fire-progress-fill" style={{ '--progress': `${Math.min(100, analysis.fireProgress * 100)}%` } as React.CSSProperties} />
          <div className="fire-progress-center">
            <small>FIRE进度</small>
            <strong>{formatPercent(analysis.fireProgress)}</strong>
          </div>
        </div>
        <div className="hero-delta">
          <span>距离 FIRE 还差</span>
          <strong>{formatMoney(analysis.fireGap)}</strong>
          <small>历史月均变化仅供观察：{formatMoney(analysis.monthlyGrowth)}</small>
        </div>
      </div>

      <section className="fire-route-card">
        <div className="fire-route-header">
          <div>
            <span className="eyebrow">RETIREMENT ROUTE</span>
            <h3>FIRE 航线</h3>
          </div>
          <strong>{formatPercent(analysis.fireProgress)}</strong>
        </div>
        <div className="fire-route-track" style={{ '--progress': `${Math.min(100, analysis.fireProgress * 100)}%` } as React.CSSProperties}>
          <span className="route-line" />
          <span className="route-line-fill" />
          <span className="route-node current-node"><i />当前</span>
          <span className="route-node target-node"><i />FIRE</span>
        </div>
        <div className="fire-route-stats">
          <div><span>当前进度</span><strong>{formatPercent(analysis.fireProgress)}</strong></div>
          <div><span>目标资产</span><strong>{formatMoney(analysis.fireTarget)}</strong></div>
          <div><span>距离目标</span><strong>{formatMoney(analysis.fireGap)}</strong></div>
        </div>
      </section>

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

        <section className="chart-card fire-breakdown-card">
          <h3>目标拆解</h3>
          <div className="contribution-list">
            <div><span>月支出</span><strong>{formatMoney(data.fire.monthlyExpense)}</strong></div>
            <div><span>年支出</span><strong>{formatMoney(analysis.annualExpense)}</strong></div>
            <div><span>安全提取率</span><strong>{formatPercent(data.fire.withdrawalRate)}</strong></div>
            <div><span>FIRE 投资资产目标</span><strong>{formatMoney(analysis.fireTarget)}</strong></div>
            <div><span>应急备用金目标</span><strong>{formatMoney(analysis.emergencyReserveTarget)}</strong></div>
            <div><span>应急备用金缺口</span><strong>{formatMoney(analysis.emergencyReserveGap)}</strong></div>
            <div><span>现金/银行卡可支撑月数</span><strong>{analysis.emergencyReserveMonths === null ? '—' : `${formatNumber(analysis.emergencyReserveMonths, 1)} 个月`}</strong></div>
          </div>
          <p className="muted">FIRE 目标按长期可投资资产估算；应急备用金单独检查。</p>
        </section>

        <section className="chart-card fire-path-card">
          <h3>仅靠当前资产增长</h3>
          <div className="contribution-list">
            <div><span>当前资产</span><strong>{formatMoney(analysis.currentNetWorth)}</strong></div>
            <div><span>目标资产</span><strong>{formatMoney(analysis.fireTarget)}</strong></div>
            <div><span>预期年化收益率</span><strong>{formatPercent(analysis.expectedAnnualReturn)}</strong></div>
            <div><span>预计达成时间</span><strong>{analysis.forecasts.withReturnMonths === null ? '无法按收益率单独估算' : formatMonths(analysis.forecasts.withReturnMonths)}</strong></div>
          </div>
          <p className="muted">不考虑未来新增投入，只看当前资产按预期收益率自然增长。</p>
        </section>

        <section className="chart-card">
          <h3>历史速度估算</h3>
          <div className="contribution-list">
            {analysis.speedEstimates.map((estimate) => (
              <div key={estimate.key} className="speed-estimate-row">
                <span>{estimate.label}</span>
                <strong>{formatMonths(estimate.projectedMonthsToFire)}</strong>
                <small>月均变化 {formatMoney(estimate.monthlyChange)}</small>
                <small>{estimate.startDate && estimate.endDate ? `${estimate.startDate} → ${estimate.endDate}` : '等待更多快照'}{estimate.months !== null ? ` · 约 ${estimate.months} 个月` : ''}</small>
                <small>可信度 <span className="confidence-pill">{estimate.confidenceLabel}</span></small>
                <small>{estimate.note}</small>
              </div>
            ))}
          </div>
          <p className="muted">仅按资产快照变化外推，可能受市场波动、奖金、大额支出和收入变化影响。</p>
        </section>

        <section className="chart-card fire-sensitivity-card">
          <h3>FIRE 敏感性矩阵</h3>
          <div className="sensitivity-table-wrap">
            <table className="sensitivity-table">
              <thead>
                <tr>
                  <th>月支出情境</th>
                  {analysis.sensitivityMatrix.rates.map((rate) => <th key={rate.label}>{rate.label}</th>)}
                </tr>
              </thead>
              <tbody>
                {analysis.sensitivityMatrix.rows.map((row) => (
                  <tr key={row.label}>
                    <th>{row.label}<small>{formatMoney(row.monthlyExpense)}/月</small></th>
                    {row.cells.map((cell) => (
                      <td key={`${row.label}-${cell.withdrawalRate}`} className={cell.isCurrent ? 'current-sensitivity-cell' : ''}>
                        {cell.isCurrent && <span className="confidence-pill">当前配置</span>}
                        <strong>{formatMoney(cell.target)}</strong>
                        <small>缺口 {formatMoney(cell.gap)}</small>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="muted">目标资产按年支出 / 安全提取率计算，不包含未来新增投入。</p>
        </section>
      </div>
    </section>
  );
}
