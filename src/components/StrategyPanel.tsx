import { categoryHints, classifiedAssetCategories } from '../lib/defaults';
import type { AppData, AssetCategory } from '../lib/types';

/** 「未分类」不该有目标占比，但负债需要（通常设为 0）。 */
const targetableCategories: AssetCategory[] = [...classifiedAssetCategories, '负债'];

export function StrategyPanel({ data, onChange }: { data: AppData; onChange: (data: AppData) => void }) {
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
    <div className="strategy-config-grid">
      <label><span>应急备用金目标<small>纯现金 + 稳健类至少保留的金额；稳健类含债基与理财，赎回可能有小额浮亏</small></span><input type="number" value={data.strategy.cashReserveTarget} onChange={(event) => updateStrategyNumber('cashReserveTarget', event.target.value)} /></label>
      <label><span>风险资产下限%<small>权益类占资产总额（不含负债）的最低比例</small></span><input type="number" value={Math.round(data.strategy.riskAssetMinRatio * 100)} onChange={(event) => updateStrategyNumber('riskAssetMinRatio', event.target.value)} /></label>
      <label><span>风险资产上限%<small>权益类占资产总额（不含负债）的最高比例</small></span><input type="number" value={Math.round(data.strategy.riskAssetMaxRatio * 100)} onChange={(event) => updateStrategyNumber('riskAssetMaxRatio', event.target.value)} /></label>
      {targetableCategories.map((category) => (
        <label key={category}><span>{category}目标占比%<small>{category === '负债' ? '欠款占资产总额的比例，建议为 0' : categoryHints[category]}</small></span><input type="number" value={Math.round((data.strategy.targetCategoryRatios[category] ?? 0) * 100)} onChange={(event) => updateTargetRatio(category, event.target.value)} /></label>
      ))}
    </div>
  );
}
