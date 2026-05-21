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
    expect(screen.getByText('FIRE进度')).toBeTruthy();
    expect(screen.getByText('FIRE 航线')).toBeTruthy();
    expect(screen.getAllByText('目标资产').length).toBeGreaterThan(0);
    expect(screen.getByText('当前进度')).toBeTruthy();
    expect(screen.getByText('距离目标')).toBeTruthy();
    expect(screen.getByText('提取率场景')).toBeTruthy();
    expect(screen.getByText('历史速度估算')).toBeTruthy();
    expect(screen.getByText('最近一次更新')).toBeTruthy();
    expect(screen.getByText('近一年速度')).toBeTruthy();
    expect(screen.getByText('历史以来速度')).toBeTruthy();
    expect(screen.getAllByText('现金/银行卡可支撑月数').length).toBeGreaterThan(0);
    expect(screen.getByText('预期年化收益率%')).toBeTruthy();
    expect(screen.getByText('目标拆解')).toBeTruthy();
    expect(screen.getByText('FIRE 目标按长期可投资资产估算；应急备用金单独检查。')).toBeTruthy();
    expect(screen.getByText('仅靠当前资产增长')).toBeTruthy();
    expect(screen.getByText('预计达成时间')).toBeTruthy();
    expect(screen.queryByText('按预期年化收益率')).toBeNull();
    expect(screen.queryByText('每月主动净投入')).toBeNull();
    expect(screen.queryByText('收入中断')).toBeNull();
  });

  it('shows return-only estimate as unavailable when current assets cannot compound', () => {
    const data = {
      ...createSampleData(),
      snapshots: [],
    };

    render(<FireView data={data} onChange={vi.fn()} />);

    expect(screen.getByText('无法按收益率单独估算')).toBeTruthy();
  });
});
