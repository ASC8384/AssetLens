import * as XLSX from 'xlsx';
import { accountIdFromName, categoryForAccount, createAccountConfig, defaultExchangeRates } from './defaults';
import { buildEntry, mergeAccounts, recalculateSnapshot, sortSnapshots } from './calculations';
import { parseNumber } from './format';
import type { AccountConfig, AppData, AssetSnapshot, DuplicateDateMode, FieldMapping, ImportDraft, ParsedTable } from './types';

const ignoredMetaHeaders = new Set(['时长', '变动', '日均', '结余', '支出']);
const incomeHeaders = new Set(['收入', '外界收入', '非理财收入', '主动收入', 'income']);
const noteHeaders = new Set(['备注', '说明', 'note', 'notes']);

export function parsePastedTable(text: string): ParsedTable {
  const rawRows = text
    .trim()
    .split(/\r?\n/)
    .map(splitPastedLine)
    .filter((row) => row.some(Boolean));
  const firstDataIndex = rawRows.findIndex((row) => looksLikeDataRow(row));
  const headerRows = firstDataIndex === -1 ? rawRows.slice(0, 1) : rawRows.slice(0, firstDataIndex);
  const dataRows = firstDataIndex === -1 ? rawRows.slice(1) : rawRows.slice(firstDataIndex);
  const headers = headerRows.flat();
  return { headers, rows: dataRows.filter((row) => row.some(Boolean)) };
}

function splitPastedLine(line: string): string[] {
  const trimmed = line.trim();
  if (!trimmed) return [];
  if (trimmed.includes('\t')) return trimmed.split('\t').map((cell) => cell.trim());
  return trimmed.split(/\s{2,}/).map((cell) => cell.trim());
}

function looksLikeDataRow(row: string[]): boolean {
  const first = row[0]?.trim() ?? '';
  return /^\d{4}[-/]\d{1,2}[-/]\d{1,2}$/.test(first) || /^\d{4}[-/]\d{1,2}$/.test(first);
}

export async function parseExcelFile(file: File): Promise<ParsedTable> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Array<string | number | Date | null>>(sheet, { header: 1, raw: false, defval: '' });
  const [headers = [], ...dataRows] = rows;
  return {
    headers: headers.map((header) => String(header).trim()),
    rows: dataRows.map((row) => row.map((cell) => String(cell ?? '').trim())).filter((row) => row.some(Boolean)),
  };
}

export function createImportDraft(parsed: ParsedTable): ImportDraft {
  return { parsed, mappings: inferFieldMappings(parsed) };
}

export function inferFieldMappings(parsed: ParsedTable): FieldMapping[] {
  return parsed.headers.map((header, columnIndex) => {
    const normalized = header.trim();
    const sampleValues = parsed.rows.slice(0, 3).map((row) => row[columnIndex] ?? '');
    if (normalized === '时间' || normalized.toLowerCase() === 'date') {
      return { columnIndex, header, role: 'date', import: true, sampleValues };
    }
    if (normalized === '合计' || normalized.toLowerCase() === 'total') {
      return { columnIndex, header, role: 'total', import: true, sampleValues };
    }
    if (normalized === '占比') {
      return {
        columnIndex,
        header,
        role: 'ignore',
        import: false,
        sampleValues,
      };
    }
    if (incomeHeaders.has(normalized.toLowerCase()) || incomeHeaders.has(normalized)) {
      return { columnIndex, header, role: 'income', import: true, sampleValues };
    }
    if (noteHeaders.has(normalized.toLowerCase()) || noteHeaders.has(normalized)) {
      return { columnIndex, header, role: 'note', import: true, sampleValues };
    }
    if (ignoredMetaHeaders.has(normalized)) {
      return { columnIndex, header, role: 'ignore', import: false, sampleValues };
    }
    return {
      columnIndex,
      header,
      role: 'account',
      accountName: normalized,
      category: categoryForAccount(normalized),
      currency: inferCurrency(sampleValues),
      includedInTotal: true,
      import: true,
      sampleValues,
    };
  });
}

function inferCurrency(sampleValues: string[]): string {
  const joined = sampleValues.join(' ');
  if (/HK\$|HKD/i.test(joined)) return 'HKD';
  if (/\$|USD|美元/.test(joined) && !/[¥￥]/.test(joined)) return 'USD';
  return 'CNY';
}

function findPreviousAccountColumn(headers: string[], columnIndex: number): number | null {
  for (let index = columnIndex - 1; index >= 0; index -= 1) {
    const header = headers[index]?.trim();
    if (!header || header === '占比' || header === '时间' || header === '合计') continue;
    return index;
  }
  return null;
}

