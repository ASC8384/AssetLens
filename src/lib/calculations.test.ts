import { describe, expect, it } from 'vitest';
import { recalculateSnapshot } from './calculations';
import { parseNumber } from './format';
import { createImportDraft, buildSnapshotsFromDraft, parsePastedTable } from './importers';

const baseEntry = {
  accountId: 'fund',
  accountName: '基金',
  category: '基金' as const,
  originalAmount: 100,
  currency: 'CNY',
  exchangeRate: 1,
  amountCny: null,
  excelRatio: 0.4,
  computedRatio: null,
  ratioDiff: null,
  includedInTotal: true,
};

describe('parseNumber', () => {
  it('parses currency, comma, dash, blank and percent values', () => {
    expect(parseNumber('￥1,234.56')).toBe(1234.56);
    expect(parseNumber('-')).toBeNull();
    expect(parseNumber('')).toBeNull();
    expect(parseNumber('12.5%')).toBe(0.125);
  });
});

describe('recalculateSnapshot', () => {
  it('computes CNY totals, ratios and ratio diff', () => {
    const snapshot = recalculateSnapshot({
      id: 's1',
      date: '2026-05-01',
      exchangeRates: { CNY: 1, USD: 7 },
      computedTotalCny: 0,
      entries: [
        baseEntry,
        { ...baseEntry, accountId: 'cash', accountName: '现金', category: '现金', originalAmount: 100, excelRatio: 0.6 },
      ],
    });

    expect(snapshot.computedTotalCny).toBe(200);
    expect(snapshot.entries[0].computedRatio).toBe(0.5);
    expect(snapshot.entries[0].ratioDiff).toBeCloseTo(0.1);
  });

  it('keeps foreign currency unavailable when exchange rate is missing', () => {
    const snapshot = recalculateSnapshot({
      id: 's1',
      date: '2026-05-01',
      exchangeRates: { CNY: 1 },
      computedTotalCny: 0,
      entries: [{ ...baseEntry, currency: 'USD', exchangeRate: null }],
    });

    expect(snapshot.entries[0].amountCny).toBeNull();
    expect(snapshot.computedTotalCny).toBe(0);
  });
});

describe('importers', () => {
  it('pairs duplicate ratio headers with previous account columns', () => {
    const parsed = parsePastedTable('时间\t基金账户A\t占比\t现金账户B\t占比\t合计\n2026-05\t100\t50%\t100\t50%\t200');
    const draft = createImportDraft(parsed);

    expect(draft.mappings[2]).toMatchObject({ role: 'ratio', ratioForColumnIndex: 1 });
    expect(draft.mappings[4]).toMatchObject({ role: 'ratio', ratioForColumnIndex: 3 });

    const { snapshots } = buildSnapshotsFromDraft(draft, []);
    expect(snapshots[0].entries).toHaveLength(2);
    expect(snapshots[0].entries[0].excelRatio).toBe(0.5);
    expect(snapshots[0].computedTotalCny).toBe(200);
  });
});
