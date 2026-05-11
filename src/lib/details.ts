import type { AccountConfig, AssetCategory, AssetSnapshot } from './types';

export type DetailSortMode = 'date-asc' | 'date-desc' | 'total-asc' | 'total-desc' | 'diff-desc';
export type DetailIssueFilter = 'all' | 'issues-only';

export function filterAccounts(accounts: AccountConfig[], category: AssetCategory | '全部', search: string): AccountConfig[] {
  const keyword = search.trim().toLowerCase();
  return accounts.filter((account) => {
    if (account.hidden) return false;
    if (category !== '全部' && account.category !== category) return false;
    if (keyword && !account.name.toLowerCase().includes(keyword)) return false;
    return true;
  });
}

export function sortSnapshotsForDetails(snapshots: AssetSnapshot[], mode: DetailSortMode): AssetSnapshot[] {
  return [...snapshots].sort((a, b) => {
    if (mode === 'date-asc') return a.date.localeCompare(b.date);
    if (mode === 'date-desc') return b.date.localeCompare(a.date);
    if (mode === 'total-asc') return a.computedTotalCny - b.computedTotalCny;
    if (mode === 'total-desc') return b.computedTotalCny - a.computedTotalCny;
    return totalDiffAbs(b) - totalDiffAbs(a);
  });
}

export function filterSnapshotsByIssue(snapshots: AssetSnapshot[], mode: DetailIssueFilter): AssetSnapshot[] {
  if (mode === 'all') return snapshots;
  return snapshots.filter((snapshot) => totalDiffAbs(snapshot) > 0.01 || snapshot.entries.some((entry) => entry.amountCny === null && entry.originalAmount !== null));
}

function totalDiffAbs(snapshot: AssetSnapshot): number {
  return snapshot.excelTotal === undefined ? 0 : Math.abs(snapshot.computedTotalCny - snapshot.excelTotal);
}
