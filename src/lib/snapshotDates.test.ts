import { describe, expect, it } from 'vitest';
import { applySnapshotDateChange, duplicateSnapshotWithDate, snapshotsOnDate } from './snapshotDates';
import { createSampleData } from './sampleData';

describe('snapshot date mutations', () => {
  it('counts other snapshots on a date', () => {
    const data = createSampleData();
    expect(snapshotsOnDate(data.snapshots, '2026-05-01')).toHaveLength(1);
    expect(snapshotsOnDate(data.snapshots, '2026-05-01', data.snapshots[2].id)).toHaveLength(0);
  });

  it('keeps the same snapshot id when changing date without conflict', () => {
    const data = createSampleData();
    const target = data.snapshots[0];
    const next = applySnapshotDateChange(data, target.id, '2026-03-15', 'keep');
    expect(next.snapshots.find((snapshot) => snapshot.id === target.id)?.date).toBe('2026-03-15');
    expect(next.snapshots).toHaveLength(3);
  });

  it('overwrites existing snapshots when changing onto a taken date', () => {
    const data = createSampleData();
    const march = data.snapshots[0];
    const may = data.snapshots[2];
    const next = applySnapshotDateChange(data, march.id, may.date, 'overwrite');
    expect(next.snapshots).toHaveLength(2);
    expect(next.snapshots.some((snapshot) => snapshot.id === may.id)).toBe(false);
    expect(next.snapshots.find((snapshot) => snapshot.id === march.id)?.date).toBe('2026-05-01');
  });

  it('can keep two snapshots on the same date', () => {
    const data = createSampleData();
    const march = data.snapshots[0];
    const next = applySnapshotDateChange(data, march.id, '2026-05-01', 'keep');
    expect(snapshotsOnDate(next.snapshots, '2026-05-01')).toHaveLength(2);
    expect(next.snapshots).toHaveLength(3);
  });

  it('duplicates a snapshot onto a new date', () => {
    const data = createSampleData();
    const source = data.snapshots[2];
    const next = duplicateSnapshotWithDate(data, source.id, '2026-05-20', 'keep');
    expect(next.snapshots).toHaveLength(4);
    expect(next.snapshots[3]).toMatchObject({ date: '2026-05-20', computedTotalCny: source.computedTotalCny });
    expect(next.snapshots[3].id).not.toBe(source.id);
  });

  it('overwrites the target date when duplicating onto an existing snapshot', () => {
    const data = createSampleData();
    const source = data.snapshots[2];
    const april = data.snapshots[1];
    const next = duplicateSnapshotWithDate(data, source.id, april.date, 'overwrite');
    expect(next.snapshots).toHaveLength(3);
    expect(next.snapshots.some((snapshot) => snapshot.id === april.id)).toBe(false);
    expect(snapshotsOnDate(next.snapshots, '2026-04-01')).toHaveLength(1);
  });
});
