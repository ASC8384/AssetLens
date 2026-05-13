import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FireView } from './FireView';
import { createSampleData } from '../lib/sampleData';

describe('FireView', () => {
  it('renders FIRE settings and progress separately from review report', () => {
    render(<FireView data={createSampleData()} onChange={vi.fn()} />);

    expect(screen.getByText('FIRE TRACKER')).toBeTruthy();
    expect(screen.getByText('FIRE 设置')).toBeTruthy();
    expect(screen.getByText('提取率场景')).toBeTruthy();
    expect(screen.getByText('预期年化收益率%')).toBeTruthy();
    expect(screen.queryByText('预计达成')).toBeNull();
    expect(screen.queryByText('每月主动净投入')).toBeNull();
  });
});
