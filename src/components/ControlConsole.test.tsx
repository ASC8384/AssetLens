import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ControlConsole, type ConsolePanelId } from './ControlConsole';
import { createEmptyAppData } from '../lib/defaults';
import { formatMoney, formatPercent } from '../lib/format';
import { createSampleData } from '../lib/sampleData';
import { analyzeStrategy } from '../lib/strategy';
import type { AppData } from '../lib/types';

function renderConsole(data: AppData, initial: ConsolePanelId | null = null) {
  function Harness() {
    const [activePanel, setActivePanel] = useState<ConsolePanelId | null>(initial);
    return (
      <ControlConsole data={data} activePanel={activePanel} onActivePanelChange={setActivePanel}>
        {{
          import: <div>导入内容</div>,
          strategy: <div>策略内容</div>,
          config: <div>配置内容</div>,
        }}
      </ControlConsole>
    );
  }

  return render(<Harness />);
}

describe('ControlConsole', () => {
  it('renders three equal entry cards with status chips', () => {
    renderConsole(createSampleData());
    const sample = createSampleData();
    const analysis = analyzeStrategy(sample.snapshots[sample.snapshots.length - 1], sample.strategy);
    const range = `${formatPercent(sample.strategy.riskAssetMinRatio)}–${formatPercent(sample.strategy.riskAssetMaxRatio)}`;

    expect(screen.getByRole('heading', { name: '导入数据' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: '资产策略' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: '账户与汇率配置' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '展开导入区' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '展开策略' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '展开配置' })).toBeTruthy();
    expect(screen.getByText('3 期记录')).toBeTruthy();
    expect(screen.getByText('最近 2026-05-01')).toBeTruthy();
    expect(screen.getByText(`风险资产 ${formatPercent(analysis.riskAssetRatio)}（区间 ${range}）`)).toBeTruthy();
    expect(screen.getByText('偏高')).toBeTruthy();
    expect(screen.getByText('应急备用金已达标')).toBeTruthy();
    expect(screen.getByText('9 个账户')).toBeTruthy();
    expect(screen.getByText('4 个币种')).toBeTruthy();
  });

  it('keeps bodies mounted and only expands one panel at a time', () => {
    const { container } = renderConsole(createSampleData());
    const bodies = () => [...container.querySelectorAll('.console-body')];
    const visibleBody = () => bodies().find((body) => !body.hasAttribute('hidden'));

    expect(bodies()).toHaveLength(3);
    expect(bodies().filter((body) => body.hasAttribute('hidden'))).toHaveLength(3);
    expect(screen.getByRole('button', { name: '展开导入区' }).getAttribute('aria-expanded')).toBe('false');

    fireEvent.click(screen.getByRole('button', { name: '展开策略' }));
    expect(visibleBody()?.textContent).toContain('策略内容');
    expect(bodies().filter((body) => body.hasAttribute('hidden'))).toHaveLength(2);
    expect(screen.getByRole('button', { name: '收起策略' }).getAttribute('aria-expanded')).toBe('true');

    fireEvent.click(screen.getByRole('button', { name: '展开配置' }));
    expect(visibleBody()?.textContent).toContain('配置内容');
    expect(bodies().some((body) => body.hasAttribute('hidden') && body.textContent?.includes('策略内容'))).toBe(true);
    expect(screen.getByRole('button', { name: '展开策略' }).getAttribute('aria-expanded')).toBe('false');
    expect(screen.getByRole('button', { name: '收起配置' }).getAttribute('aria-expanded')).toBe('true');
  });

  it('shows empty-state chips before any snapshot exists', () => {
    renderConsole(createEmptyAppData());
    const range = `${formatPercent(0.35)}–${formatPercent(0.65)}`;

    expect(screen.getByText('0 期记录')).toBeTruthy();
    expect(screen.getByText('尚无数据')).toBeTruthy();
    expect(screen.getByText(`风险资产 —（区间 ${range}）`)).toBeTruthy();
    expect(screen.getByText('应急备用金暂无数据')).toBeTruthy();
    expect(screen.getByText('0 个账户')).toBeTruthy();
    expect(screen.getByText('4 个币种')).toBeTruthy();
  });

  it('formats a cash reserve shortfall with formatMoney and flags unclassified accounts', () => {
    const sample = createSampleData();
    const data: AppData = {
      ...sample,
      strategy: { ...sample.strategy, cashReserveTarget: 1_000_000 },
      accounts: [
        ...sample.accounts,
        { id: 'unclassified-a', name: '未知账户A', category: '未分类', venue: '其他', defaultCurrency: 'CNY', includedInTotal: true, hidden: false },
        { id: 'unclassified-b', name: '未知账户B', category: '未分类', venue: '其他', defaultCurrency: 'CNY', includedInTotal: true, hidden: false },
      ],
    };
    const analysis = analyzeStrategy(data.snapshots[data.snapshots.length - 1], data.strategy);

    renderConsole(data);

    expect(screen.getByText(`应急备用金差额 ${formatMoney(analysis.cashReserveGap)}`)).toBeTruthy();
    expect(screen.getByText('2 个待归类')).toBeTruthy();
  });
});
