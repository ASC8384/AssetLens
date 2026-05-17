import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Dashboard } from './Dashboard';
import { createSampleData } from '../lib/sampleData';

describe('Dashboard layout', () => {
  it('fills the bottom right grid slot with strategy radar', () => {
    render(<Dashboard data={createSampleData()} />);

    expect(screen.getByText('策略雷达')).toBeTruthy();
    expect(screen.getAllByText(/应急备用金/).length).toBeGreaterThan(0);
  });

  it('shows daily net asset change between snapshot intervals', () => {
    render(<Dashboard data={createSampleData()} />);

    expect(screen.getByText('区间日均资产净增')).toBeTruthy();
  });
});
