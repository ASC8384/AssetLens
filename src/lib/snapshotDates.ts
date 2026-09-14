import { recalculateSnapshot, sortSnapshots } from './calculations';
import { isIsoDate } from './dates';
import type { AppData, AssetSnapshot, DuplicateDateMode } from './types';

export function snapshotsOnDate(snapshots: AssetSnapshot[], date: string, exceptId?: string): AssetSnapshot[] {
  return snapshots.filter((snapshot) => snapshot.date === date && snapshot.id !== exceptId);
}

export function applySnapshotDateChange(data: AppData, snapshotId: string, nextDate: string, mode: Exclude<DuplicateDateMode, 'skip'>): AppData {
  if (!isIsoDate(nextDate)) return data;
  const current = data.snapshots.find((snapshot) => snapshot.id === snapshotId);
  if (!current) return data;
  let snapshots = data.snapshots;
  if (mode === 'overwrite') {
    snapshots = snapshots.filter((snapshot) => snapshot.date !== nextDate || snapshot.id === snapshotId);
  }
  snapshots = snapshots.map((snapshot) => snapshot.id === snapshotId ? recalculateSnapshot({ ...snapshot, date: nextDate }) : snapshot);
  return { ...data, snapshots: sortSnapshots(snapshots) };
}

export function duplicateSnapshotWithDate(data: AppData, snapshotId: string, nextDate: string, mode: Exclude<DuplicateDateMode, 'skip'>): AppData {
  if (!isIsoDate(nextDate)) return data;
  const current = data.snapshots.find((snapshot) => snapshot.id === snapshotId);
  if (!current) return data;
  let snapshots = data.snapshots;
  if (mode === 'overwrite') {
    snapshots = snapshots.filter((snapshot) => snapshot.date !== nextDate);
  }
  snapshots = [...snapshots, recalculateSnapshot({ ...current, id: crypto.randomUUID(), date: nextDate })];
  return { ...data, snapshots: sortSnapshots(snapshots) };
}
