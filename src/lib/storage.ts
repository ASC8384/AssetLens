import type { AppData } from './types';
import { createEmptyAppData } from './defaults';
import { recalculateData } from './calculations';

const storageKey = 'asset-lens-data-v1';

export function loadAppData(): AppData {
  const raw = localStorage.getItem(storageKey);
  if (!raw) return createEmptyAppData();
  try {
    return normalizeAppData(JSON.parse(raw));
  } catch {
    return createEmptyAppData();
  }
}

export function saveAppData(data: AppData): void {
  localStorage.setItem(storageKey, JSON.stringify(data));
}

export function normalizeAppData(value: unknown): AppData {
  const empty = createEmptyAppData();
  if (!value || typeof value !== 'object') return empty;
  const candidate = value as Partial<AppData>;
  return recalculateData({
    version: 1,
    snapshots: Array.isArray(candidate.snapshots) ? candidate.snapshots : [],
    accounts: Array.isArray(candidate.accounts) ? candidate.accounts : [],
    defaultExchangeRates: { ...empty.defaultExchangeRates, ...(candidate.defaultExchangeRates ?? {}) },
    strategy: { ...empty.strategy, ...(candidate.strategy ?? {}) },
    preferences: { ...empty.preferences, ...(candidate.preferences ?? {}) },
  });
}

export function exportBackup(data: AppData): string {
  return JSON.stringify({ ...data, exportedAt: new Date().toISOString() }, null, 2);
}

export function importBackup(text: string): AppData {
  return normalizeAppData(JSON.parse(text));
}
