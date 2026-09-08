import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ConfigPanel } from './ConfigPanel';
import { createEmptyAppData } from '../lib/defaults';
import type { AppData } from '../lib/types';

function dataWithUnclassifiedAccounts(): AppData {
  return {
    ...createEmptyAppData(),
    accounts: [
      { id: 'a', name: '未知账户A', category: '未分类', venue: '其他', defaultCurrency: 'CNY', includedInTotal: true, hidden: false },
      { id: 'b', name: '未知账户B', category: '未分类', venue: '其他', defaultCurrency: 'CNY', includedInTotal: true, hidden: false },
      { id: 'c', name: '券商账户A', category: '权益类', venue: '场内', defaultCurrency: 'CNY', includedInTotal: true, hidden: false },
    ],
  };
}

function expand() {
  fireEvent.click(screen.getByText('展开配置'));
}

describe('ConfigPanel account classification', () => {
  it('surfaces how many accounts still need classifying', () => {
    render(<ConfigPanel data={dataWithUnclassifiedAccounts()} onChange={vi.fn()} />);

    expect(screen.getByText(/2 个待归类/)).toBeTruthy();
  });

  it('reclassifies several selected accounts in one action', () => {
    const onChange = vi.fn();
    render(<ConfigPanel data={dataWithUnclassifiedAccounts()} onChange={onChange} />);
    expand();

    fireEvent.click(screen.getByLabelText('选择 未知账户A'));
    fireEvent.click(screen.getByLabelText('选择 未知账户B'));
    fireEvent.change(screen.getByDisplayValue('批量设为大类…'), { target: { value: '稳健类' } });

    expect(onChange).toHaveBeenCalledTimes(1);
    const next = onChange.mock.calls[0][0] as AppData;
    const categoryById = new Map(next.accounts.map((account) => [account.id, account.category]));
    expect(categoryById.get('a')).toBe('稳健类');
    expect(categoryById.get('b')).toBe('稳健类');
    expect(categoryById.get('c')).toBe('权益类');
  });

  it('sets a venue in bulk without touching the risk category', () => {
    const onChange = vi.fn();
    render(<ConfigPanel data={dataWithUnclassifiedAccounts()} onChange={onChange} />);
    expand();

    fireEvent.click(screen.getByLabelText('全选账户'));
    fireEvent.change(screen.getByDisplayValue('批量设为渠道…'), { target: { value: '银行' } });

    const next = onChange.mock.calls[0][0] as AppData;
    expect(next.accounts.every((account) => account.venue === '银行')).toBe(true);
    expect(next.accounts.find((account) => account.id === 'c')?.category).toBe('权益类');
  });

  it('filters down to unclassified accounts so a long list stays workable', () => {
    render(<ConfigPanel data={dataWithUnclassifiedAccounts()} onChange={vi.fn()} />);
    expand();

    fireEvent.click(screen.getByText('只看未分类（2）'));

    expect(screen.getByLabelText('选择 未知账户A')).toBeTruthy();
    expect(screen.queryByLabelText('选择 券商账户A')).toBeNull();
  });

  it('changes a single account without a bulk selection', () => {
    const onChange = vi.fn();
    render(<ConfigPanel data={dataWithUnclassifiedAccounts()} onChange={onChange} />);
    expand();

    fireEvent.change(screen.getByLabelText('未知账户A-大类'), { target: { value: '其他资产' } });

    const next = onChange.mock.calls[0][0] as AppData;
    expect(next.accounts.find((account) => account.id === 'a')?.category).toBe('其他资产');
  });
});
