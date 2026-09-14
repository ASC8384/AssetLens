import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DetailsTable } from './DetailsTable';
import { createSampleData } from '../lib/sampleData';
import { defaultExchangeRates } from '../lib/defaults';
import { snapshotsOnDate } from '../lib/snapshotDates';
import type { AppData } from '../lib/types';

function analysisData(): AppData {
  const data = createSampleData();
  return { ...data, preferences: { ...data.preferences, detailMode: 'analysis' } };
}

describe('DetailsTable', () => {
  afterEach(() => {
    vi.useRealTimers();
  });
  it('edits an account currency in analysis mode and recalculates CNY amount', () => {
    const data = analysisData();
    const onChange = vi.fn();

    render(<DetailsTable data={data} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('2026-05-01-场外基金A-币种'), { target: { value: 'USD' } });

    const updatedData = onChange.mock.calls[0][0] as AppData;
    const latest = updatedData.snapshots[updatedData.snapshots.length - 1];
    const entry = latest.entries.find((item) => item.accountName === '场外基金A');

    expect(entry).toMatchObject({ currency: 'USD', exchangeRate: defaultExchangeRates.USD });
    expect(entry?.amountCny).toBeCloseTo(59000 * defaultExchangeRates.USD);
  });

  it('edits an account exchange rate in analysis mode and recalculates CNY amount', () => {
    const data = analysisData();
    const latest = data.snapshots[data.snapshots.length - 1];
    const usdData: AppData = {
      ...data,
      snapshots: data.snapshots.map((snapshot) => snapshot.id === latest.id ? {
        ...snapshot,
        exchangeRates: { ...snapshot.exchangeRates, USD: 7.24 },
        entries: snapshot.entries.map((entry) => entry.accountName === '场外基金A' ? { ...entry, currency: 'USD', exchangeRate: 7.24 } : entry),
      } : snapshot),
    };
    const onChange = vi.fn();

    render(<DetailsTable data={usdData} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('2026-05-01-场外基金A-汇率'), { target: { value: '7.5' } });

    const updatedData = onChange.mock.calls[0][0] as AppData;
    const updatedLatest = updatedData.snapshots[updatedData.snapshots.length - 1];
    const entry = updatedLatest.entries.find((item) => item.accountName === '场外基金A');

    expect(updatedLatest.exchangeRates.USD).toBe(7.5);
    expect(entry).toMatchObject({ currency: 'USD', exchangeRate: 7.5 });
    expect(entry?.amountCny).toBeCloseTo(59000 * 7.5);
  });

  it('edits external income on a snapshot', () => {
    const data = createSampleData();
    const onChange = vi.fn();

    render(<DetailsTable data={data} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('2026-05-01-外界收入'), { target: { value: '15000' } });

    const updatedData = onChange.mock.calls[0][0] as AppData;
    expect(updatedData.snapshots[updatedData.snapshots.length - 1].externalIncome).toBe(15000);
  });

  it('changes a snapshot date immediately when the target date is free', () => {
    const onChange = vi.fn();
    render(<DetailsTable data={createSampleData()} onChange={onChange} />);

    fireEvent.change(screen.getByLabelText('2026-05-01-日期'), { target: { value: '2026-05-15' } });

    const updatedData = onChange.mock.calls[0][0] as AppData;
    expect(updatedData.snapshots.some((snapshot) => snapshot.date === '2026-05-15')).toBe(true);
    expect(updatedData.snapshots.some((snapshot) => snapshot.date === '2026-05-01')).toBe(false);
  });

  it('asks before changing onto an existing date and can keep both snapshots', () => {
    const onChange = vi.fn();
    render(<DetailsTable data={createSampleData()} onChange={onChange} />);

    fireEvent.change(screen.getByLabelText('2026-05-01-日期'), { target: { value: '2026-04-01' } });
    expect(onChange).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: '保留同日记录' }));
    const updatedData = onChange.mock.calls[0][0] as AppData;
    expect(snapshotsOnDate(updatedData.snapshots, '2026-04-01')).toHaveLength(2);
    expect(updatedData.snapshots).toHaveLength(3);
  });

  it('can overwrite or cancel when copying onto an existing date', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-20T12:00:00'));
    const onChange = vi.fn();
    render(<DetailsTable data={createSampleData()} onChange={onChange} />);

    fireEvent.click(screen.getByLabelText('复制 2026-05-01'));
    const dialog = screen.getByRole('dialog');
    expect((within(dialog).getByLabelText('快照日期') as HTMLInputElement).value).toBe('2026-05-20');

    fireEvent.click(within(dialog).getByRole('button', { name: '复制' }));
    expect(onChange.mock.calls[0][0].snapshots).toHaveLength(4);

    fireEvent.click(screen.getByLabelText('复制 2026-05-01'));
    fireEvent.change(screen.getByLabelText('快照日期'), { target: { value: '2026-04-01' } });
    fireEvent.click(screen.getByRole('button', { name: '覆盖已有记录' }));

    const overwritten = onChange.mock.calls[1][0] as AppData;
    expect(overwritten.snapshots).toHaveLength(3);
    expect(snapshotsOnDate(overwritten.snapshots, '2026-04-01')).toHaveLength(1);

    fireEvent.click(screen.getByLabelText('复制 2026-03-01'));
    fireEvent.change(screen.getByLabelText('快照日期'), { target: { value: '2026-04-01' } });
    fireEvent.click(within(screen.getByRole('dialog')).getByText('取消'));
    expect(onChange).toHaveBeenCalledTimes(2);
  });
});
