import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DataHealthCard } from './DataHealthCard';
import { createEmptyAppData } from '../lib/defaults';
import { createSampleData } from '../lib/sampleData';

describe('DataHealthCard', () => {
  it('renders empty data guidance', () => {
    render(<DataHealthCard data={createEmptyAppData()} />);

    expect(screen.getByText('还没有数据')).toBeTruthy();
    expect(screen.getByText('还没有数据：先导入 Excel 或载入示例数据。')).toBeTruthy();
    expect(screen.getByText('展开导入区开始导入')).toBeTruthy();
  });

  it('renders data metrics and navigates to report for healthy data', () => {
    const onNavigate = vi.fn();

    render(<DataHealthCard data={createSampleData()} onNavigate={onNavigate} />);

    expect(screen.getByText('数据正常')).toBeTruthy();
    expect(screen.getByText('快照期数')).toBeTruthy();
    expect(screen.getByText('账户数量')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '生成复盘' }));

    expect(onNavigate).toHaveBeenCalledWith('report');
  });
});
