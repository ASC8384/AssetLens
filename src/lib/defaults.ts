import type { AccountConfig, AppData, AssetCategory } from './types';
import { createDefaultStrategyConfig } from './strategy';

export const categories: AssetCategory[] = ['基金', '现金', '证券', '银行卡', '杂项'];

export const categoryColors: Record<AssetCategory, string> = {
  基金: '#4f46e5',
  现金: '#059669',
  证券: '#dc2626',
  银行卡: '#2563eb',
  杂项: '#9333ea',
};

export const defaultExchangeRates: Record<string, number> = {
  CNY: 1,
  USD: 7.24,
  HKD: 0.93,
  JPY: 0.047,
};

export const defaultAccountCategories: Record<string, AssetCategory> = {
  基金账户A: '基金',
  基金账户B: '基金',
  基金账户C: '基金',
  基金账户D: '基金',
  现金账户A: '现金',
  现金账户B: '现金',
  现金账户C: '现金',
  证券: '证券',
  证券账户B: '证券',
  银行卡A: '银行卡',
  银行卡B: '银行卡',
  银行卡C: '银行卡',
  银行卡D: '银行卡',
  银行卡E: '银行卡',
  杂: '杂项',
};

export function categoryForAccount(name: string): AssetCategory {
  return defaultAccountCategories[name] ?? '杂项';
}

export function createAccountConfig(name: string): AccountConfig {
  return {
    id: accountIdFromName(name),
    name,
    category: categoryForAccount(name),
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
    preferences: {
      activeTab: 'dashboard',
      detailMode: 'compact',
      categoryFilter: '全部',
    },
  };
}
