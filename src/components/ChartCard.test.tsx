import { fireEvent, render, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ChartCard, type ChartLegendItem } from './ChartCard';

vi.mock('recharts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('recharts')>();
  return {
    ...actual,
    ResponsiveContainer: ({ children, height }: { children?: ReactNode; height?: number }) => <div data-testid="chart-container" data-height={height}>{children}</div>,
  };
});

const legend: ChartLegendItem[] = [
  { key: 'a', label: '系列A', color: '#111111' },
  { key: 'b', label: '系列B', color: '#222222', detail: '40%' },
];

function renderCard(props: Partial<Parameters<typeof ChartCard>[0]> = {}) {
  return render(
    <ChartCard title="测试图表" height={200} legend={legend} {...props}>
      {({ expanded, isVisible }) => (
        <div data-testid={expanded ? 'expanded-chart' : 'inline-chart'}>
          {legend.filter((item) => isVisible(item.key)).map((item) => item.label).join(',')}
        </div>
      )}
    </ChartCard>,
  );
}

describe('ChartCard', () => {
  it('shows every legend item by default and hides one temporarily on click', () => {
    renderCard();

    expect(screen.getByTestId('inline-chart').textContent).toBe('系列A,系列B');
    const toggle = screen.getByRole('button', { name: /系列A/ });
    expect(toggle.getAttribute('aria-pressed')).toBe('true');

    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-pressed')).toBe('false');
    expect(screen.getByTestId('inline-chart').textContent).toBe('系列B');

    fireEvent.click(screen.getByRole('button', { name: '全部显示（已隐藏 1 项）' }));
    expect(screen.getByTestId('inline-chart').textContent).toBe('系列A,系列B');
    expect(screen.queryByRole('button', { name: /全部显示/ })).toBeNull();
  });

  it('explains how to recover when every legend item is hidden', () => {
    renderCard();

    fireEvent.click(screen.getByRole('button', { name: /系列A/ }));
    fireEvent.click(screen.getByRole('button', { name: /系列B/ }));

    expect(screen.queryByTestId('inline-chart')).toBeNull();
    expect(screen.getByText(/都已隐藏/)).toBeTruthy();
  });

  it('opens an enlarged dialog that shares the hidden items and closes with Escape', () => {
    renderCard({ expandedTitle: '测试图表（放大）', expandedHint: '可拖动滑块' });

    fireEvent.click(screen.getByRole('button', { name: /系列B/ }));
    fireEvent.click(screen.getByRole('button', { name: '放大查看：测试图表' }));

    const dialog = screen.getByRole('dialog', { name: '测试图表（放大）' });
    expect(within(dialog).getByText(/可拖动滑块/)).toBeTruthy();
    expect(within(dialog).getByTestId('expanded-chart').textContent).toBe('系列A');
    const expandedHeight = Number(within(dialog).getByTestId('chart-container').dataset.height);
    expect(expandedHeight).toBeGreaterThan(200);

    fireEvent.click(within(dialog).getByRole('button', { name: /系列B/ }));
    expect(within(dialog).getByTestId('expanded-chart').textContent).toBe('系列A,系列B');
    expect(screen.getByTestId('inline-chart').textContent).toBe('系列A,系列B');

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('closes the dialog from the close button', () => {
    renderCard();

    fireEvent.click(screen.getByRole('button', { name: '放大查看：测试图表' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: '关闭' }));

    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('replaces the chart with a message and disables zoom when there is nothing to draw', () => {
    renderCard({ emptyMessage: '没有上一期可对比。' });

    expect(screen.getByText('没有上一期可对比。')).toBeTruthy();
    expect(screen.queryByTestId('inline-chart')).toBeNull();
    expect(screen.queryByRole('group', { name: /图例/ })).toBeNull();
    expect((screen.getByRole('button', { name: '放大查看：测试图表' }) as HTMLButtonElement).disabled).toBe(true);
  });
});
