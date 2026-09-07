import { snapshotBookTotal } from './calculations';
import { totalQuality, type TotalQuality } from './dashboard';
import type { AccountConfig, AssetSnapshot, FieldMapping, ImportDraft } from './types';

export type ImportQualityRow = {
  date: string;
  computedTotalCny: number;
  bookTotal: number;
  excelTotal: number | null;
  diff: number | null;
  diffRatio: number | null;
  status: TotalQuality['status'];
  message: string;
};

export type ImportQualitySummary = {
  snapshotCount: number;
  accountCount: number;
  dangerCount: number;
  warningCount: number;
  hasSuspiciousTotal: boolean;
  rows: ImportQualityRow[];
};

export function analyzeImportQuality(snapshots: AssetSnapshot[], accountCount: number): ImportQualitySummary {
  const rows = snapshots.map((snapshot) => {
    const quality = totalQuality(snapshot);
    return {
      date: snapshot.date,
      computedTotalCny: snapshot.computedTotalCny,
      bookTotal: snapshotBookTotal(snapshot),
      excelTotal: snapshot.excelTotal ?? null,
      diff: quality.diff,
      diffRatio: quality.diffRatio,
      status: quality.status,
      message: quality.message,
    };
  });
  const dangerCount = rows.filter((row) => row.status === 'danger').length;
  const warningCount = rows.filter((row) => row.status === 'warning').length;
  return {
    snapshotCount: snapshots.length,
    accountCount,
    dangerCount,
    warningCount,
    hasSuspiciousTotal: dangerCount > 0,
    rows,
  };
}

export function ignoreTotalColumns(draft: ImportDraft): ImportDraft {
  return {
    ...draft,
    mappings: draft.mappings.map((mapping): FieldMapping => (
      mapping.role === 'total' ? { ...mapping, role: 'ignore', import: false } : mapping
    )),
  };
}

export function addAccountToDataAccounts(accounts: AccountConfig[], account: AccountConfig): AccountConfig[] {
  if (accounts.some((existing) => existing.id === account.id)) return accounts;
  return [...accounts, account];
}
