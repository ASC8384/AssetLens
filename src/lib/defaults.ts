import type { AccountConfig, AccountVenue, AppData, AssetCategory } from './types';
import { createDefaultFireConfig } from './fire';
import { createDefaultStrategyConfig } from './strategy';

/** 按流动性与波动从低到高排列，「未分类」和「负债」是两个独立状态，排在最后。 */
export const categories: AssetCategory[] = ['纯现金', '稳健类', '权益类', '其他资产', '未分类', '负债'];
export const assetCategories: AssetCategory[] = categories.filter((category) => category !== '负债');
/** 用户已确认归属的资产大类，用于策略目标占比这类不该给「未分类」设目标的场景。 */
export const classifiedAssetCategories: AssetCategory[] = assetCategories.filter((category) => category !== '未分类');

export const venues: AccountVenue[] = ['银行', '场外', '场内', '其他'];

export const categoryColors: Record<AssetCategory, string> = {
  纯现金: '#0891b2',
  稳健类: '#059669',
  权益类: '#ea580c',
  其他资产: '#9333ea',
  未分类: '#94a3b8',
  负债: '#e11d48',
};

export const venueColors: Record<AccountVenue, string> = {
  银行: '#2563eb',
  场外: '#7c3aed',
  场内: '#ea580c',
  其他: '#94a3b8',
};

export const categoryHints: Record<AssetCategory, string> = {
  纯现金: '随时可取、几乎不波动：活期、余额宝、货币基金',
  稳健类: '低波动但有锁定期或净值波动：债基、定期、存单、R2 理财',
  权益类: '净值明显波动：股票、股票/混合基金、股票 ETF',
  其他资产: '不属于以上三类：黄金、房产、加密、公积金、应收借出',
  未分类: '系统没认出来，需要你确认归属',
  负债: '欠款，按正数记录，从净资产中扣除',
};

export const defaultExchangeRates: Record<string, number> = {
  CNY: 1,
  USD: 7,
  HKD: 0.9,
  JPY: 0.047,
};

const liabilityNamePattern = /visa|mastercard|amex|jcb|信用卡|贷记卡|普卡|金卡|欠款|负债|花呗|白条|借呗|房贷|车贷|贷款|credit\s*card/i;
const otherAssetPattern = /房|车位|汽车|黄金|金条|白银|实物|收藏|保险|保单|年金|公积金|应收|借出|借给|加密|比特|btc|eth|usdt/i;
const equityPattern = /股|证券|券商|场内|etf|指数|沪深|中证|标普|纳斯达克|可转债|混合基金|偏股/i;
const stablePattern = /债|存单|定期|存款|理财|固收|信托|银行|卡$|卡[A-Za-z0-9]*$|工行|建行|中行|农行|招行|交行|邮储|民生|兴业|浦发|中信|光大|广发|华夏/i;
const pureCashPattern = /现金|活期|余额宝|零钱|钱包|货币基金|货基|现金管理/i;

/**
 * 账户名只能给出线索，不能给出答案。这里刻意只匹配高置信度的关键词，
 * 认不出就返回「未分类」交给用户确认 —— 猜错一个大类会同时污染饼图、
 * 风险占比和策略建议，代价比让用户点一次下拉高得多。
 */
export function categoryForAccount(name: string): AssetCategory {
  const trimmed = name.trim();
  if (!trimmed) return '未分类';
  if (liabilityNamePattern.test(trimmed)) return '负债';
  if (otherAssetPattern.test(trimmed)) return '其他资产';
  if (equityPattern.test(trimmed)) return '权益类';
  if (pureCashPattern.test(trimmed)) return '纯现金';
  if (stablePattern.test(trimmed)) return '稳健类';
  return '未分类';
}

const onExchangeVenuePattern = /券商|证券|场内|股票|个股|etf|可转债|沪深|中证|港股|美股|a股/i;
const bankVenuePattern = /银行|卡|存款|定期|存单|活期|工行|建行|中行|农行|招行|交行|邮储|民生|兴业|浦发|中信|光大|广发|华夏/i;
const otcVenuePattern = /基金|余额宝|零钱|理财|固收|支付宝|微信|蚂蚁|天天|信托/i;

export function venueForAccount(name: string): AccountVenue {
  const trimmed = name.trim();
  if (onExchangeVenuePattern.test(trimmed)) return '场内';
  if (bankVenuePattern.test(trimmed)) return '银行';
  if (otcVenuePattern.test(trimmed)) return '场外';
  return '其他';
}

export function looksLikeLiability(name: string): boolean {
  return liabilityNamePattern.test(name.trim());
}

export function isUnclassifiedCategory(category: AssetCategory): boolean {
  return category === '未分类';
}

/**
 * 旧版本按「基金/现金/证券/银行卡/杂项」记录分类，其中「杂项」既是兜底又是真实类别。
 * 迁移时把它归到「未分类」而不是「其他资产」，这样界面能提示用户重新确认，
 * 不会把一堆没认出来的账户伪装成已归类。
 */
const legacyCategoryMap: Record<string, AssetCategory> = {
  基金: '权益类',
  证券: '权益类',
  现金: '稳健类',
  银行卡: '稳健类',
  杂项: '未分类',
};

export function migrateCategory(value: unknown): AssetCategory {
  if (typeof value !== 'string') return '未分类';
  if ((categories as string[]).includes(value)) return value as AssetCategory;
  return legacyCategoryMap[value] ?? '未分类';
}

export function migrateVenue(value: unknown, accountName = ''): AccountVenue {
  if (typeof value === 'string' && (venues as string[]).includes(value)) return value as AccountVenue;
  return venueForAccount(accountName);
}

export function createAccountConfig(name: string): AccountConfig {
  return {
    id: accountIdFromName(name),
    name,
    category: categoryForAccount(name),
    venue: venueForAccount(name),
    defaultCurrency: 'CNY',
    includedInTotal: true,
    hidden: false,
  };
}

export function accountIdFromName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, '-');
}

export function createEmptyAppData(): AppData {
  return {
    version: 1,
    snapshots: [],
    accounts: [],
    defaultExchangeRates,
    strategy: createDefaultStrategyConfig(),
    fire: createDefaultFireConfig(),
    preferences: {
      activeTab: 'dashboard',
      detailMode: 'compact',
      detailIssueFilter: 'all',
      categoryFilter: '全部',
    },
  };
}
