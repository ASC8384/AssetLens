import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { StrategyPanel } from './StrategyPanel';
import { createEmptyAppData } from '../lib/defaults';

describe('StrategyPanel', () => {
  it('shows strategy as a standalone configuration entry', () => {
    render(<StrategyPanel data={createEmptyAppData()} onChange={vi.fn()} />);

    expect(screen.getByRole('heading', { name: '资产策略' })).toBeTruthy();
    expect(screen.getByText('可自定义目标参数，影响仪表盘策略雷达和复盘报告。')).toBeTruthy();
    expect(screen.getByRole('button', { name: '展开策略' })).toBeTruthy();
    expect(screen.getByText('资产结构目标看板')).toBeTruthy();
    expect(screen.getByText('风险资产目标区间')).toBeTruthy();
  });
});
