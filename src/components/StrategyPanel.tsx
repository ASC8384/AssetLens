import { useState } from 'react';
import { categories } from '../lib/defaults';
import { analyzeStrategy } from '../lib/strategy';
import { formatPercent } from '../lib/format';
import type { AppData, AssetCategory } from '../lib/types';

export function StrategyPanel({ data, onChange }: { data: AppData; onChange: (data: AppData) => void }) {
  const [expanded, setExpanded] = useState(false);
  const latest = data.snapshots[data.snapshots.length - 1];
  const analysis = latest ? analyzeStrategy(latest, data.strategy) : null;

  function updateStrategyNumber(key: 'cashReserveTarget' | 'riskAssetMinRatio' | 'riskAssetMaxRatio', value: string) {
    const number = Number(value);
    if (!Number.isFinite(number)) return;
    onChange({ ...data, strategy: { ...data.strategy, [key]: key === 'cashReserveTarget' ? number : number / 100 } });
  }

  function updateTargetRatio(category: AssetCategory, value: string) {
    const number = Number(value);
    if (!Number.isFinite(number)) return;
    onChange({
      ...data,
      strategy: {
        ...data.strategy,
        targetCategoryRatios: { ...data.strategy.targetCategoryRatios, [category]: number / 100 },
      },
    });
  }

  return (
    <section className="panel strategy-panel">
      <div className="section-header compact-section-header">
        <div>
          <h2>资产策略</h2>
          <p>可自定义目标参数，影响仪表盘策略雷达和复盘报告。</p>
        </div>
        <button onClick={() => setExpanded(!expanded)}>{expanded ? '收起策略' : '展开策略'}</button>
      </div>
      <div className="strategy-target-board">
        <h3>资产结构目标看板</h3>
        <div><span>风险资产目标区间</span><strong>{formatPercent(data.strategy.riskAssetMinRatio)} → {formatPercent(data.strategy.riskAssetMaxRatio)}</strong><small>当前 {formatPercent(analysis?.riskAssetRatio)}</small></div>
        <div><span>应急备用金</span><strong>{analysis ? (analysis.cashReserveGap >= 0 ? '已达标' : '需补齐') : '暂无数据'}</strong><small>{analysis ? `差额 ${analysis.cashReserveGap >= 0 ? '+' : ''}${analysis.cashReserveGap}` : '导入快照后可分析'}</small></div>
      </div>
      {expanded && (
        <div className="strategy-config-grid">
          <label><span>应急备用金目标<small>现金 + 银行卡至少保留的金额</small></span><input type="number" value={data.strategy.cashReserveTarget} onChange={(event) => updateStrategyNumber('cashReserveTarget', event.target.value)} /></label>
          <label><span>风险资产下限%<small>基金 + 证券占总资产的最低比例</small></span><input type="number" value={Math.round(data.strategy.riskAssetMinRatio * 100)} onChange={(event) => updateStrategyNumber('riskAssetMinRatio', event.target.value)} /></label>
          <label><span>风险资产上限%<small>基金 + 证券占总资产的最高比例</small></span><input type="number" value={Math.round(data.strategy.riskAssetMaxRatio * 100)} onChange={(event) => updateStrategyNumber('riskAssetMaxRatio', event.target.value)} /></label>
          {categories.map((category) => (
            <label key={category}><span>{category}目标占比%<small>期望该大类占总资产的比例</small></span><input type="number" value={Math.round((data.strategy.targetCategoryRatios[category] ?? 0) * 100)} onChange={(event) => updateTargetRatio(category, event.target.value)} /></label>
          ))}
        </div>
      )}
    </section>
  );
}
