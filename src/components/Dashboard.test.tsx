import { fireEvent, render, screen, within } from '@testing-library/react';
import { recalculateSnapshot } from '../lib/calculations';
import type { AssetSnapshot } from '../lib/types';
import { describe, expect, it, vi } from 'vitest';
import { Dashboard } from './Dashboard';
import { createSampleData } from '../lib/sampleData';

function snapshot(id: string, date: string, amount: number): AssetSnapshot {
  return recalculateSnapshot({
    id,
    date,
    exchangeRates: { CNY: 1 },
    computedTotalCny: 0,
    entries: [{
      accountId: 'fund',
      accountName: '场外基金A',
      category: '权益类',
      venue: '场外',
      originalAmount: amount,
      currency: 'CNY',
      exchangeRate: 1,
      amountCny: null,
      excelRatio: null,
      computedRatio: null,
      ratioDiff: null,
      includedInTotal: true,
    }],
  });
}

describe('Dashboard', () => {
  it('does not show import quality concerns in the dashboard', () => {
    render(<Dashboard data={createSampleData()} />);

    expect(screen.queryByText(/导入质量/)).toBeNull();
    expect(screen.queryByText(/Excel 原合计/)).toBeNull();
    expect(screen.queryByText(/数据质量/)).toBeNull();
    expect(screen.queryByText(/合计列可能识别错/)).toBeNull();
  });

  it('shows each headline number once and folds account insights into the chart cards', () => {
    const { container } = render(<Dashboard data={createSampleData()} />);

    expect(screen.getByText('生成本月复盘')).toBeTruthy();
    expect(screen.queryByText('本月资产复盘入口')).toBeNull();
    expect(screen.getByText('查看时点')).toBeTruthy();
    expect(screen.getByLabelText('2026 年快照')).toBeTruthy();
    expect(screen.getByRole('button', { name: '2026-03-01' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '2026-05-01' })).toBeTruthy();
    const summaryLabels = [...container.querySelectorAll('.summary-strip > div > span')].map((node) => node.textContent);
    expect(summaryLabels).toEqual(['总资产', '负债', '主导资产', '账户数', '本期外界收入', '扣除收入后变化']);
    expect(screen.queryByText('选中时点')).toBeNull();
    expect(screen.queryByText('账户洞察')).toBeNull();
    expect(screen.queryByText('增长账户 Top 5')).toBeNull();
    expect(screen.getByText(/^集中度：金额最大的 3 个资产账户占总资产/)).toBeTruthy();
  });

  it('switches the net worth trend between separate lines and stacked areas', () => {
    render(<Dashboard data={createSampleData()} />);

    const linesButton = screen.getByRole('button', { name: '分线' });
    const stackedButton = screen.getByRole('button', { name: '堆叠' });
    expect(linesButton.getAttribute('aria-pressed')).toBe('true');

    fireEvent.click(stackedButton);
    expect(stackedButton.getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByText(/堆叠面积加起来是各类资产合计/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: '放大查看：净资产趋势（含分资产）' }));
    const dialog = screen.getByRole('dialog', { name: '净资产趋势（含分资产）' });
    expect(within(dialog).getByRole('button', { name: '堆叠' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('keeps hidden but counted accounts in net worth and explains the gap in structure charts', () => {
    const sample = createSampleData();
    const hiddenAccount = sample.accounts[0];
    const data = { ...sample, accounts: sample.accounts.map((account) => (account.id === hiddenAccount.id ? { ...account, hidden: true } : account)) };
    render(<Dashboard data={data} />);

    expect(screen.getAllByText(/只计入净资产，不参与结构和占比/).length).toBeGreaterThan(0);
    expect(screen.getByText(/净资产线包含只计入净资产的隐藏账户/)).toBeTruthy();
    expect(screen.getByText(/另有 1 个隐藏账户/)).toBeTruthy();
    expect(screen.getByText(/^集中度：金额最大的 3 个资产账户占可分析资产/)).toBeTruthy();
  });

  it('labels duplicate-date snapshots so users can distinguish kept imports', () => {
    const data = {
      ...createSampleData(),
      snapshots: [
        snapshot('jan', '2026-01-01', 100),
        snapshot('first-same-date', '2026-02-01', 120),
        snapshot('second-same-date', '2026-02-01', 220),
      ],
    };

    render(<Dashboard data={data} />);

    expect(screen.getByRole('button', { name: '2026-02-01 · 同日第 1 条' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '2026-02-01 · 同日第 2 条' })).toBeTruthy();
  });

  it('counts an unfilled period as zero income after income recording starts', () => {
    const data = {
      ...createSampleData(),
      snapshots: [
        { ...snapshot('jan', '2026-01-01', 100), externalIncome: 8000 },
        snapshot('feb', '2026-02-01', 120),
      ],
    };

    render(<Dashboard data={data} />);

    expect(screen.getByText('本期未填，按 0 计')).toBeTruthy();
    expect(screen.getAllByText('¥0.00').length).toBeGreaterThan(0);
    expect(screen.queryByText(/沿用 2026-01-01/)).toBeNull();
  });

  it('navigates between snapshots without leaving the latest-follow mode until a period is chosen', () => {
    render(<Dashboard data={createSampleData()} />);

    expect(screen.getByText('最新净资产')).toBeTruthy();
    expect(screen.getByText('正在看最新一期 · 2026-05-01')).toBeTruthy();
    expect((screen.getByRole('button', { name: '下一期' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: '最新一期' }) as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: '上一期' }));

    expect(screen.getByText('选中时点净资产')).toBeTruthy();
    expect(screen.getByText('正在看选中时点 · 2026-04-01')).toBeTruthy();
    expect(screen.getByRole('button', { name: '2026-04-01' }).className).toContain('active');
    expect((screen.getByRole('button', { name: '最新一期' }) as HTMLButtonElement).disabled).toBe(false);

    fireEvent.click(screen.getByRole('button', { name: '最新一期' }));
    expect(screen.getByText('正在看最新一期 · 2026-05-01')).toBeTruthy();
  });

  it('lets the user pick a snapshot from the wrapped date list', () => {
    render(<Dashboard data={createSampleData()} />);

    fireEvent.click(screen.getByRole('button', { name: '2026-01-01' }));

    expect(screen.getByText('正在看选中时点 · 2026-01-01')).toBeTruthy();
    expect(screen.getByRole('button', { name: '2026-01-01' }).className).toContain('active');
    expect((screen.getByRole('button', { name: '上一期' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('groups snapshot dates by year so long histories stay scannable', () => {
    const data = {
      ...createSampleData(),
      snapshots: [
        snapshot('y24', '2024-12-01', 80),
        snapshot('y25', '2025-06-01', 90),
        snapshot('y26', '2026-05-01', 120),
      ],
    };

    render(<Dashboard data={data} />);

    expect(screen.getByText('2024 年')).toBeTruthy();
    expect(screen.getByText('2025 年')).toBeTruthy();
    expect(screen.getByText('2026 年')).toBeTruthy();
    expect(screen.getByRole('button', { name: '2024-12-01' }).textContent).toContain('12月');
    expect(screen.getByRole('button', { name: '2026-05-01' }).textContent).toContain('5月');
  });

  it('gives every chart an enlarge button and toggleable legend items', () => {
    render(<Dashboard data={createSampleData()} />);

    expect(screen.getAllByRole('button', { name: /^放大查看：/ })).toHaveLength(8);
    const trendLegend = screen.getAllByRole('group', { name: /图例/ })[0];
    const equity = within(trendLegend).getByRole('button', { name: '权益类' });
    expect(equity.getAttribute('aria-pressed')).toBe('true');
    expect(within(trendLegend).queryByRole('button', { name: '未分类' })).toBeNull();

    fireEvent.click(equity);
    expect(equity.getAttribute('aria-pressed')).toBe('false');

    fireEvent.click(screen.getByRole('button', { name: '放大查看：净资产趋势（含分资产）' }));
    const dialog = screen.getByRole('dialog', { name: '净资产趋势（含分资产）' });
    expect(within(dialog).getByRole('button', { name: '权益类' }).getAttribute('aria-pressed')).toBe('false');

    fireEvent.click(within(dialog).getByRole('button', { name: '关闭' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('explains empty comparison charts on the first snapshot instead of drawing blank axes', () => {
    const data = { ...createSampleData(), snapshots: [snapshot('only', '2026-01-01', 100)] };

    render(<Dashboard data={data} />);

    expect(screen.getAllByText('这是第一期快照，没有上一期可对比。')).toHaveLength(2);
    expect(screen.getByText('至少需要两期不同日期的快照，才能算区间日均净增。')).toBeTruthy();
  });

  it('opens a monthly review for the selected snapshot calendar month', () => {
    const onOpenMonthlyReview = vi.fn();
    render(<Dashboard data={createSampleData()} onOpenMonthlyReview={onOpenMonthlyReview} />);

    fireEvent.click(screen.getByRole('button', { name: '生成本月复盘' }));
    expect(onOpenMonthlyReview).toHaveBeenCalledWith({ startDate: '2026-05-01', endDate: '2026-05-31', preset: 'custom' });

    fireEvent.click(screen.getByRole('button', { name: '上一期' }));
    fireEvent.click(screen.getByRole('button', { name: '生成本月复盘' }));
    expect(onOpenMonthlyReview).toHaveBeenLastCalledWith({ startDate: '2026-04-01', endDate: '2026-04-30', preset: 'custom' });
  });
});
