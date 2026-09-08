/**
 * 大类按「流动性 + 波动」划分，而不是按产品或载体，这样风险占比和策略判断才有意义。
 * 「未分类」是系统没认出来的状态，和「其他资产」这个真实类别刻意分开，
 * 否则无法区分「我确认它是杂项」和「系统猜不出来」。
 */
export type AssetCategory = '纯现金' | '稳健类' | '权益类' | '其他资产' | '未分类' | '负债';

/** 渠道是独立于风险的第二维度：同一渠道下可以有不同风险的资产。 */
export type AccountVenue = '银行' | '场外' | '场内' | '其他';

export type AccountConfig = {
  id: string;
  name: string;
  category: AssetCategory;
  venue: AccountVenue;
  defaultCurrency: string;
  includedInTotal: boolean;
  hidden: boolean;
};

export type AccountEntry = {
  accountId: string;
  accountName: string;
  category: AssetCategory;
  venue: AccountVenue;
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
  computedGrossAssetsCny: number;
  computedLiabilityCny: number;
  externalIncome?: number | null;
  note?: string;
};

export type StrategyConfig = {
  cashReserveTarget: number;
  riskAssetMinRatio: number;
  riskAssetMaxRatio: number;
  targetCategoryRatios: Partial<Record<AssetCategory, number>>;
};

export type FireConfig = {
  monthlyExpense: number;
  withdrawalRate: number;
  emergencyReserveMonthsTarget: number;
  expectedAnnualReturn: number;
};

export type AppData = {
  version: 1;
  snapshots: AssetSnapshot[];
  accounts: AccountConfig[];
  defaultExchangeRates: Record<string, number>;
  strategy: StrategyConfig;
  fire: FireConfig;
  preferences: {
    activeTab: 'dashboard' | 'details' | 'report' | 'fire';
    detailMode: 'compact' | 'analysis';
    detailIssueFilter: 'all' | 'issues-only';
    categoryFilter: AssetCategory | '全部';
  };
};

export type FieldRole = 'date' | 'account' | 'ratio' | 'total' | 'income' | 'note' | 'ignore';

export type FieldMapping = {
  columnIndex: number;
  header: string;
  role: FieldRole;
  accountName?: string;
  ratioForColumnIndex?: number;
  category?: AssetCategory;
  venue?: AccountVenue;
  currency?: string;
  includedInTotal?: boolean;
  import: boolean;
  sampleValues: string[];
};

export type ParsedTable = {
  headers: string[];
  rows: string[][];
  /** 「合计」公式里对某列使用的汇率乘数，用于识别外币列；columnIndex -> 乘数 */
  columnRateHints?: Record<number, number>;
};

export type ImportDraft = {
  parsed: ParsedTable;
  mappings: FieldMapping[];
};

export type DuplicateDateMode = 'overwrite' | 'keep' | 'skip';
