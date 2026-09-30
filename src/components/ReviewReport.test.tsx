import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ReviewReport } from './ReviewReport';
import { createSampleData } from '../lib/sampleData';
import type { AppData } from '../lib/types';

function withExtraSnapshot(data: AppData, date: string): AppData {
  const latest = data.snapshots[data.snapshots.length - 1];
  return { ...data, snapshots: [...data.snapshots, { ...latest, id: `extra-${date}`, date }] };
}

describe('ReviewReport', () => {
  it('uses date inputs and highlights the all-range shortcut', () => {
    render(<ReviewReport data={createSampleData()} />);

    expect((screen.getByLabelText('开始') as HTMLInputElement).type).toBe('date');
    expect((screen.getByLabelText('开始') as HTMLInputElement).value).toBe('2026-01-01');
    expect((screen.getByLabelText('结束') as HTMLInputElement).value).toBe('2026-05-01');
    expect(screen.getByRole('button', { name: '全部' }).className).toContain('active');
    expect(screen.getByText(/已选 2026-01-01 → 2026-05-01 · 5 期快照/)).toBeTruthy();
  });

  it('applies a dashboard month request without rewriting it after render', () => {
    render(<ReviewReport data={createSampleData()} rangeRequest={{ startDate: '2026-04-01', endDate: '2026-04-30', preset: 'custom' }} />);

    expect((screen.getByLabelText('开始') as HTMLInputElement).value).toBe('2026-04-01');
    expect((screen.getByLabelText('结束') as HTMLInputElement).value).toBe('2026-04-30');
    expect(screen.getByRole('button', { name: '本月' }).className).not.toContain('active');
    expect(screen.getByText(/已选 2026-04-01 → 2026-04-30 · 1 期快照/)).toBeTruthy();
  });

  it('highlights 本月 when the requested range matches the latest snapshot month', () => {
    render(<ReviewReport data={createSampleData()} rangeRequest={{ startDate: '2026-05-01', endDate: '2026-05-31', preset: 'custom' }} />);

    expect(screen.getByRole('button', { name: '本月' }).className).toContain('active');
  });

  it('shows an error when the start date is after the end date', () => {
    render(<ReviewReport data={createSampleData()} />);

    fireEvent.change(screen.getByLabelText('开始'), { target: { value: '2026-05-20' } });
    fireEvent.change(screen.getByLabelText('结束'), { target: { value: '2026-05-01' } });

    expect(screen.getAllByText('开始日期不能晚于结束日期。').length).toBeGreaterThan(0);
    expect(screen.getByText('当前范围没有记录')).toBeTruthy();
  });

  it('keeps shortcut ranges following new snapshots', () => {
    const data = createSampleData();
    const { rerender } = render(<ReviewReport data={data} />);

    fireEvent.click(screen.getByRole('button', { name: '近 1 个月' }));
    expect((screen.getByLabelText('开始') as HTMLInputElement).value).toBe('2026-04-01');
    expect((screen.getByLabelText('结束') as HTMLInputElement).value).toBe('2026-05-01');

    rerender(<ReviewReport data={withExtraSnapshot(data, '2026-06-01')} />);

    expect((screen.getByLabelText('开始') as HTMLInputElement).value).toBe('2026-05-01');
    expect((screen.getByLabelText('结束') as HTMLInputElement).value).toBe('2026-06-01');
    expect(screen.getByRole('button', { name: '近 1 个月' }).className).toContain('active');
  });

  it('does not overwrite a custom range when new snapshots arrive', () => {
    const data = createSampleData();
    const { rerender } = render(<ReviewReport data={data} />);

    fireEvent.change(screen.getByLabelText('开始'), { target: { value: '2026-03-15' } });
    rerender(<ReviewReport data={withExtraSnapshot(data, '2026-06-01')} />);

    expect((screen.getByLabelText('开始') as HTMLInputElement).value).toBe('2026-03-15');
    expect((screen.getByLabelText('结束') as HTMLInputElement).value).toBe('2026-05-01');
  });
});
