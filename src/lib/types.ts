export type AssetCategory = '基金' | '现金' | '证券' | '银行卡' | '杂项';

export type AccountConfig = {
  id: string;
  name: string;
  category: AssetCategory;
  defaultCurrency: string;
  includedInTotal: boolean;
  hidden: boolean;
};

export type AccountEntry = {
  accountId: string;
  accountName: string;
  category: AssetCategory;
  originalAmount: number | null;
  currency: string;
  exchangeRate: number | null;
  amountCny: number | null;
  excelRatio?: number | null;
  computedRatio?: number | null;
  ratioDiff?: number | null;
  includedInTotal: boolean;
};

export type AssetSnapshot = {
  id: string;
  date: string;
  exchangeRates: Record<string, number>;
  entries: AccountEntry[];
  excelTotal?: number;
  computedTotalCny: number;
};

export type StrategyConfig = {
  cashReserveTarget: number;
  riskAssetMinRatio: number;
  riskAssetMaxRatio: number;
  targetCategoryRatios: Partial<Record<AssetCategory, number>>;
};

export type AppData = {
  version: 1;
  snapshots: AssetSnapshot[];
  accounts: AccountConfig[];
  defaultExchangeRates: Record<string, number>;
  strategy: StrategyConfig;
  preferences: {
    activeTab: 'dashboard' | 'details' | 'report';
    detailMode: 'compact' | 'analysis';
    categoryFilter: AssetCategory | '全部';
  };
};

export type FieldRole = 'date' | 'account' | 'ratio' | 'total' | 'ignore';

export type FieldMapping = {
  columnIndex: number;
  header: string;
  role: FieldRole;
  accountName?: string;
  ratioForColumnIndex?: number;
  category?: AssetCategory;
  currency?: string;
  includedInTotal?: boolean;
  import: boolean;
  sampleValues: string[];
};

export type ParsedTable = {
  headers: string[];
  rows: string[][];
};

export type ImportDraft = {
  parsed: ParsedTable;
  mappings: FieldMapping[];
};

export type DuplicateDateMode = 'overwrite' | 'keep' | 'skip';
