import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Dashboard } from './Dashboard';
import { createSampleData } from '../lib/sampleData';

describe('Dashboard', () => {
  it('does not show import quality concerns in the dashboard', () => {
    render(<Dashboard data={createSampleData()} />);

    expect(screen.queryByText(/导入质量/)).toBeNull();
    expect(screen.queryByText(/Excel 原合计/)).toBeNull();
    expect(screen.queryByText(/数据质量/)).toBeNull();
    expect(screen.queryByText(/合计列可能识别错/)).toBeNull();
  });
});
