import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FireView } from './FireView';
import { createSampleData } from '../lib/sampleData';

describe('FireView', () => {
  it('renders FIRE settings and progress separately from review report', () => {
    render(<FireView data={createSampleData()} onChange={vi.fn()} />);

    expect(screen.getByText('FIRE TRACKER')).toBeTruthy();
    expect(screen.getByText('FIRE 仪表盘')).toBeTruthy();
    expect(screen.getByText('FIRE 设置')).toBeTruthy();
    expect(screen.queryByText('进度环')).toBeNull();
    expect(screen.getByText('FIRE 航线')).toBeTruthy();
    expect(screen.getByText('目标资产')).toBeTruthy();
    expect(screen.getByText('当前进度')).toBeTruthy();
    expect(screen.getByText('距离目标')).toBeTruthy();
    expect(screen.getByText('提取率场景')).toBeTruthy();
    expect(screen.getByText('历史速度估算')).toBeTruthy();
    expect(screen.getByText('最近一次更新')).toBeTruthy();
    expect(screen.getByText('近一年速度')).toBeTruthy();
    expect(screen.getByText('历史以来速度')).toBeTruthy();
    expect(screen.getByText('现金/银行卡可支撑月数')).toBeTruthy();
    expect(screen.getByText('预期年化收益率%')).toBeTruthy();
    expect(screen.queryByText('预计达成')).toBeNull();
    expect(screen.queryByText('每月主动净投入')).toBeNull();
  });
});
