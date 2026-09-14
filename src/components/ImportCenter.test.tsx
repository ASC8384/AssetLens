import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ImportCenter } from './ImportCenter';
import { createSampleData } from '../lib/sampleData';
import { createEmptyAppData } from '../lib/defaults';
import { snapshotsOnDate } from '../lib/snapshotDates';
import type { AppData } from '../lib/types';

describe('ImportCenter manual snapshot flow', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-20T12:00:00'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows manual input form with defaults from the latest snapshot', () => {
    render(<ImportCenter data={createSampleData()} onChange={vi.fn()} />);

    fireEvent.click(screen.getByText('开始手动输入'));

    expect(screen.getAllByText('手动新增一期')).toHaveLength(2);
    expect((screen.getByLabelText('日期') as HTMLInputElement).value).toBe('2026-05-20');
    expect((screen.getByLabelText('场外基金A') as HTMLInputElement).value).toBe('59000');
    expect((screen.getByLabelText('活期账户A') as HTMLInputElement).value).toBe('10000');
    expect((screen.getByLabelText('外界收入') as HTMLInputElement).value).toBe('12000');
    expect(screen.getByText(/沿用 2026-05-01/)).toBeTruthy();
  });

  it('saves a manual snapshot through onChange', () => {
    const data = createSampleData();
    const onChange = vi.fn();

    render(<ImportCenter data={data} onChange={onChange} />);

    fireEvent.click(screen.getByText('开始手动输入'));
    fireEvent.change(screen.getByLabelText('日期'), { target: { value: '2026-05-15' } });
    fireEvent.change(screen.getByLabelText('场外基金A'), { target: { value: '61000' } });
    fireEvent.change(screen.getByLabelText('外界收入'), { target: { value: '8000' } });
    fireEvent.change(screen.getByLabelText('备注'), { target: { value: '工资' } });
    fireEvent.click(screen.getByText('保存'));

    expect(onChange).toHaveBeenCalledTimes(1);
    const updatedData = onChange.mock.calls[0][0] as AppData;
    const latestSnapshot = updatedData.snapshots[updatedData.snapshots.length - 1];
    const amountByAccountName = new Map(latestSnapshot.entries.map((entry) => [entry.accountName, entry.originalAmount]));

    expect(latestSnapshot.date).toBe('2026-05-15');
    expect(amountByAccountName.get('场外基金A')).toBe(61000);
    expect(amountByAccountName.get('活期账户A')).toBe(10000);
    expect(latestSnapshot.externalIncome).toBe(8000);
    expect(latestSnapshot.note).toBe('工资');
  });

  it('does not save a manual snapshot without a date', () => {
    const onChange = vi.fn();
    render(<ImportCenter data={createSampleData()} onChange={onChange} />);

    fireEvent.click(screen.getByText('开始手动输入'));
    fireEvent.change(screen.getByLabelText('日期'), { target: { value: '' } });
    fireEvent.click(screen.getByText('保存'));

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByText('请选择有效日期。')).toBeTruthy();
  });

  it('can start manual input from an external request', () => {
    const { rerender } = render(<ImportCenter data={createSampleData()} onChange={vi.fn()} manualInputRequest={0} />);

    rerender(<ImportCenter data={createSampleData()} onChange={vi.fn()} manualInputRequest={1} />);

    expect(screen.getAllByText('手动新增一期').length).toBeGreaterThan(0);
    expect(screen.getByLabelText('复制来源')).toBeTruthy();
  });

  it('switches manual source between latest snapshot and blank amounts', () => {
    render(<ImportCenter data={createSampleData()} onChange={vi.fn()} />);

    fireEvent.click(screen.getByText('开始手动输入'));
    expect((screen.getByLabelText('场外基金A') as HTMLInputElement).value).toBe('59000');

    fireEvent.change(screen.getByLabelText('复制来源'), { target: { value: 'blank' } });
    expect((screen.getByLabelText('场外基金A') as HTMLInputElement).value).toBe('');
    expect((screen.getByLabelText('外界收入') as HTMLInputElement).value).toBe('');
  });

  it('notifies when manual snapshot is created', () => {
    const onManualSnapshotCreated = vi.fn();
    render(<ImportCenter data={createSampleData()} onChange={vi.fn()} onManualSnapshotCreated={onManualSnapshotCreated} />);

    fireEvent.click(screen.getByText('开始手动输入'));
    fireEvent.click(screen.getByText('保存'));

    expect(onManualSnapshotCreated).toHaveBeenCalledWith(expect.objectContaining({ snapshots: expect.any(Array) }));
  });

  it('asks how to handle a conflicting date before saving a manual snapshot', () => {
    const onChange = vi.fn();
    render(<ImportCenter data={createSampleData()} onChange={onChange} />);

    fireEvent.click(screen.getByText('开始手动输入'));
    fireEvent.change(screen.getByLabelText('日期'), { target: { value: '2026-05-01' } });
    fireEvent.click(screen.getByText('保存'));

    expect(onChange).not.toHaveBeenCalled();
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText(/已有 2026-05-01 的记录/)).toBeTruthy();

    fireEvent.click(within(dialog).getByText('取消'));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
    expect((screen.getByLabelText('日期') as HTMLInputElement).value).toBe('2026-05-01');
  });

  it('can overwrite or keep an existing snapshot date from the confirmation dialog', () => {
    const overwrite = vi.fn();
    const { unmount } = render(<ImportCenter data={createSampleData()} onChange={overwrite} />);
    fireEvent.click(screen.getByText('开始手动输入'));
    fireEvent.change(screen.getByLabelText('日期'), { target: { value: '2026-05-01' } });
    fireEvent.click(screen.getByText('保存'));
    fireEvent.click(screen.getByRole('button', { name: '覆盖已有记录' }));

    const overwritten = overwrite.mock.calls[0][0] as AppData;
    expect(overwritten.snapshots).toHaveLength(3);
    expect(snapshotsOnDate(overwritten.snapshots, '2026-05-01')).toHaveLength(1);
    unmount();

    const keep = vi.fn();
    render(<ImportCenter data={createSampleData()} onChange={keep} />);
    fireEvent.click(screen.getByText('开始手动输入'));
    fireEvent.change(screen.getByLabelText('日期'), { target: { value: '2026-05-01' } });
    fireEvent.click(screen.getByText('保存'));
    fireEvent.click(screen.getByRole('button', { name: '保留同日记录' }));

    const kept = keep.mock.calls[0][0] as AppData;
    expect(kept.snapshots).toHaveLength(4);
    expect(snapshotsOnDate(kept.snapshots, '2026-05-01')).toHaveLength(2);
  });

  it('shows a prompt instead of the full form when there are no accounts to fill', () => {
    render(<ImportCenter data={createEmptyAppData()} onChange={vi.fn()} />);

    fireEvent.click(screen.getByText('开始手动输入'));

    expect(screen.getByText('请先导入一次数据，或先到明细表新增账户。')).toBeTruthy();
    expect(screen.queryByLabelText('日期')).toBeNull();
    expect(screen.queryByText('保存')).toBeNull();
  });

  it('keeps manual form and import draft mutually exclusive', () => {
    render(<ImportCenter data={createSampleData()} onChange={vi.fn()} />);

    fireEvent.click(screen.getByText('开始手动输入'));
        fireEvent.change(screen.getByLabelText('粘贴表格文本'), {
      target: {
        value: '时间\t基金账户A\n2026-05-02\t60000',
      },
    });
    fireEvent.click(screen.getByText('解析粘贴内容'));

    expect(screen.queryByLabelText('日期')).toBeNull();
    expect(screen.queryByText('保存')).toBeNull();
    expect(screen.getByText('字段识别与修正')).toBeTruthy();
  });

  it('reports normal import completion with counts', () => {
    const onImportComplete = vi.fn();

    render(<ImportCenter data={createEmptyAppData()} onChange={vi.fn()} onImportComplete={onImportComplete} />);

    fireEvent.change(screen.getByLabelText('粘贴表格文本'), {
      target: {
        value: '时间\t基金账户A\t现金账户A\t合计\n2026-05-01\t60000\t10000\t70000',
      },
    });
    fireEvent.click(screen.getByText('解析粘贴内容'));
    fireEvent.click(screen.getByText('确认导入'));

    expect(onImportComplete).toHaveBeenCalledWith(expect.objectContaining({
      snapshotCount: 1,
      accountCount: 2,
      dangerCount: 0,
      warningCount: 0,
      isFirstImport: true,
    }));
  });

  it('reports suspicious total issues on import completion', () => {
    const onImportComplete = vi.fn();

    render(<ImportCenter data={createEmptyAppData()} onChange={vi.fn()} onImportComplete={onImportComplete} />);

    fireEvent.change(screen.getByLabelText('粘贴表格文本'), {
      target: {
        value: '时间\t基金账户A\t现金账户A\t合计\n2026-05-01\t60000\t10000\t10000',
      },
    });
    fireEvent.click(screen.getByText('解析粘贴内容'));
    fireEvent.click(screen.getByText('确认导入'));

    expect(onImportComplete).toHaveBeenCalledWith(expect.objectContaining({
      snapshotCount: 1,
      accountCount: 2,
      dangerCount: 1,
      isFirstImport: true,
    }));
  });

  it('recognizes liability and income columns in the mapping table', () => {
    render(<ImportCenter data={createEmptyAppData()} onChange={vi.fn()} />);

    fireEvent.change(screen.getByLabelText('粘贴表格文本'), {
      target: {
        value: '时间\t基金账户A\t信用卡Visa\t收入\t备注\n2026-09-04\t10000\t500\t3000\t示例备注',
      },
    });
    fireEvent.click(screen.getByText('解析粘贴内容'));

    expect(screen.getByText('信用卡Visa')).toBeTruthy();
    expect((screen.getAllByDisplayValue('负债')[0] as HTMLSelectElement).value).toBe('负债');
    expect(screen.getByDisplayValue('外界收入')).toBeTruthy();
    expect(screen.getByDisplayValue('备注')).toBeTruthy();
  });
});
