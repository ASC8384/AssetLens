import * as XLSX from 'xlsx';
import { accountIdFromName, categoryForAccount, createAccountConfig, defaultExchangeRates } from './defaults';
import { buildEntry, mergeAccounts, recalculateSnapshot, sortSnapshots } from './calculations';
import { parseNumber } from './format';
import type { AccountConfig, AppData, AssetSnapshot, DuplicateDateMode, FieldMapping, ImportDraft, ParsedTable } from './types';

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
    return {
      columnIndex,
      header,
      role: 'account',
      accountName: normalized,
      category: categoryForAccount(normalized),
      currency: 'CNY',
      includedInTotal: true,
      import: true,
      sampleValues,
    };
  });
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
    });
  });

  return { snapshots: sortSnapshots(snapshots), accounts: mergeAccounts(accounts, snapshots) };
}

export function mergeImportedData(data: AppData, imported: AssetSnapshot[], accounts: AccountConfig[], duplicateMode: DuplicateDateMode): AppData {
  const byDate = new Map(data.snapshots.map((snapshot) => [snapshot.date, snapshot]));
  const merged = [...data.snapshots];
  for (const snapshot of imported) {
    const existing = byDate.get(snapshot.date);
    if (!existing) {
      merged.push(snapshot);
      continue;
    }
    if (duplicateMode === 'skip') continue;
    if (duplicateMode === 'overwrite') {
      const index = merged.findIndex((item) => item.date === snapshot.date);
      merged[index] = snapshot;
    } else {
      merged.push({ ...snapshot, id: crypto.randomUUID(), date: `${snapshot.date} #${crypto.randomUUID().slice(0, 4)}` });
    }
  }
  return {
    ...data,
    accounts: mergeAccounts(accounts, merged),
    snapshots: sortSnapshots(merged.map(recalculateSnapshot)),
  };
}

export function createManualSnapshot(data: AppData, date: string): AssetSnapshot {
  const previous = data.snapshots[data.snapshots.length - 1];
  const accounts = data.accounts.length > 0 ? data.accounts : previous?.entries.map((entry) => ({
    id: entry.accountId,
    name: entry.accountName,
    category: entry.category,
    defaultCurrency: entry.currency,
    includedInTotal: entry.includedInTotal,
    hidden: false,
  })) ?? [];
  const exchangeRates = previous?.exchangeRates ?? data.defaultExchangeRates;
  const previousEntries = new Map(previous?.entries.map((entry) => [entry.accountId, entry]) ?? []);
  return recalculateSnapshot({
    id: crypto.randomUUID(),
    date,
    exchangeRates: { ...exchangeRates },
    entries: accounts.map((account) => {
      const prior = previousEntries.get(account.id);
      return buildEntry(account.name, prior?.originalAmount ?? null, null, account);
    }),
    computedTotalCny: 0,
  });
}

function normalizeDate(value: string | undefined, rowIndex: number): string {
  const raw = (value ?? '').trim();
  if (!raw) return `未命名日期 ${rowIndex + 1}`;
  return raw.replace(/\//g, '-');
}
