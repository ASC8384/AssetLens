import { useMemo } from 'react';
import { applyAccountsToSnapshots, recalculateSnapshot, sortSnapshots } from '../lib/calculations';
import { categories } from '../lib/defaults';
import { downloadText, formatMoney, formatPercent, parseNumber } from '../lib/format';
import type { AppData, AssetCategory, AssetSnapshot } from '../lib/types';

export function DetailsTable({ data, onChange }: { data: AppData; onChange: (data: AppData) => void }) {
  const mode = data.preferences.detailMode;
  const categoryFilter = data.preferences.categoryFilter;
  const visibleAccounts = useMemo(() => data.accounts.filter((account) => !account.hidden && (categoryFilter === '全部' || account.category === categoryFilter)), [data.accounts, categoryFilter]);

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

  function deleteSnapshot(snapshotId: string) {
    if (!window.confirm('确定删除这一期记录吗？')) return;
    onChange({ ...data, snapshots: data.snapshots.filter((snapshot) => snapshot.id !== snapshotId) });
  }

  function duplicateSnapshot(snapshot: AssetSnapshot) {
    const date = window.prompt('请输入复制后的日期', new Date().toISOString().slice(0, 10));
    if (!date) return;
    onChange({ ...data, snapshots: sortSnapshots([...data.snapshots, recalculateSnapshot({ ...snapshot, id: crypto.randomUUID(), date })]) });
  }

  function exportCsv() {
    const headers = ['时间', ...visibleAccounts.map((account) => account.name), 'Excel原合计', '网页重算合计'];
    const lines = data.snapshots.map((snapshot) => {
      const entries = new Map(snapshot.entries.map((entry) => [entry.accountId, entry]));
      return [snapshot.date, ...visibleAccounts.map((account) => entries.get(account.id)?.originalAmount ?? ''), snapshot.excelTotal ?? '', snapshot.computedTotalCny].join(',');
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
          <button onClick={exportCsv}>导出当前表格</button>
        </div>
      </div>

      <div className="table-wrap detail-wrap">
        <table>
          <thead>
            <tr>
              <th className="sticky-col">时间</th>
              {visibleAccounts.map((account) => mode === 'compact'
                ? <th key={account.id}>{account.name}<small>{account.category}</small></th>
                : <th key={account.id} colSpan={6}>{account.name}<small>{account.category}</small></th>)}
              <th>Excel 原合计</th>
              <th>网页重算合计</th>
              <th>合计差异</th>
              <th>每期汇率</th>
              <th>操作</th>
            </tr>
            {mode === 'analysis' && (
              <tr>
                <th className="sticky-col">字段</th>
                {visibleAccounts.map((account) => ['原始金额', '币种', '汇率', '折算人民币', 'Excel占比', '差异'].map((label) => <th key={`${account.id}-${label}`}>{label}</th>))}
                <th />
                <th />
                <th />
                <th />
                <th />
              </tr>
            )}
          </thead>
          <tbody>
            {data.snapshots.map((snapshot) => {
              const entries = new Map(snapshot.entries.map((entry) => [entry.accountId, entry]));
              return (
                <tr key={snapshot.id}>
                  <td className="sticky-col"><strong>{snapshot.date}</strong></td>
                  {visibleAccounts.map((account) => {
                    const entry = entries.get(account.id);
                    if (mode === 'compact') {
                      return <td key={account.id}><input value={entry?.originalAmount ?? ''} onChange={(event) => updateAmount(snapshot.id, account.id, event.target.value)} /></td>;
                    }
                    return [
                      <td key={`${account.id}-amount`}><input value={entry?.originalAmount ?? ''} onChange={(event) => updateAmount(snapshot.id, account.id, event.target.value)} /></td>,
                      <td key={`${account.id}-currency`}>{entry?.currency ?? account.defaultCurrency}</td>,
                      <td key={`${account.id}-rate`}>{entry?.exchangeRate ?? '缺失'}</td>,
                      <td key={`${account.id}-cny`}>{formatMoney(entry?.amountCny)}</td>,
                      <td key={`${account.id}-excel`}>{formatPercent(entry?.excelRatio)}</td>,
                      <td key={`${account.id}-diff`} className={Math.abs(entry?.ratioDiff ?? 0) >= 0.01 ? 'danger-text' : Math.abs(entry?.ratioDiff ?? 0) >= 0.002 ? 'warning-text' : ''}>{formatPercent(entry?.ratioDiff)}</td>,
                    ];
                  })}
                  <td>{formatMoney(snapshot.excelTotal)}</td>
                  <td>{formatMoney(snapshot.computedTotalCny)}</td>
                  <td>{formatMoney(snapshot.excelTotal === undefined ? null : snapshot.computedTotalCny - snapshot.excelTotal)}</td>
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
