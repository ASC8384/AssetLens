import { describe, expect, it } from 'vitest';
import { analyzeImportQuality, ignoreTotalColumns } from './importQuality';
import { buildSnapshotsFromDraft, createImportDraft, parsePastedTable } from './importers';

describe('import quality', () => {
  it('summarizes import preview and flags suspicious total columns', () => {
    const draft = createImportDraft(parsePastedTable('时间\t基金账户A\t占比\t现金账户A\t占比\t合计\n2026-05-01\t62000\t28.25%\t8800\t4.01%\t9800'));
    const imported = buildSnapshotsFromDraft(draft, []);
    const quality = analyzeImportQuality(imported.snapshots, imported.accounts.length);

    expect(quality).toMatchObject({
      snapshotCount: 1,
      accountCount: 2,
      dangerCount: 1,
      warningCount: 0,
      hasSuspiciousTotal: true,
    });
    expect(quality.rows[0]).toMatchObject({
      date: '2026-05-01',
      computedTotalCny: 70800,
      excelTotal: 9800,
      status: 'danger',
    });
  });

  it('can disable all total mappings before import', () => {
    const draft = createImportDraft(parsePastedTable('时间\t基金账户A\t合计\n2026-05-01\t62000\t9800'));
    const next = ignoreTotalColumns(draft);

    expect(next.mappings.find((mapping) => mapping.header === '合计')).toMatchObject({ role: 'ignore', import: false });
  });
});
