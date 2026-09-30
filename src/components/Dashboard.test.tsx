import { fireEvent, render, screen } from '@testing-library/react';
import { recalculateSnapshot } from '../lib/calculations';
import type { AssetSnapshot } from '../lib/types';
import { describe, expect, it, vi } from 'vitest';
import { Dashboard } from './Dashboard';
import { createSampleData } from '../lib/sampleData';

function snapshot(id: string, date: string, amount: number): AssetSnapshot {
  return recalculateSnapshot({
    id,
    date,
    exchangeRates: { CNY: 1 },
    computedTotalCny: 0,
    entries: [{
      accountId: 'fund',
      accountName: '场外基金A',
      category: '权益类',
      venue: '场外',
      originalAmount: amount,
      currency: 'CNY',
      exchangeRate: 1,
      amountCny: null,
      excelRatio: null,
      computedRatio: null,
      ratioDiff: null,
      includedInTotal: true,
    }],
  });
}

describe('Dashboard', () => {
  it('does not show import quality concerns in the dashboard', () => {
    render(<Dashboard data={createSampleData()} />);

    expect(screen.queryByText(/导入质量/)).toBeNull();
    expect(screen.queryByText(/Excel 原合计/)).toBeNull();
    expect(screen.queryByText(/数据质量/)).toBeNull();
    expect(screen.queryByText(/合计列可能识别错/)).toBeNull();
  });

  it('renders account insight summary for the selected snapshot', () => {
    render(<Dashboard data={createSampleData()} />);

    expect(screen.getByText('本月资产复盘入口')).toBeTruthy();
    expect(screen.getByText('生成本月复盘')).toBeTruthy();
    expect(screen.getByText('查看时点')).toBeTruthy();
    expect(screen.getByLabelText('2026 年快照')).toBeTruthy();
    expect(screen.getByRole('button', { name: '2026-03-01' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '2026-05-01' })).toBeTruthy();
    expect(screen.getByText('账户洞察')).toBeTruthy();
    expect(screen.getByText('增长账户 Top 5')).toBeTruthy();
    expect(screen.getByText('下降账户 Top 5')).toBeTruthy();
    expect(screen.getByText('账户集中度')).toBeTruthy();
    expect(screen.getByText('净资产')).toBeTruthy();
    expect(screen.getAllByText('负债').length).toBeGreaterThan(0);
    expect(screen.getAllByText('本期外界收入').length).toBeGreaterThan(0);
  });

  it('labels duplicate-date snapshots so users can distinguish kept imports', () => {
    const data = {
      ...createSampleData(),
      snapshots: [
        snapshot('jan', '2026-01-01', 100),
        snapshot('first-same-date', '2026-02-01', 120),
        snapshot('second-same-date', '2026-02-01', 220),
      ],
    };

    render(<Dashboard data={data} />);

    expect(screen.getByRole('button', { name: '2026-02-01 · 同日第 1 条' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '2026-02-01 · 同日第 2 条' })).toBeTruthy();
  });

  it('reuses the last recorded external income and marks its date', () => {
    const data = {
      ...createSampleData(),
      snapshots: [
        { ...snapshot('jan', '2026-01-01', 100), externalIncome: 8000 },
        snapshot('feb', '2026-02-01', 120),
      ],
    };

    render(<Dashboard data={data} />);

    expect(screen.getAllByText(/沿用 2026-01-01/).length).toBeGreaterThan(0);
    expect(screen.getAllByText('¥8,000.00').length).toBeGreaterThan(0);
  });

  it('navigates between snapshots without leaving the latest-follow mode until a period is chosen', () => {
    render(<Dashboard data={createSampleData()} />);

    expect(screen.getByText('最新净资产 · 2026-05-01')).toBeTruthy();
    expect((screen.getByRole('button', { name: '下一期' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: '最新一期' }) as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: '上一期' }));

    expect(screen.getByText('选中时点 · 2026-04-01')).toBeTruthy();
    expect(screen.getByRole('button', { name: '2026-04-01' }).className).toContain('active');
    expect((screen.getByRole('button', { name: '最新一期' }) as HTMLButtonElement).disabled).toBe(false);

    fireEvent.click(screen.getByRole('button', { name: '最新一期' }));
    expect(screen.getByText('最新净资产 · 2026-05-01')).toBeTruthy();
  });

  it('lets the user pick a snapshot from the wrapped date list', () => {
    render(<Dashboard data={createSampleData()} />);

    fireEvent.click(screen.getByRole('button', { name: '2026-01-01' }));

    expect(screen.getByText('选中时点 · 2026-01-01')).toBeTruthy();
    expect(screen.getByRole('button', { name: '2026-01-01' }).className).toContain('active');
    expect((screen.getByRole('button', { name: '上一期' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('groups snapshot dates by year so long histories stay scannable', () => {
    const data = {
      ...createSampleData(),
      snapshots: [
        snapshot('y24', '2024-12-01', 80),
        snapshot('y25', '2025-06-01', 90),
        snapshot('y26', '2026-05-01', 120),
      ],
    };

    render(<Dashboard data={data} />);

    expect(screen.getByText('2024 年')).toBeTruthy();
    expect(screen.getByText('2025 年')).toBeTruthy();
    expect(screen.getByText('2026 年')).toBeTruthy();
    expect(screen.getByRole('button', { name: '2024-12-01' }).textContent).toContain('12月');
    expect(screen.getByRole('button', { name: '2026-05-01' }).textContent).toContain('5月');
  });

  it('opens a monthly review for the selected snapshot calendar month', () => {
    const onOpenMonthlyReview = vi.fn();
    render(<Dashboard data={createSampleData()} onOpenMonthlyReview={onOpenMonthlyReview} />);

    fireEvent.click(screen.getByRole('button', { name: '生成本月复盘' }));
    expect(onOpenMonthlyReview).toHaveBeenCalledWith({ startDate: '2026-05-01', endDate: '2026-05-31', preset: 'custom' });

    fireEvent.click(screen.getByRole('button', { name: '上一期' }));
    fireEvent.click(screen.getByRole('button', { name: '生成本月复盘' }));
    expect(onOpenMonthlyReview).toHaveBeenLastCalledWith({ startDate: '2026-04-01', endDate: '2026-04-30', preset: 'custom' });
  });
});
