import { useState } from 'react';
import type { AccountConfig, AccountVenue, AppData, AssetCategory } from '../lib/types';
import { applyAccountsToSnapshots, applyExchangeRateToSnapshots } from '../lib/calculations';
import { applyHistoricalRates, collectForeignCurrencies } from '../lib/exchangeRates';
import { categories, categoryHints, isUnclassifiedCategory, venues } from '../lib/defaults';

export function ConfigPanel({ data, onChange }: { data: AppData; onChange: (data: AppData) => void }) {
  const [expanded, setExpanded] = useState(false);
  const [rateLoading, setRateLoading] = useState(false);
  const [rateStatus, setRateStatus] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [onlyUnclassified, setOnlyUnclassified] = useState(false);
  const foreignCurrencies = collectForeignCurrencies(data);
  const unclassifiedCount = data.accounts.filter((account) => isUnclassifiedCategory(account.category)).length;
  const visibleAccounts = onlyUnclassified ? data.accounts.filter((account) => isUnclassifiedCategory(account.category)) : data.accounts;
  const selectedSet = new Set(selectedIds);
  const visibleSelectedCount = visibleAccounts.filter((account) => selectedSet.has(account.id)).length;
  const allVisibleSelected = visibleAccounts.length > 0 && visibleSelectedCount === visibleAccounts.length;

  async function loadHistoricalRates() {
    setRateLoading(true);
    setRateStatus(null);
    try {
      const outcome = await applyHistoricalRates(data);
      if (outcome.currencies.length === 0) {
        setRateStatus('没有外币账户，无需获取历史汇率。');
        return;
      }
      onChange(outcome.data);
      const skipped = outcome.missingDates.length > 0 ? `，${outcome.missingDates.length} 期日期无法识别已跳过` : '';
      setRateStatus(`已按快照日期更新 ${outcome.appliedCount} 期的 ${outcome.currencies.join('、')} 汇率${skipped}。`);
    } catch (error) {
      setRateStatus(`获取失败：${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setRateLoading(false);
    }
  }

  function updateAccounts(ids: string[], patch: Partial<AccountConfig>) {
    if (ids.length === 0) return;
    const idSet = new Set(ids);
    const accounts = data.accounts.map((account) => idSet.has(account.id) ? { ...account, ...patch } : account);
    onChange({ ...data, accounts, snapshots: applyAccountsToSnapshots(data.snapshots, accounts) });
  }

  function toggleSelected(id: string) {
    setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  function toggleSelectAllVisible() {
    const visibleIds = visibleAccounts.map((account) => account.id);
    setSelectedIds((current) => allVisibleSelected
      ? current.filter((id) => !visibleIds.includes(id))
      : [...new Set([...current, ...visibleIds])]);
  }

  function updateDefaultRate(currency: string, value: string) {
    const rate = Number(value);
    if (!Number.isFinite(rate)) return;
    onChange({
      ...data,
      defaultExchangeRates: { ...data.defaultExchangeRates, [currency]: rate },
      snapshots: applyExchangeRateToSnapshots(data.snapshots, currency, rate),
    });
  }

  function addCurrency() {
    const currency = window.prompt('请输入币种代码，例如 USD、HKD、JPY')?.trim().toUpperCase();
    if (!currency) return;
    onChange({ ...data, defaultExchangeRates: { ...data.defaultExchangeRates, [currency]: data.defaultExchangeRates[currency] ?? 1 } });
  }

  return (
    <section className="panel config-panel">
      <div className="section-header compact-section-header">
        <div>
          <h2>账户与汇率配置</h2>
          <p>{data.accounts.length} 个账户 · {Object.keys(data.defaultExchangeRates).length} 个默认币种{unclassifiedCount > 0 ? ` · ${unclassifiedCount} 个待归类` : ''}</p>
        </div>
        <button onClick={() => setExpanded(!expanded)}>{expanded ? '收起配置' : '展开配置'}</button>
      </div>
      {expanded && <div className="config-grid">
        <div>
          <div className="section-header">
            <div>
              <h2>账户配置</h2>
              <p>大类按流动性和波动划分，渠道是独立的第二维度。负债请填欠款正数，会从净资产中扣除。</p>
            </div>
            {unclassifiedCount > 0 && (
              <button className={onlyUnclassified ? 'primary' : ''} onClick={() => setOnlyUnclassified(!onlyUnclassified)}>
                {onlyUnclassified ? '显示全部账户' : `只看未分类（${unclassifiedCount}）`}
              </button>
            )}
          </div>

          <ul className="category-legend">
            {categories.map((category) => <li key={category}><strong>{category}</strong><span>{categoryHints[category]}</span></li>)}
          </ul>

          <div className="bulk-bar">
            <span>{selectedIds.length > 0 ? `已选 ${selectedIds.length} 个账户` : '勾选账户后可批量归类'}</span>
            <select value="" disabled={selectedIds.length === 0} onChange={(event) => updateAccounts(selectedIds, { category: event.target.value as AssetCategory })}>
              <option value="">批量设为大类…</option>
              {categories.map((category) => <option key={category} value={category}>{category}</option>)}
            </select>
            <select value="" disabled={selectedIds.length === 0} onChange={(event) => updateAccounts(selectedIds, { venue: event.target.value as AccountVenue })}>
              <option value="">批量设为渠道…</option>
              {venues.map((venue) => <option key={venue} value={venue}>{venue}</option>)}
            </select>
            {selectedIds.length > 0 && <button onClick={() => setSelectedIds([])}>取消选择</button>}
          </div>

          <div className="table-wrap small-table">
            <table>
              <thead>
                <tr>
                  <th><input type="checkbox" aria-label="全选账户" checked={allVisibleSelected} onChange={toggleSelectAllVisible} /></th>
                  <th>账户</th>
                  <th>大类</th>
                  <th>渠道</th>
                  <th>币种</th>
                  <th>计入</th>
                  <th>隐藏</th>
                </tr>
              </thead>
              <tbody>
                {visibleAccounts.map((account) => (
                  <tr key={account.id} className={isUnclassifiedCategory(account.category) ? 'unclassified-row' : undefined}>
                    <td><input type="checkbox" aria-label={`选择 ${account.name}`} checked={selectedSet.has(account.id)} onChange={() => toggleSelected(account.id)} /></td>
                    <td>{account.name}</td>
                    <td>
                      <select aria-label={`${account.name}-大类`} value={account.category} onChange={(event) => updateAccounts([account.id], { category: event.target.value as AssetCategory })}>
                        {categories.map((category) => <option key={category} value={category}>{category}</option>)}
                      </select>
                    </td>
                    <td>
                      <select aria-label={`${account.name}-渠道`} value={account.venue} onChange={(event) => updateAccounts([account.id], { venue: event.target.value as AccountVenue })}>
                        {venues.map((venue) => <option key={venue} value={venue}>{venue}</option>)}
                      </select>
                    </td>
                    <td><input value={account.defaultCurrency} onChange={(event) => updateAccounts([account.id], { defaultCurrency: event.target.value.toUpperCase() })} /></td>
                    <td><input type="checkbox" checked={account.includedInTotal} onChange={(event) => updateAccounts([account.id], { includedInTotal: event.target.checked })} /></td>
                    <td><input type="checkbox" checked={account.hidden} onChange={(event) => updateAccounts([account.id], { hidden: event.target.checked })} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="config-stack">
          <div>
            <div className="section-header">
              <div>
                <h2>全局默认汇率</h2>
                <p>导入与新增记录时使用；修改后所有历史快照会一起按新汇率重算。</p>
              </div>
              <button onClick={addCurrency}>新增币种</button>
            </div>
            <div className="rate-list">
              {Object.entries(data.defaultExchangeRates).map(([currency, rate]) => (
                <label key={currency}>
                  <span>{currency}</span>
                  <input type="number" step="0.0001" value={rate} onChange={(event) => updateDefaultRate(currency, event.target.value)} disabled={currency === 'CNY'} />
                </label>
              ))}
            </div>
          </div>

          <div className="historical-rate-card">
            <div className="section-header">
              <div>
                <h2>历史汇率</h2>
                <p>
                  {foreignCurrencies.length > 0
                    ? `按每期快照日期拉取 ${foreignCurrencies.join('、')} 的当日汇率，逐期折算，比统一用一个汇率更准确。`
                    : '当前没有外币账户。把账户币种改成 USD、HKD 等之后即可按快照日期拉取当日汇率。'}
                </p>
              </div>
              <button onClick={() => void loadHistoricalRates()} disabled={rateLoading || foreignCurrencies.length === 0}>
                {rateLoading ? '获取中…' : '按快照日期获取'}
              </button>
            </div>
            <p className="rate-source-note">数据来源：Frankfurter（欧洲央行公开汇率），免费且无需申请密钥。会覆盖各期现有汇率。</p>
            {rateStatus && <p className="rate-status">{rateStatus}</p>}
          </div>
        </div>
      </div>}
    </section>
  );
}
