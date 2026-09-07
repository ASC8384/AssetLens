import { useMemo, useState } from 'react';
import { applyAccountsToSnapshots, buildEntry, isLiabilityCategory, recalculateSnapshot, sortSnapshots } from '../lib/calculations';
import { accountIdFromName, categories, createAccountConfig } from '../lib/defaults';
import { filterAccounts, filterSnapshotsByIssue, sortSnapshotsForDetails, type DetailIssueFilter, type DetailSortMode } from '../lib/details';
import { downloadText, formatMoney, parseNumber } from '../lib/format';
import { externalIncomeDateLabel, resolveExternalIncome } from '../lib/income';
import type { AccountConfig, AppData, AssetCategory, AssetSnapshot } from '../lib/types';

export function DetailsTable({ data, onChange }: { data: AppData; onChange: (data: AppData) => void }) {
  const mode = data.preferences.detailMode;
  const issueFilter = data.preferences.detailIssueFilter;
  const categoryFilter = data.preferences.categoryFilter;
  const [search, setSearch] = useState('');
  const [sortMode, setSortMode] = useState<DetailSortMode>('date-desc');
  const visibleAccounts = useMemo(() => filterAccounts(data.accounts, categoryFilter, search), [data.accounts, categoryFilter, search]);
  const visibleSnapshots = useMemo(() => filterSnapshotsByIssue(sortSnapshotsForDetails(data.snapshots, sortMode), issueFilter), [data.snapshots, sortMode, issueFilter]);

  function updatePreference(patch: Partial<AppData['preferences']>) {
    onChange({ ...data, preferences: { ...data.preferences, ...patch } });
  }

  function updateAmount(snapshotId: string, accountId: string, value: string) {
    const snapshots = data.snapshots.map((snapshot) => {
      if (snapshot.id !== snapshotId) return snapshot;
      return recalculateSnapshot({
        ...snapshot,
        entries: snapshot.entries.map((entry) => entry.accountId === accountId ? { ...entry, originalAmount: parseNumber(value) } : entry),
      });
    });
    onChange({ ...data, snapshots: sortSnapshots(snapshots) });
  }

  function updateSnapshotRate(snapshotId: string, currency: string, value: string) {
    const rate = Number(value);
    if (!Number.isFinite(rate)) return;
    const snapshots = data.snapshots.map((snapshot) => snapshot.id === snapshotId
      ? recalculateSnapshot({ ...snapshot, exchangeRates: { ...snapshot.exchangeRates, [currency]: rate } })
      : snapshot);
    onChange({ ...data, snapshots });
  }

  function updateEntryCurrency(snapshotId: string, accountId: string, value: string) {
    const currency = value.trim().toUpperCase();
    if (!currency) return;
    const snapshots = data.snapshots.map((snapshot) => {
      if (snapshot.id !== snapshotId) return snapshot;
      const entry = snapshot.entries.find((item) => item.accountId === accountId);
      const rate = currency === 'CNY' ? 1 : snapshot.exchangeRates[currency] ?? data.defaultExchangeRates[currency] ?? entry?.exchangeRate ?? null;
      return recalculateSnapshot({
        ...snapshot,
        exchangeRates: rate === null ? snapshot.exchangeRates : { ...snapshot.exchangeRates, [currency]: rate },
        entries: snapshot.entries.map((item) => item.accountId === accountId ? { ...item, currency } : item),
      });
    });
    onChange({ ...data, snapshots });
  }

  function updateEntryRate(snapshotId: string, accountId: string, value: string) {
    const rate = Number(value);
    if (!Number.isFinite(rate)) return;
    const snapshots = data.snapshots.map((snapshot) => {
      if (snapshot.id !== snapshotId) return snapshot;
      const currency = snapshot.entries.find((entry) => entry.accountId === accountId)?.currency;
      if (!currency || currency === 'CNY') return snapshot;
      return recalculateSnapshot({ ...snapshot, exchangeRates: { ...snapshot.exchangeRates, [currency]: rate } });
    });
    onChange({ ...data, snapshots });
  }

  function updateSnapshotField(snapshotId: string, patch: Partial<AssetSnapshot>) {
    onChange({
      ...data,
      snapshots: data.snapshots.map((snapshot) => snapshot.id === snapshotId ? recalculateSnapshot({ ...snapshot, ...patch }) : snapshot),
    });
  }

  function deleteSnapshot(snapshotId: string) {
    if (!window.confirm('确定删除这一期记录吗？')) return;
    onChange({ ...data, snapshots: data.snapshots.filter((snapshot) => snapshot.id !== snapshotId) });
  }

  function duplicateSnapshot(snapshot: AssetSnapshot) {
    const date = window.prompt('请输入复制后的日期', new Date().toISOString().slice(0, 10));
    if (!date) return;
    onChange({ ...data, snapshots: sortSnapshots([...data.snapshots, recalculateSnapshot({ ...snapshot, id: crypto.randomUUID(), date })]) });
  }

  function addAccount() {
    const name = window.prompt('请输入新账户名称');
    if (!name?.trim()) return;
    const account = createAccountConfig(name.trim());
    if (data.accounts.some((existing) => existing.id === account.id)) return;
    onChange({
      ...data,
      accounts: [...data.accounts, account],
      snapshots: data.snapshots.map((snapshot) => recalculateSnapshot({
        ...snapshot,
        entries: [...snapshot.entries, buildEntry(account.name, null, null, account)],
      })),
    });
  }

  function deleteAccount(account: AccountConfig) {
    if (!window.confirm(`确定删除账户“${account.name}”吗？`)) return;
    onChange({
      ...data,
      accounts: data.accounts.filter((item) => item.id !== account.id),
      snapshots: data.snapshots.map((snapshot) => recalculateSnapshot({
        ...snapshot,
        entries: snapshot.entries.filter((entry) => entry.accountId !== account.id),
      })),
    });
  }

  function renameAccount(account: AccountConfig) {
    const name = window.prompt('请输入新的账户名称', account.name)?.trim();
    if (!name) return;
    const id = accountIdFromName(name);
    const accounts = data.accounts.map((item) => item.id === account.id ? { ...item, id, name } : item);
    const snapshots = data.snapshots.map((snapshot) => recalculateSnapshot({
      ...snapshot,
      entries: snapshot.entries.map((entry) => entry.accountId === account.id ? { ...entry, accountId: id, accountName: name } : entry),
    }));
    onChange({ ...data, accounts, snapshots });
  }

  function exportCsv() {
    const headers = ['时间', ...visibleAccounts.map((account) => account.name), '外界收入', '备注', 'Excel原合计', '净资产', '总资产', '负债'];
    const lines = visibleSnapshots.map((snapshot) => {
      const entries = new Map(snapshot.entries.map((entry) => [entry.accountId, entry]));
      return [
        snapshot.date,
        ...visibleAccounts.map((account) => entries.get(account.id)?.originalAmount ?? ''),
        snapshot.externalIncome ?? '',
        snapshot.note ?? '',
        snapshot.excelTotal ?? '',
        snapshot.computedTotalCny,
        snapshot.computedGrossAssetsCny,
        snapshot.computedLiabilityCny,
      ].join(',');
    });
    downloadText('asset-lens-details.csv', [headers.join(','), ...lines].join('\n'), 'text/csv');
  }

  return (
    <section className="panel details-table">
      <div className="section-header">
        <div>
          <h2>明细表</h2>
          <p>紧凑模式适合浏览，分析模式适合检查汇率、合计和占比差异。</p>
        </div>
        <div className="toolbar compact-toolbar">
          <select value={mode} onChange={(event) => updatePreference({ detailMode: event.target.value as AppData['preferences']['detailMode'] })}>
            <option value="compact">紧凑模式</option>
            <option value="analysis">分析模式</option>
          </select>
          <select value={categoryFilter} onChange={(event) => updatePreference({ categoryFilter: event.target.value as AssetCategory | '全部' })}>
            <option value="全部">全部大类</option>
            {categories.map((category) => <option key={category} value={category}>{category}</option>)}
          </select>
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜索账户" />
          <select value={sortMode} onChange={(event) => setSortMode(event.target.value as DetailSortMode)}>
            <option value="date-desc">日期从新到旧</option>
            <option value="date-asc">日期从旧到新</option>
            <option value="total-desc">净资产从高到低</option>
            <option value="total-asc">净资产从低到高</option>
            <option value="diff-desc">合计差异优先</option>
          </select>
          <select value={issueFilter} onChange={(event) => updatePreference({ detailIssueFilter: event.target.value as DetailIssueFilter })}>
            <option value="all">全部记录</option>
            <option value="issues-only">只看异常</option>
          </select>
          <button onClick={addAccount}>新增账户</button>
          <button onClick={exportCsv}>导出当前表格</button>
        </div>
      </div>

      {issueFilter === 'issues-only' && (
        <div className="quality-banner danger">
          <strong>正在只看异常记录</strong>
          <span>优先检查合计差异、缺失汇率或无法折算的账户金额。</span>
        </div>
      )}

      <div className="table-wrap detail-wrap">
        <table>
          <thead>
            <tr>
              <th className="sticky-col">时间</th>
              {visibleAccounts.map((account) => mode === 'compact'
                ? <th key={account.id} className={isLiabilityCategory(account.category) ? 'liability-col' : undefined}>{account.name}<small>{account.category}{isLiabilityCategory(account.category) ? ' · 欠款' : ''} · <button className="link-button" onClick={() => renameAccount(account)}>改名</button> <button className="link-button" onClick={() => deleteAccount(account)}>删除</button></small></th>
                : <th key={account.id} colSpan={4} className={isLiabilityCategory(account.category) ? 'liability-col' : undefined}>{account.name}<small>{account.category}{isLiabilityCategory(account.category) ? ' · 欠款' : ''} · <button className="link-button" onClick={() => renameAccount(account)}>改名</button> <button className="link-button" onClick={() => deleteAccount(account)}>删除</button></small></th>)}
              <th className="income-col">外界收入</th>
              <th>备注</th>
              <th>Excel 原合计</th>
              <th>净资产</th>
              <th>总资产</th>
              <th>负债</th>
              <th>合计差异</th>
              <th>每期汇率</th>
              <th>操作</th>
            </tr>
            {mode === 'analysis' && (
              <tr>
                <th className="sticky-col">字段</th>
                {visibleAccounts.map((account) => ['原始金额', '币种', '汇率', '折算人民币'].map((label) => <th key={`${account.id}-${label}`} className={isLiabilityCategory(account.category) ? 'liability-col' : undefined}>{label}</th>))}
                <th className="income-col" />
                <th />
                <th />
                <th />
                <th />
                <th />
                <th />
                <th />
                <th />
              </tr>
            )}
          </thead>
          <tbody>
            {visibleSnapshots.map((snapshot) => {
              const entries = new Map(snapshot.entries.map((entry) => [entry.accountId, entry]));
              const carriedIncome = resolveExternalIncome(data.snapshots, snapshot);
              const incomeCarryLabel = carriedIncome.inherited ? externalIncomeDateLabel(carriedIncome) : null;
              return (
                <tr key={snapshot.id}>
                  <td className="sticky-col"><strong>{snapshot.date}</strong></td>
                  {visibleAccounts.map((account) => {
                    const entry = entries.get(account.id);
                    if (mode === 'compact') {
                      return <td key={account.id} className={isLiabilityCategory(account.category) ? 'liability-col' : undefined}><input aria-label={`${snapshot.date}-${account.name}`} value={entry?.originalAmount ?? ''} onChange={(event) => updateAmount(snapshot.id, account.id, event.target.value)} /></td>;
                    }
                    return [
                      <td key={`${account.id}-amount`} className={isLiabilityCategory(account.category) ? 'liability-col' : undefined}><input value={entry?.originalAmount ?? ''} onChange={(event) => updateAmount(snapshot.id, account.id, event.target.value)} /></td>,
                      <td key={`${account.id}-currency`} className={isLiabilityCategory(account.category) ? 'liability-col' : undefined}><input aria-label={`${snapshot.date}-${account.name}-币种`} value={entry?.currency ?? account.defaultCurrency} onChange={(event) => updateEntryCurrency(snapshot.id, account.id, event.target.value)} /></td>,
                      <td key={`${account.id}-rate`} className={isLiabilityCategory(account.category) ? 'liability-col' : undefined}><input aria-label={`${snapshot.date}-${account.name}-汇率`} value={entry?.exchangeRate ?? ''} disabled={(entry?.currency ?? account.defaultCurrency) === 'CNY'} onChange={(event) => updateEntryRate(snapshot.id, account.id, event.target.value)} /></td>,
                      <td key={`${account.id}-cny`} className={isLiabilityCategory(account.category) ? 'liability-col' : undefined}>{formatMoney(entry?.amountCny)}</td>,
                    ];
                  })}
                  <td className="income-col">
                    <input aria-label={`${snapshot.date}-外界收入`} value={snapshot.externalIncome ?? ''} placeholder={incomeCarryLabel ?? ''} onChange={(event) => updateSnapshotField(snapshot.id, { externalIncome: parseNumber(event.target.value) })} />
                    {incomeCarryLabel && <small className="income-carry-hint">{incomeCarryLabel}</small>}
                  </td>
                  <td><input aria-label={`${snapshot.date}-备注`} value={snapshot.note ?? ''} onChange={(event) => updateSnapshotField(snapshot.id, { note: event.target.value })} /></td>
                  <td>{formatMoney(snapshot.excelTotal)}</td>
                  <td>{formatMoney(snapshot.computedTotalCny)}</td>
                  <td>{formatMoney(snapshot.computedGrossAssetsCny)}</td>
                  <td>{formatMoney(snapshot.computedLiabilityCny)}</td>
                  <td>{formatMoney(snapshot.excelTotal === undefined ? null : snapshot.computedGrossAssetsCny + snapshot.computedLiabilityCny - snapshot.excelTotal)}</td>
                  <td><RateEditor snapshot={snapshot} onUpdate={updateSnapshotRate} /></td>
                  <td className="row-actions"><button onClick={() => duplicateSnapshot(snapshot)}>复制</button><button onClick={() => deleteSnapshot(snapshot.id)}>删除</button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <button className="secondary-action" onClick={() => onChange({ ...data, snapshots: applyAccountsToSnapshots(data.snapshots, data.accounts) })}>按账户配置重算</button>
    </section>
  );
}

function RateEditor({ snapshot, onUpdate }: { snapshot: AssetSnapshot; onUpdate: (snapshotId: string, currency: string, value: string) => void }) {
  return (
    <div className="rate-editor">
      {Object.entries(snapshot.exchangeRates).map(([currency, rate]) => (
        <label key={currency}>{currency}<input type="number" step="0.0001" value={rate} disabled={currency === 'CNY'} onChange={(event) => onUpdate(snapshot.id, currency, event.target.value)} /></label>
      ))}
    </div>
  );
}
