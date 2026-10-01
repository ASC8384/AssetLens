import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ImportCenter } from './ImportCenter';
import { createSampleData } from '../lib/sampleData';
import { createEmptyAppData } from '../lib/defaults';
import { snapshotsOnDate } from '../lib/snapshotDates';
import type { AppData } from '../lib/types';

const sampleSnapshotCount = createSampleData().snapshots.length;

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
    expect((screen.getByLabelText('外界收入') as HTMLInputElement).value).toBe('');
    expect((screen.getByLabelText('外界收入') as HTMLInputElement).placeholder).toBe('上次 ¥12,000.00（2026-05-01）');
  });

  it('keeps typed external income when switching manual source', () => {
    render(<ImportCenter data={createSampleData()} onChange={vi.fn()} />);

    fireEvent.click(screen.getByText('开始手动输入'));
    fireEvent.change(screen.getByLabelText('外界收入'), { target: { value: '9000' } });
    fireEvent.change(screen.getByLabelText('复制来源'), { target: { value: 'blank' } });

    expect((screen.getByLabelText('外界收入') as HTMLInputElement).value).toBe('9000');
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
    expect(overwritten.snapshots).toHaveLength(sampleSnapshotCount);
    expect(snapshotsOnDate(overwritten.snapshots, '2026-05-01')).toHaveLength(1);
    unmount();

    const keep = vi.fn();
    render(<ImportCenter data={createSampleData()} onChange={keep} />);
    fireEvent.click(screen.getByText('开始手动输入'));
    fireEvent.change(screen.getByLabelText('日期'), { target: { value: '2026-05-01' } });
    fireEvent.click(screen.getByText('保存'));
    fireEvent.click(screen.getByRole('button', { name: '保留同日记录' }));

    const kept = keep.mock.calls[0][0] as AppData;
    expect(kept.snapshots).toHaveLength(sampleSnapshotCount + 1);
    expect(snapshotsOnDate(kept.snapshots, '2026-05-01')).toHaveLength(2);
  });

  it('groups manual accounts by category and shows previous amount with change', () => {
    render(<ImportCenter data={createSampleData()} onChange={vi.fn()} />);

    fireEvent.click(screen.getByText('开始手动输入'));

    const equity = screen.getByRole('region', { name: '权益类账户' });
    expect(within(equity).getByLabelText('场外基金A')).toBeTruthy();
    expect(within(equity).queryByLabelText('活期账户A')).toBeNull();

    fireEvent.change(screen.getByLabelText('场外基金A'), { target: { value: '61000' } });
    expect(within(equity).getByText('上期 59,000')).toBeTruthy();
    expect(within(equity).getByText('+2,000').className).toBe('positive');

    const liability = screen.getByRole('region', { name: '负债账户' });
    fireEvent.change(screen.getByLabelText('信用卡A'), { target: { value: '3500' } });
    expect(within(liability).getByText('+500').className).toBe('negative');
  });

  it('collapses hidden accounts but still saves them', () => {
    const data = createSampleData();
    const hiddenData: AppData = { ...data, accounts: data.accounts.map((account) => account.name === '黄金A' ? { ...account, hidden: true } : account) };
    const onChange = vi.fn();
    const { container } = render(<ImportCenter data={hiddenData} onChange={onChange} />);

    fireEvent.click(screen.getByText('开始手动输入'));

    const hiddenGroup = container.querySelector('details.manual-hidden-group') as HTMLDetailsElement;
    expect(hiddenGroup.open).toBe(false);
    expect(within(hiddenGroup).getByLabelText('黄金A')).toBeTruthy();

    fireEvent.click(screen.getByText('保存'));
    const latest = (onChange.mock.calls[0][0] as AppData).snapshots.at(-1)!;
    expect(latest.entries.find((entry) => entry.accountName === '黄金A')?.originalAmount).toBe(5000);
  });

  it('removes an account from this snapshot and can restore it', () => {
    const onChange = vi.fn();
    render(<ImportCenter data={createSampleData()} onChange={onChange} />);

    fireEvent.click(screen.getByText('开始手动输入'));
    fireEvent.click(screen.getByLabelText('移出本期：券商账户B'));

    expect(screen.queryByLabelText('券商账户B')).toBeNull();
    fireEvent.click(screen.getByLabelText('加回本期：券商账户B'));
    expect((screen.getByLabelText('券商账户B') as HTMLInputElement).value).toBe('17500');

    fireEvent.click(screen.getByLabelText('移出本期：券商账户B'));
    fireEvent.click(screen.getByText('保存'));

    const updated = onChange.mock.calls[0][0] as AppData;
    const latest = updated.snapshots.at(-1)!;
    expect(latest.entries.some((entry) => entry.accountName === '券商账户B')).toBe(false);
    expect(updated.accounts.some((account) => account.name === '券商账户B')).toBe(true);
    expect(updated.snapshots[0].entries.some((entry) => entry.accountName === '券商账户B')).toBe(true);
  });

  it('leaves accounts missing from the latest snapshot out by default', () => {
    const data = createSampleData();
    const closed = { ...data.accounts[0], id: 'closed-a', name: '已销户账户A' };
    render(<ImportCenter data={{ ...data, accounts: [...data.accounts, closed] }} onChange={vi.fn()} />);

    fireEvent.click(screen.getByText('开始手动输入'));

    expect(screen.queryByLabelText('已销户账户A')).toBeNull();
    expect(screen.getByLabelText('加回本期：已销户账户A')).toBeTruthy();
  });

  it('adds a new account inline and saves it with the snapshot', () => {
    const onChange = vi.fn();
    render(<ImportCenter data={createSampleData()} onChange={onChange} />);

    fireEvent.click(screen.getByText('开始手动输入'));
    fireEvent.change(screen.getByLabelText('新账户名称'), { target: { value: '示例美元账户' } });
    fireEvent.change(screen.getByLabelText('新账户大类'), { target: { value: '权益类' } });
    fireEvent.change(screen.getByLabelText('新账户币种'), { target: { value: 'USD' } });
    fireEvent.change(screen.getByLabelText('新账户金额'), { target: { value: '100' } });
    fireEvent.click(screen.getByText('添加'));

    const equity = screen.getByRole('region', { name: '权益类账户' });
    expect((within(equity).getByLabelText('示例美元账户') as HTMLInputElement).value).toBe('100');
    expect((screen.getByLabelText('新账户名称') as HTMLInputElement).value).toBe('');

    fireEvent.click(screen.getByText('保存'));
    const updated = onChange.mock.calls[0][0] as AppData;
    const account = updated.accounts.find((item) => item.name === '示例美元账户');
    expect(account).toMatchObject({ category: '权益类', defaultCurrency: 'USD' });
    expect(updated.snapshots.at(-1)!.entries.find((entry) => entry.accountName === '示例美元账户')).toMatchObject({ originalAmount: 100, amountCny: 700 });
    expect(updated.snapshots[0].entries.some((entry) => entry.accountName === '示例美元账户')).toBe(false);
  });

  it('rejects a new account that duplicates an existing one', () => {
    render(<ImportCenter data={createSampleData()} onChange={vi.fn()} />);

    fireEvent.click(screen.getByText('开始手动输入'));
    fireEvent.change(screen.getByLabelText('新账户名称'), { target: { value: '场外基金A' } });
    fireEvent.click(screen.getByText('添加'));

    expect(screen.getByText('已有账户“场外基金A”，直接修改它的金额即可。')).toBeTruthy();
    expect(screen.getAllByLabelText('场外基金A')).toHaveLength(1);
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
