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
    expect(screen.getAllByText('距离目标').length).toBeGreaterThan(0);
    expect(screen.getByText('FIRE 敏感性矩阵')).toBeTruthy();
    expect(screen.getAllByText('当前配置').length).toBeGreaterThan(0);
    expect(screen.queryByText('提取率场景')).toBeNull();
    expect(screen.getByText('历史速度估算')).toBeTruthy();
    expect(screen.getByText('最近一次更新')).toBeTruthy();
    expect(screen.getByText('近一年速度')).toBeTruthy();
    expect(screen.getByText('历史以来速度')).toBeTruthy();
    expect(screen.getAllByText('可信度').length).toBeGreaterThan(0);
    expect(screen.getByText(/2026-04-01 → 2026-05-01/)).toBeTruthy();
    expect(screen.getAllByText('现金/银行卡可支撑月数').length).toBeGreaterThan(0);
    expect(screen.getByText('预期年化收益率%')).toBeTruthy();
    expect(screen.queryByText('目标差距速览')).toBeNull();
    expect(screen.queryByText('估算边界')).toBeNull();
    expect(screen.queryByText('配置影响')).toBeNull();
    expect(screen.getByText('FIRE 结论摘要')).toBeTruthy();
    expect(screen.getByText('变量影响排行')).toBeTruthy();
    expect(screen.getByText('预计目标年月')).toBeTruthy();
    expect(screen.getByText('FIRE 核心假设')).toBeTruthy();
    expect(screen.getByText('目标拆解')).toBeTruthy();
    expect(screen.getByText('矩阵阅读方式')).toBeTruthy();
    expect(screen.getByText('仅靠当前资产增长')).toBeTruthy();
    expect(screen.getByText('FIRE 目标按长期可投资资产估算；应急备用金单独检查。')).toBeTruthy();
    expect(screen.getByText('仅靠当前资产增长')).toBeTruthy();
    expect(screen.getAllByText(/当前资产/).length).toBeGreaterThan(0);
    expect(screen.queryByText('按预期年化收益率')).toBeNull();
    expect(screen.queryByText('每月主动净投入')).toBeNull();
    expect(screen.queryByText('收入中断')).toBeNull();
    expect(screen.getByText(/本期外界收入 · 记录于 2026-05-01/)).toBeTruthy();
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
