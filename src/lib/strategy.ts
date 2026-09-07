import { categoryTotals } from './calculations';
import { formatMoney, formatPercent } from './format';
import type { AssetCategory, AssetSnapshot, StrategyConfig } from './types';

export type StrategyAnalysis = {
  cashReserveGap: number;
  riskAssetRatio: number | null;
  riskStatus: 'below' | 'within' | 'above';
  categoryDrifts: Array<{ category: AssetCategory; currentRatio: number; targetRatio: number; drift: number }>;
  suggestions: string[];
};

export function createDefaultStrategyConfig(): StrategyConfig {
  return {
    cashReserveTarget: 30000,
    riskAssetMinRatio: 0.35,
    riskAssetMaxRatio: 0.65,
    targetCategoryRatios: {
      基金: 0.35,
      证券: 0.2,
      现金: 0.15,
      银行卡: 0.25,
      杂项: 0.05,
      负债: 0,
    },
  };
}

export function analyzeStrategy(snapshot: AssetSnapshot, config: StrategyConfig): StrategyAnalysis {
  const totals = categoryTotals(snapshot, []);
  const safeCash = totals['现金'] + totals['银行卡'];
  const riskAmount = totals['基金'] + totals['证券'];
  const grossAssets = snapshot.computedGrossAssetsCny;
  const riskAssetRatio = grossAssets === 0 ? null : riskAmount / grossAssets;
  const cashReserveGap = safeCash - config.cashReserveTarget;
  const riskStatus = riskAssetRatio === null || riskAssetRatio >= config.riskAssetMinRatio && riskAssetRatio <= config.riskAssetMaxRatio
    ? 'within'
    : riskAssetRatio < config.riskAssetMinRatio ? 'below' : 'above';
  const categoryDrifts = Object.entries(config.targetCategoryRatios).map(([category, targetRatio]) => {
    const typedCategory = category as AssetCategory;
    const currentRatio = grossAssets === 0 ? 0 : totals[typedCategory] / grossAssets;
    return { category: typedCategory, currentRatio, targetRatio: targetRatio ?? 0, drift: currentRatio - (targetRatio ?? 0) };
  });
  const suggestions: string[] = [];
  if (cashReserveGap < 0) suggestions.push(`应急备用金低于目标 ${formatMoney(Math.abs(cashReserveGap))}`);
  if (riskStatus === 'above' && riskAssetRatio !== null) suggestions.push(`风险资产占比高于上限 ${formatPercent(riskAssetRatio - config.riskAssetMaxRatio)}百分点`);
  if (riskStatus === 'below' && riskAssetRatio !== null) suggestions.push(`风险资产占比低于下限 ${formatPercent(config.riskAssetMinRatio - riskAssetRatio)}百分点`);
  for (const drift of categoryDrifts.filter((item) => Math.abs(item.drift) >= 0.05)) {
    suggestions.push(`${drift.category}偏离目标 ${formatPercent(drift.drift)}百分点`);
  }
  return { cashReserveGap, riskAssetRatio, riskStatus, categoryDrifts, suggestions };
}
