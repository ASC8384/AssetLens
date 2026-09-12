import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { StrategyPanel } from './StrategyPanel';
import { createEmptyAppData } from '../lib/defaults';
import type { AppData } from '../lib/types';

describe('StrategyPanel', () => {
  it('exposes target parameters for cash reserve, risk bounds and category ratios', () => {
    render(<StrategyPanel data={createEmptyAppData()} onChange={vi.fn()} />);

    expect(screen.getByText(/应急备用金目标/)).toBeTruthy();
    expect(screen.getByText(/风险资产下限%/)).toBeTruthy();
    expect(screen.getByText(/风险资产上限%/)).toBeTruthy();
    expect(screen.getByText(/纯现金目标占比%/)).toBeTruthy();
    expect(screen.getByText(/稳健类目标占比%/)).toBeTruthy();
    expect(screen.getByText(/权益类目标占比%/)).toBeTruthy();
    expect(screen.getByText(/其他资产目标占比%/)).toBeTruthy();
    expect(screen.getByText(/负债目标占比%/)).toBeTruthy();
    expect((screen.getByDisplayValue('30000') as HTMLInputElement).value).toBe('30000');
    expect(screen.getByDisplayValue('35')).toBeTruthy();
    expect(screen.getByDisplayValue('65')).toBeTruthy();
  });

  it('saves a risk-asset bound as a ratio', () => {
    const onChange = vi.fn();
    render(<StrategyPanel data={createEmptyAppData()} onChange={onChange} />);

    fireEvent.change(screen.getByDisplayValue('35'), { target: { value: '40' } });

    const next = onChange.mock.calls[0][0] as AppData;
    expect(next.strategy.riskAssetMinRatio).toBe(0.4);
  });
});
