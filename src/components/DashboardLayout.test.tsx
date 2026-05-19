import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { Dashboard } from './Dashboard';
import { createSampleData } from '../lib/sampleData';

vi.mock('recharts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('recharts')>();
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
    LineChart: ({ data, children }: { data?: unknown[]; children?: ReactNode }) => <div data-testid="line-chart" data-has-daily-change={String(data?.some((row) => typeof row === 'object' && row !== null && 'dailyChange' in row))}>{children}</div>,
  };
});

describe('Dashboard layout', () => {
  it('fills the bottom right grid slot with strategy radar', () => {
    render(<Dashboard data={createSampleData()} />);

    expect(screen.getByText('策略雷达')).toBeTruthy();
    expect(screen.getAllByText(/应急备用金/).length).toBeGreaterThan(0);
  });

  it('shows daily net asset change between snapshot intervals as a line chart', () => {
    render(<Dashboard data={createSampleData()} />);

    expect(screen.getByText('区间日均资产净增')).toBeTruthy();
    expect(screen.getAllByTestId('line-chart').some((chart) => chart.dataset.hasDailyChange === 'true')).toBe(true);
  });
});
