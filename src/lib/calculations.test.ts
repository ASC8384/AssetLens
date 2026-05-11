import { describe, expect, it } from 'vitest';
import { recalculateSnapshot } from './calculations';
import { parseNumber } from './format';
import { totalQuality } from './dashboard';
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

describe('dashboard helpers', () => {
  it('flags likely wrong total column when excel total is far from computed total', () => {
    const snapshot = recalculateSnapshot({
      id: 's1',
      date: '2026-05-01',
      exchangeRates: { CNY: 1 },
      computedTotalCny: 0,
      excelTotal: 8500,
      entries: [
        { ...baseEntry, originalAmount: 48000, excelRatio: 0.2637 },
        { ...baseEntry, accountId: 'cash', accountName: '现金账户A', category: '现金', originalAmount: 12000, excelRatio: 0.0659 },
      ],
    });

    expect(totalQuality(snapshot)).toMatchObject({
      status: 'danger',
      message: 'Excel 原合计和网页重算合计差异很大，请检查合计列是否识别正确。',
    });
  });
});

describe('importers', () => {
  it('ignores ratio columns by default and imports account amounts only', () => {
    const parsed = parsePastedTable('时间\t基金账户A\t占比\t现金账户B\t占比\t合计\n2026-05\t100\t50%\t100\t50%\t200');
    const draft = createImportDraft(parsed);

    expect(draft.mappings[2]).toMatchObject({ role: 'ignore', import: false });
    expect(draft.mappings[4]).toMatchObject({ role: 'ignore', import: false });

    const { snapshots } = buildSnapshotsFromDraft(draft, []);
    expect(snapshots[0].entries).toHaveLength(2);
    expect(snapshots[0].entries[0].excelRatio).toBeNull();
    expect(snapshots[0].computedTotalCny).toBe(200);
  });

  it('parses whitespace separated pasted tables from chat or plain text', () => {
    const input = `时间        基金账户A      占比    现金账户A      占比    现金账户B        占比    基金账户B        占比    基金账户C        占比    证券    占比    现金账户C
        占比    杂      占比    基金账户D    占比    合计
    2025-11-01  48000   26.37%  12000   6.59%   4500    2.47%   22000   12.09%  18000   9.89%   35000   19.23%  6000    3.30%   12000   6.59%   3000    1.65%   8500
    2025-12-01  50500   26.93%  10500   5.60%   5200    2.77%   23000   12.27%  18500   9.87%   36500   19.47%  5500    2.93%   13000   6.93%   2800    1.49%   9000`;

    const parsed = parsePastedTable(input);
    const draft = createImportDraft(parsed);
    const { snapshots } = buildSnapshotsFromDraft(draft, []);

    expect(parsed.headers).toEqual(['时间', '基金账户A', '占比', '现金账户A', '占比', '现金账户B', '占比', '基金账户B', '占比', '基金账户C', '占比', '证券', '占比', '现金账户C', '占比', '杂', '占比', '基金账户D', '占比', '合计']);
    expect(snapshots).toHaveLength(2);
    expect(snapshots[0].date).toBe('2025-11-01');
    expect(snapshots[0].entries).toHaveLength(9);
    expect(snapshots[0].entries[7]).toMatchObject({ accountName: '杂', originalAmount: 12000, excelRatio: null });
    expect(snapshots[0].entries[8]).toMatchObject({ accountName: '基金账户D', originalAmount: 3000, excelRatio: null });
    expect(snapshots[0].excelTotal).toBe(8500);
  });
});
