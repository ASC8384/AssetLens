import { useState } from 'react';
import type { AccountConfig, AppData, AssetCategory } from '../lib/types';
import { applyAccountsToSnapshots } from '../lib/calculations';
import { categories } from '../lib/defaults';

export function ConfigPanel({ data, onChange }: { data: AppData; onChange: (data: AppData) => void }) {
  const [expanded, setExpanded] = useState(false);
  function updateAccount(id: string, patch: Partial<AccountConfig>) {
    const accounts = data.accounts.map((account) => account.id === id ? { ...account, ...patch } : account);
    onChange({ ...data, accounts, snapshots: applyAccountsToSnapshots(data.snapshots, accounts) });
  }

  function updateDefaultRate(currency: string, value: string) {
    const rate = Number(value);
    if (!Number.isFinite(rate)) return;
    onChange({ ...data, defaultExchangeRates: { ...data.defaultExchangeRates, [currency]: rate } });
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
          <p>{data.accounts.length} 个账户 · {Object.keys(data.defaultExchangeRates).length} 个默认币种</p>
        </div>
        <button onClick={() => setExpanded(!expanded)}>{expanded ? '收起配置' : '展开配置'}</button>
      </div>
      {expanded && <div className="config-grid">
        <div>
          <div className="section-header">
            <div>
              <h2>账户配置</h2>
              <p>修改分类、默认币种、是否计入总资产或隐藏账户。</p>
            </div>
          </div>
          <div className="table-wrap small-table">
            <table>
              <thead>
                <tr>
                  <th>账户</th>
                  <th>分类</th>
                  <th>币种</th>
                  <th>计入</th>
                  <th>隐藏</th>
                </tr>
              </thead>
              <tbody>
                {data.accounts.map((account) => (
                  <tr key={account.id}>
                    <td>{account.name}</td>
                    <td>
                      <select value={account.category} onChange={(event) => updateAccount(account.id, { category: event.target.value as AssetCategory })}>
                        {categories.map((category) => <option key={category} value={category}>{category}</option>)}
                      </select>
                    </td>
                    <td><input value={account.defaultCurrency} onChange={(event) => updateAccount(account.id, { defaultCurrency: event.target.value.toUpperCase() })} /></td>
                    <td><input type="checkbox" checked={account.includedInTotal} onChange={(event) => updateAccount(account.id, { includedInTotal: event.target.checked })} /></td>
                    <td><input type="checkbox" checked={account.hidden} onChange={(event) => updateAccount(account.id, { hidden: event.target.checked })} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <div className="section-header">
            <div>
              <h2>全局默认汇率</h2>
              <p>新增记录时使用；每期仍可单独修改。</p>
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
      </div>}
    </section>
  );
}