export function buildSnapshotsFromDraft(draft: ImportDraft, existingAccounts: AccountConfig[]): { snapshots: AssetSnapshot[]; accounts: AccountConfig[] } {
  const dateMapping = draft.mappings.find((mapping) => mapping.role === 'date' && mapping.import);
  const totalMapping = draft.mappings.find((mapping) => mapping.role === 'total' && mapping.import);
  const incomeMapping = draft.mappings.find((mapping) => mapping.role === 'income' && mapping.import);
  const noteMapping = draft.mappings.find((mapping) => mapping.role === 'note' && mapping.import);
  const accountMappings = draft.mappings.filter((mapping) => mapping.role === 'account' && mapping.import);
  const ratioByAccountColumn = new Map(
    draft.mappings
      .filter((mapping) => mapping.role === 'ratio' && mapping.import && mapping.ratioForColumnIndex !== undefined)
      .map((mapping) => [mapping.ratioForColumnIndex as number, mapping]),
  );
  const accountMap = new Map(existingAccounts.map((account) => [account.id, account]));
  for (const mapping of accountMappings) {
    const name = mapping.accountName || mapping.header;
    const id = accountIdFromName(name);
    if (!accountMap.has(id)) {
      accountMap.set(id, {
        ...createAccountConfig(name),
        category: mapping.category ?? categoryForAccount(name),
        defaultCurrency: mapping.currency ?? 'CNY',
        includedInTotal: mapping.includedInTotal ?? true,
      });
    }
  }
  const accounts = [...accountMap.values()];

  const snapshots = draft.parsed.rows.map((row, rowIndex) => {
    const dateValue = dateMapping ? row[dateMapping.columnIndex] : '';
    const date = normalizeDate(dateValue, rowIndex);
    const entries = accountMappings.map((mapping) => {
      const accountName = mapping.accountName || mapping.header;
      const account = accountMap.get(accountIdFromName(accountName));
      const ratioMapping = ratioByAccountColumn.get(mapping.columnIndex);
      return buildEntry(
        accountName,
        parseNumber(row[mapping.columnIndex]),
        ratioMapping ? parseNumber(row[ratioMapping.columnIndex]) : null,
        account,
      );
    });
    return recalculateSnapshot({
      id: crypto.randomUUID(),
      date,
      exchangeRates: { ...defaultExchangeRates },
      entries,
      excelTotal: totalMapping ? parseNumber(row[totalMapping.columnIndex]) ?? undefined : undefined,
      computedTotalCny: 0,
      externalIncome: incomeMapping ? parseNumber(row[incomeMapping.columnIndex]) : null,
      note: noteMapping ? String(row[noteMapping.columnIndex] ?? '').trim() || undefined : undefined,
    });
  });

  return { snapshots: sortSnapshots(snapshots), accounts: mergeAccounts(accounts, snapshots) };
}

export function mergeImportedData(data: AppData, imported: AssetSnapshot[], accounts: AccountConfig[], duplicateMode: DuplicateDateMode): AppData {
  const seenDates = new Set(data.snapshots.map((snapshot) => snapshot.date));
  const merged = [...data.snapshots];
  for (const snapshot of imported) {
    const existing = seenDates.has(snapshot.date);
    if (!existing) {
      merged.push(snapshot);
      seenDates.add(snapshot.date);
      continue;
    }
    if (duplicateMode === 'skip') continue;
    if (duplicateMode === 'overwrite') {
      for (let index = merged.length - 1; index >= 0; index -= 1) {
        if (merged[index].date === snapshot.date) merged.splice(index, 1);
      }
      merged.push(snapshot);
    } else {
      merged.push({ ...snapshot, id: crypto.randomUUID() });
    }
    seenDates.add(snapshot.date);
  }
  return {
    ...data,
    accounts: mergeAccounts(accounts, merged),
    snapshots: sortSnapshots(merged.map(recalculateSnapshot)),
  };
}

function manualSnapshotAccounts(data: AppData, previous: AssetSnapshot | undefined): AccountConfig[] {
  return data.accounts.length > 0 ? data.accounts : previous?.entries.map((entry) => ({
    id: entry.accountId,
    name: entry.accountName,
    category: entry.category,
    defaultCurrency: entry.currency,
    includedInTotal: entry.includedInTotal,
    hidden: false,
  })) ?? [];
}

export type ManualSnapshotExtras = {
  externalIncome?: string;
  note?: string;
};

export function buildManualSnapshot(data: AppData, date: string, amountByAccountId: Record<string, string | undefined>, extras: ManualSnapshotExtras = {}): AssetSnapshot {
  const previous = data.snapshots[data.snapshots.length - 1];
  const accounts = manualSnapshotAccounts(data, previous);
  const exchangeRates = { ...data.defaultExchangeRates, ...(previous?.exchangeRates ?? {}) };
  return recalculateSnapshot({
    id: crypto.randomUUID(),
    date,
    exchangeRates: { ...exchangeRates },
    entries: accounts.map((account) => buildEntry(account.name, parseNumber(amountByAccountId[account.id]), null, account)),
    computedTotalCny: 0,
    externalIncome: extras.externalIncome === undefined ? null : parseNumber(extras.externalIncome),
    note: extras.note?.trim() || undefined,
  });
}

export function createManualSnapshot(data: AppData, date: string): AssetSnapshot {
  const previous = data.snapshots[data.snapshots.length - 1];
  const accounts = manualSnapshotAccounts(data, previous);
  const previousEntries = new Map(previous?.entries.map((entry) => [entry.accountId, entry]) ?? []);
  const amountByAccountId = Object.fromEntries(accounts.map((account) => [account.id, previousEntries.get(account.id)?.originalAmount?.toString() ?? '']));
  return buildManualSnapshot(data, date, amountByAccountId);
}

function normalizeDate(value: string | undefined, rowIndex: number): string {
  const raw = (value ?? '').trim();
  if (!raw) return `未命名日期 ${rowIndex + 1}`;
  const match = raw.match(/^(\d{4})[-/](\d{1,2})(?:[-/](\d{1,2}))?$/);
  if (!match) return raw.replace(/\//g, '-');
  const [, year, month, day = '1'] = match;
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}
