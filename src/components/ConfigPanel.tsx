import { useState } from 'react';
import type { AccountConfig, AppData, AssetCategory } from '../lib/types';
import { applyAccountsToSnapshots, applyExchangeRateToSnapshots } from '../lib/calculations';
import { applyHistoricalRates, collectForeignCurrencies } from '../lib/exchangeRates';
import { categories } from '../lib/defaults';

export function ConfigPanel({ data, onChange }: { data: AppData; onChange: (data: AppData) => void }) {
  const [expanded, setExpanded] = useState(false);
  const [rateLoading, setRateLoading] = useState(false);
  const [rateStatus, setRateStatus] = useState<string | null>(null);
  const foreignCurrencies = collectForeignCurrencies(data);

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

  function updateAccount(id: string, patch: Partial<AccountConfig>) {
    const accounts = data.accounts.map((account) => account.id === id ? { ...account, ...patch } : account);
    onChange({ ...data, accounts, snapshots: applyAccountsToSnapshots(data.snapshots, accounts) });
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
          <p>{data.accounts.length} 个账户 · {Object.keys(data.defaultExchangeRates).length} 个默认币种</p>
        </div>
        <button onClick={() => setExpanded(!expanded)}>{expanded ? '收起配置' : '展开配置'}</button>
      </div>
      {expanded && <div className="config-grid">
        <div>
          <div className="section-header">
            <div>
              <h2>账户配置</h2>
              <p>修改分类、默认币种、是否计入统计或隐藏账户。负债请填欠款正数，会从净资产中扣除。</p>
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
