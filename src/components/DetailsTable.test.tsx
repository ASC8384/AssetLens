import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DetailsTable } from './DetailsTable';
import { createSampleData } from '../lib/sampleData';
import type { AppData } from '../lib/types';

function analysisData(): AppData {
  const data = createSampleData();
  return { ...data, preferences: { ...data.preferences, detailMode: 'analysis' } };
}

describe('DetailsTable', () => {
  it('edits an account currency in analysis mode and recalculates CNY amount', () => {
    const data = analysisData();
    const onChange = vi.fn();

    render(<DetailsTable data={data} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('2026-05-01-基金账户A-币种'), { target: { value: 'USD' } });

    const updatedData = onChange.mock.calls[0][0] as AppData;
    const latest = updatedData.snapshots[updatedData.snapshots.length - 1];
    const entry = latest.entries.find((item) => item.accountName === '基金账户A');

    expect(entry).toMatchObject({ currency: 'USD', exchangeRate: 7.24 });
    expect(entry?.amountCny).toBeCloseTo(59000 * 7.24);
  });

  it('edits an account exchange rate in analysis mode and recalculates CNY amount', () => {
    const data = analysisData();
    const latest = data.snapshots[data.snapshots.length - 1];
    const usdData: AppData = {
      ...data,
      snapshots: data.snapshots.map((snapshot) => snapshot.id === latest.id ? {
        ...snapshot,
        exchangeRates: { ...snapshot.exchangeRates, USD: 7.24 },
        entries: snapshot.entries.map((entry) => entry.accountName === '基金账户A' ? { ...entry, currency: 'USD', exchangeRate: 7.24 } : entry),
      } : snapshot),
    };
    const onChange = vi.fn();

    render(<DetailsTable data={usdData} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('2026-05-01-基金账户A-汇率'), { target: { value: '7.5' } });

    const updatedData = onChange.mock.calls[0][0] as AppData;
    const updatedLatest = updatedData.snapshots[updatedData.snapshots.length - 1];
    const entry = updatedLatest.entries.find((item) => item.accountName === '基金账户A');

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
});
