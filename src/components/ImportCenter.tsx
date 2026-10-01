import { useEffect, useMemo, useState } from 'react';
import { isLiabilityCategory } from '../lib/calculations';
import { buildManualSnapshot, buildSnapshotsFromDraft, createImportDraft, manualSnapshotAccounts, mergeImportedData, parseExcelFile, parsePastedTable } from '../lib/importers';
import { analyzeImportQuality, ignoreTotalColumns } from '../lib/importQuality';
import { formatMoney, formatPercent, parseNumber } from '../lib/format';
import { resolveExternalIncome } from '../lib/income';
import type { AccountConfig, AccountEntry, AccountVenue, AppData, AssetCategory, AssetSnapshot, DuplicateDateMode, FieldMapping, ImportDraft } from '../lib/types';
import { categories, categoryForAccount, createAccountConfig, venueForAccount, venues } from '../lib/defaults';
import { isIsoDate, todayString } from '../lib/dates';
import { snapshotsOnDate } from '../lib/snapshotDates';
import { SnapshotDateDialog } from './SnapshotDateDialog';

type ManualSource = 'latest' | 'blank';

type ManualDraft = {
  date: string;
  source: ManualSource;
  amountByAccountId: Record<string, string>;
  /** 本期新开的账户，保存快照时才写入账户配置。 */
  newAccounts: AccountConfig[];
  excludedAccountIds: string[];
  externalIncome: string;
  incomeHint: string;
  note: string;
};

type NewAccountForm = {
  name: string;
  category: AssetCategory | '';
  venue: AccountVenue | '';
  currency: string;
  amount: string;
};

const emptyNewAccountForm: NewAccountForm = { name: '', category: '', venue: '', currency: 'CNY', amount: '' };

const amountFormat = new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 2 });

function formatAmount(value: number | null, currency: string): string {
  if (value === null) return '—';
  return currency === 'CNY' ? amountFormat.format(value) : `${amountFormat.format(value)} ${currency}`;
}

function signed(value: number, text: string): string {
  return value > 0 ? `+${text}` : text;
}

export type ImportCompletion = {
  data: AppData;
  snapshotCount: number;
  accountCount: number;
  dangerCount: number;
  warningCount: number;
  isFirstImport: boolean;
};

function manualAmountDefaults(data: AppData, accounts: AccountConfig[], source: ManualSource): Record<string, string> {
  if (source === 'blank') return Object.fromEntries(accounts.map((account) => [account.id, '']));
  const previous = data.snapshots[data.snapshots.length - 1];
  const previousEntries = new Map(previous?.entries.map((entry) => [entry.accountId, entry]) ?? []);
  return Object.fromEntries(accounts.map((account) => [account.id, previousEntries.get(account.id)?.originalAmount?.toString() ?? '']));
}

function createManualDraft(data: AppData, accounts: AccountConfig[], source: ManualSource = 'latest'): ManualDraft {
  const previous = data.snapshots[data.snapshots.length - 1];
  const carried = source === 'blank' ? { amount: null, sourceDate: null, inherited: false } : resolveExternalIncome(data.snapshots, previous);
  const previousIds = previous ? new Set(previous.entries.map((entry) => entry.accountId)) : null;
  return {
    date: todayString(),
    source,
    amountByAccountId: manualAmountDefaults(data, accounts, source),
    newAccounts: [],
    // 上一期就没有记录的账户（多半已销户）默认不带进本期，需要时可以加回。
    excludedAccountIds: previousIds ? accounts.filter((account) => !previousIds.has(account.id)).map((account) => account.id) : [],
    externalIncome: '',
    incomeHint: carried.amount === null ? '工资等非理财流入' : `上次 ${formatMoney(carried.amount)}（${carried.sourceDate}）`,
    note: '',
  };
}

export function ImportCenter({ data, onChange, onImportComplete, manualInputRequest = 0, onManualSnapshotCreated }: { data: AppData; onChange: (data: AppData, message?: string) => void; onImportComplete?: (completion: ImportCompletion) => void; manualInputRequest?: number; onManualSnapshotCreated?: (data: AppData) => void }) {
  const [draft, setDraft] = useState<ImportDraft | null>(null);
  const [manualDraft, setManualDraft] = useState<ManualDraft | null>(null);
  const [pasteText, setPasteText] = useState('');
  const [duplicateMode, setDuplicateMode] = useState<DuplicateDateMode>('overwrite');
  const [manualError, setManualError] = useState('');
  const [pendingManualDate, setPendingManualDate] = useState<string | null>(null);
  const [newAccount, setNewAccount] = useState<NewAccountForm>(emptyNewAccountForm);
  const [newAccountError, setNewAccountError] = useState('');
  const importedPreview = useMemo(() => draft ? buildSnapshotsFromDraft(draft, data.accounts, data.defaultExchangeRates) : null, [draft, data.accounts, data.defaultExchangeRates]);
  const importQuality = useMemo(() => importedPreview ? analyzeImportQuality(importedPreview.snapshots, importedPreview.accounts.length) : null, [importedPreview]);
  const manualAccountList = useMemo(() => manualSnapshotAccounts(data), [data]);
  const latestSnapshot: AssetSnapshot | undefined = data.snapshots[data.snapshots.length - 1];
  const previousEntryById = useMemo(() => new Map(latestSnapshot?.entries.map((entry) => [entry.accountId, entry]) ?? []), [latestSnapshot]);
  const currencyOptions = useMemo(() => Object.keys({ ...data.defaultExchangeRates, ...(latestSnapshot?.exchangeRates ?? {}) }), [data.defaultExchangeRates, latestSnapshot]);
  const manualIncludedAccounts = useMemo(() => {
    if (!manualDraft) return [];
    const excluded = new Set(manualDraft.excludedAccountIds);
    return [...manualAccountList, ...manualDraft.newAccounts].filter((account) => !excluded.has(account.id));
  }, [manualDraft, manualAccountList]);
  const manualPreview = useMemo(
    () => manualDraft && manualIncludedAccounts.length > 0
      ? buildManualSnapshot(data, manualDraft.date, manualDraft.amountByAccountId, { accounts: manualIncludedAccounts })
      : null,
    [data, manualDraft, manualIncludedAccounts],
  );
  const foreignMappings = useMemo(
    () => draft?.mappings.filter((mapping) => mapping.role === 'account' && mapping.import && (mapping.currency ?? 'CNY') !== 'CNY') ?? [],
    [draft],
  );

  useEffect(() => {
    if (manualInputRequest <= 0) return;
    setDraft(null);
    setDuplicateMode('overwrite');
    setManualError('');
    setPendingManualDate(null);
    setNewAccount(emptyNewAccountForm);
    setNewAccountError('');
    setManualDraft(createManualDraft(data, manualAccountList));
  }, [manualInputRequest, data, manualAccountList]);

  async function handleFile(file: File | null) {
    if (!file) return;
    setManualDraft(null);
    setPendingManualDate(null);
    setManualError('');
    const parsed = await parseExcelFile(file);
    setDraft(createImportDraft(parsed));
  }

  function handlePasteParse() {
    if (!pasteText.trim()) return;
    setManualDraft(null);
    setPendingManualDate(null);
    setManualError('');
    setDraft(createImportDraft(parsePastedTable(pasteText)));
  }

  function startManualInput() {
    setDraft(null);
    setDuplicateMode('overwrite');
    setManualError('');
    setPendingManualDate(null);
    setNewAccount(emptyNewAccountForm);
    setNewAccountError('');
    setManualDraft(createManualDraft(data, manualAccountList));
  }

  function closeManualInput() {
    setManualDraft(null);
    setManualError('');
    setPendingManualDate(null);
    setNewAccount(emptyNewAccountForm);
    setNewAccountError('');
  }

  function updateMapping(columnIndex: number, patch: Partial<FieldMapping>) {
    if (!draft) return;
    setDraft({
      ...draft,
      mappings: draft.mappings.map((mapping) => mapping.columnIndex === columnIndex ? { ...mapping, ...patch } : mapping),
    });
  }

  function updateManualAmount(accountId: string, value: string) {
    if (!manualDraft) return;
    setManualDraft({
      ...manualDraft,
      amountByAccountId: { ...manualDraft.amountByAccountId, [accountId]: value },
    });
  }

  function updateManualSource(source: ManualSource) {
    if (!manualDraft) return;
    const next = createManualDraft(data, manualAccountList, source);
    setManualDraft({
      ...next,
      amountByAccountId: {
        ...next.amountByAccountId,
        ...Object.fromEntries(manualDraft.newAccounts.map((account) => [account.id, manualDraft.amountByAccountId[account.id] ?? ''])),
      },
      newAccounts: manualDraft.newAccounts,
      excludedAccountIds: manualDraft.excludedAccountIds,
      date: manualDraft.date,
      externalIncome: manualDraft.externalIncome,
      note: manualDraft.note,
    });
  }

  function excludeManualAccount(accountId: string) {
    if (!manualDraft) return;
    if (manualDraft.newAccounts.some((account) => account.id === accountId)) {
      const amountByAccountId = { ...manualDraft.amountByAccountId };
      delete amountByAccountId[accountId];
      setManualDraft({ ...manualDraft, amountByAccountId, newAccounts: manualDraft.newAccounts.filter((account) => account.id !== accountId) });
      return;
    }
    setManualDraft({ ...manualDraft, excludedAccountIds: [...manualDraft.excludedAccountIds, accountId] });
  }

  function restoreManualAccount(accountId: string, amount?: string) {
    if (!manualDraft) return;
    setManualDraft({
      ...manualDraft,
      excludedAccountIds: manualDraft.excludedAccountIds.filter((id) => id !== accountId),
      amountByAccountId: amount ? { ...manualDraft.amountByAccountId, [accountId]: amount } : manualDraft.amountByAccountId,
    });
  }

  function addManualAccount() {
    if (!manualDraft) return;
    const name = newAccount.name.trim();
    if (!name) {
      setNewAccountError('请输入账户名称。');
      return;
    }
    const base = createAccountConfig(name);
    const sameAccount = (account: AccountConfig) => account.id === base.id || account.name.trim() === name;
    const existing = manualAccountList.find(sameAccount);
    if (existing && manualDraft.excludedAccountIds.includes(existing.id)) {
      restoreManualAccount(existing.id, newAccount.amount.trim());
    } else if (existing || manualDraft.newAccounts.some(sameAccount)) {
      setNewAccountError(`已有账户“${existing?.name ?? name}”，直接修改它的金额即可。`);
      return;
    } else {
      const account: AccountConfig = {
        ...base,
        category: newAccount.category || base.category,
        venue: newAccount.venue || base.venue,
        defaultCurrency: newAccount.currency,
      };
      setManualDraft({
        ...manualDraft,
        newAccounts: [...manualDraft.newAccounts, account],
        amountByAccountId: { ...manualDraft.amountByAccountId, [account.id]: newAccount.amount.trim() },
      });
    }
    setNewAccount(emptyNewAccountForm);
    setNewAccountError('');
  }

  function confirmImport() {
    if (!draft) return;
    const imported = buildSnapshotsFromDraft(draft, data.accounts, data.defaultExchangeRates);
    const quality = analyzeImportQuality(imported.snapshots, imported.accounts.length);
    const nextData = mergeImportedData(data, imported.snapshots, imported.accounts, duplicateMode);
    if (onImportComplete) {
      onImportComplete({
        data: nextData,
        snapshotCount: quality.snapshotCount,
        accountCount: quality.accountCount,
        dangerCount: quality.dangerCount,
        warningCount: quality.warningCount,
        isFirstImport: data.snapshots.length === 0,
      });
    } else {
      onChange(nextData);
    }
    setDraft(null);
    setPasteText('');
  }

  function saveManualSnapshot(date: string, mode: DuplicateDateMode) {
    if (!manualDraft || manualIncludedAccounts.length === 0) return;
    const snapshot = buildManualSnapshot(data, date, manualDraft.amountByAccountId, {
      externalIncome: manualDraft.externalIncome,
      note: manualDraft.note,
      accounts: manualIncludedAccounts,
    });
    const nextData = mergeImportedData(data, [snapshot], [...manualAccountList, ...manualDraft.newAccounts], mode);
    if (onManualSnapshotCreated) {
      onManualSnapshotCreated(nextData);
    } else {
      onChange(nextData);
    }
    closeManualInput();
  }

  function confirmManualInput() {
    if (!manualDraft || manualAccountList.length === 0) return;
    if (!isIsoDate(manualDraft.date)) {
      setManualError('请选择有效日期。');
      return;
    }
    if (manualIncludedAccounts.length === 0) {
      setManualError('本期至少要保留一个账户。');
      return;
    }
    if (snapshotsOnDate(data.snapshots, manualDraft.date).length > 0) {
      setManualError('');
      setPendingManualDate(manualDraft.date);
      return;
    }
    saveManualSnapshot(manualDraft.date, 'keep');
  }

  function renderManualForm(manual: ManualDraft) {
    const newAccountIds = new Set(manual.newAccounts.map((account) => account.id));
    const visibleAccounts = manualIncludedAccounts.filter((account) => !account.hidden);
    const hiddenAccounts = manualIncludedAccounts.filter((account) => account.hidden);
    const excludedAccounts = manualAccountList.filter((account) => manual.excludedAccountIds.includes(account.id));
    const previewEntryById = new Map(manualPreview?.entries.map((entry) => [entry.accountId, entry]) ?? []);
    const subtotal = (accounts: AccountConfig[]) => accounts.reduce((sum, account) => sum + (previewEntryById.get(account.id)?.amountCny ?? 0), 0);
    const netChange = manualPreview && latestSnapshot ? manualPreview.computedTotalCny - latestSnapshot.computedTotalCny : null;
    const renderRow = (account: AccountConfig) => (
      <ManualAccountRow
        key={account.id}
        account={account}
        value={manual.amountByAccountId[account.id] ?? ''}
        previous={previousEntryById.get(account.id)}
        isNew={newAccountIds.has(account.id)}
        onChange={(value) => updateManualAmount(account.id, value)}
        onExclude={() => excludeManualAccount(account.id)}
      />
    );
    return (
      <>
        <div className="manual-meta-grid">
          <label>日期<input aria-label="日期" type="date" value={manual.date} onChange={(event) => setManualDraft({ ...manual, date: event.target.value })} /></label>
          <label>外界收入
            <input aria-label="外界收入" value={manual.externalIncome} onChange={(event) => setManualDraft({ ...manual, externalIncome: event.target.value })} placeholder={manual.incomeHint} />
          </label>
          <label>备注<input aria-label="备注" value={manual.note} onChange={(event) => setManualDraft({ ...manual, note: event.target.value })} /></label>
        </div>

        <div className="manual-summary">
          <span>本期净资产<strong>{formatMoney(manualPreview?.computedTotalCny)}</strong></span>
          {netChange !== null && latestSnapshot ? (
            <span>较上期（{latestSnapshot.date}）<strong className={netChange > 0 ? 'positive' : netChange < 0 ? 'negative' : ''}>{signed(netChange, formatMoney(netChange))}</strong></span>
          ) : null}
          <span>{manualIncludedAccounts.length} 个账户{excludedAccounts.length > 0 ? `，${excludedAccounts.length} 个未纳入本期` : ''}</span>
        </div>

        <div className="manual-groups">
          {categories.map((category) => {
            const accounts = visibleAccounts.filter((account) => account.category === category);
            if (accounts.length === 0) return null;
            return (
              <section key={category} className="manual-group" aria-label={`${category}账户`}>
                <div className="manual-group-header">
                  <strong>{category}</strong>
                  <span>{accounts.length} 个 · 小计 {formatMoney(subtotal(accounts))}</span>
                </div>
                {accounts.map(renderRow)}
              </section>
            );
          })}
          {hiddenAccounts.length > 0 && (
            <details className="manual-group manual-hidden-group">
              <summary>隐藏账户（{hiddenAccounts.length}）· 小计 {formatMoney(subtotal(hiddenAccounts))}</summary>
              {hiddenAccounts.map(renderRow)}
            </details>
          )}
        </div>

        {excludedAccounts.length > 0 && (
          <div className="manual-excluded">
            <span>未纳入本期：</span>
            {excludedAccounts.map((account) => (
              <button key={account.id} aria-label={`加回本期：${account.name}`} onClick={() => restoreManualAccount(account.id)}>{account.name} ＋</button>
            ))}
            <small>保存后这些账户在本期没有记录，历史数据不受影响。</small>
          </div>
        )}

        <form className="manual-add-account" onSubmit={(event) => { event.preventDefault(); addManualAccount(); }}>
          <strong>新增账户</strong>
          <label>名称<input aria-label="新账户名称" value={newAccount.name} onChange={(event) => setNewAccount({ ...newAccount, name: event.target.value })} placeholder="如：券商账户B" /></label>
          <label>大类
            <select aria-label="新账户大类" value={newAccount.category} onChange={(event) => setNewAccount({ ...newAccount, category: event.target.value as NewAccountForm['category'] })}>
              <option value="">自动（{categoryForAccount(newAccount.name)}）</option>
              {categories.map((category) => <option key={category} value={category}>{category}</option>)}
            </select>
          </label>
          <label>渠道
            <select aria-label="新账户渠道" value={newAccount.venue} onChange={(event) => setNewAccount({ ...newAccount, venue: event.target.value as NewAccountForm['venue'] })}>
              <option value="">自动（{venueForAccount(newAccount.name)}）</option>
              {venues.map((venue) => <option key={venue} value={venue}>{venue}</option>)}
            </select>
          </label>
          <label>币种
            <select aria-label="新账户币种" value={newAccount.currency} onChange={(event) => setNewAccount({ ...newAccount, currency: event.target.value })}>
              {currencyOptions.map((currency) => <option key={currency} value={currency}>{currency}</option>)}
            </select>
          </label>
          <label>金额<input aria-label="新账户金额" value={newAccount.amount} onChange={(event) => setNewAccount({ ...newAccount, amount: event.target.value })} /></label>
          <button type="submit">添加</button>
          {newAccountError ? <p className="danger-text">{newAccountError}</p> : null}
        </form>
      </>
    );
  }

  return (
    <div className="import-center">
      <div className="help-card">
        <h3>导入格式说明</h3>
        <ul>
          <li>第一行必须是表头，第一列建议命名为 <code>时间</code>。</li>
          <li>每个账户只关注金额列；<code>占比</code> 列默认忽略，系统会按金额重新计算占比。</li>
          <li><code>合计</code> 列可选；如果它不是总资产，请在字段映射里改成“忽略”。</li>
          <li>信用卡、花呗等欠款请归入 <code>负债</code>；金额填欠款正数，会从净资产中扣除。</li>
          <li><code>收入</code> 列会识别为外界收入（工资等非理财流入），<code>备注</code> 会一并导入。</li>
          <li><code>时长</code>、<code>变动</code>、<code>日均</code>、<code>结余</code> 等派生列默认忽略。</li>
          <li>外币账户：上传 .xlsx 时会读取 <code>合计</code> 公式里的折算倍数（如 <code>*0.9</code>）自动判断币种；粘贴文本读不到公式，请在下方“币种”列手动改，汇率在“账户与汇率配置”里调。</li>
        </ul>
        <pre>{`时间\t基金账户A\t占比\t现金账户A\t占比\t合计
2026-05-01\t59000\t34.3%\t10000\t5.8%\t69000`}</pre>
      </div>

      <div className="help-card manual-card">
        <h3>手动新增一期</h3>
        <p>按最近一期金额预填，可顺手新增账户或把已销户的账户移出本期。</p>
        {!manualDraft && <button onClick={startManualInput}>开始手动输入</button>}
      </div>

      {manualDraft && (
        <div className="mapping-area manual-input-panel">
          <div className="section-header">
            <div>
              <h3>手动新增一期</h3>
              <p>沿用上一期数值，按大类分组；每个账户旁边对照上期金额和本期变化。</p>
            </div>
            <div className="toolbar compact-toolbar">
              {manualAccountList.length > 0 && (
                <>
                  <label>复制来源
                    <select aria-label="复制来源" value={manualDraft.source} onChange={(event) => updateManualSource(event.target.value as ManualSource)}>
                      <option value="latest">复制最新一期</option>
                      <option value="blank">空白金额</option>
                    </select>
                  </label>
                  <button className="primary" onClick={confirmManualInput}>保存</button>
                </>
              )}
              <button onClick={closeManualInput}>取消</button>
            </div>
          </div>
          {manualError ? <p className="danger-text">{manualError}</p> : null}

          {manualAccountList.length === 0 ? (
            <p>请先导入一次数据，或先到明细表新增账户。</p>
          ) : renderManualForm(manualDraft)}
        </div>
      )}

      {pendingManualDate !== null && manualDraft && (
        <SnapshotDateDialog
          title="日期已有记录"
          description="这份日期已经有快照。覆盖会替换当天已有记录，保留则会新增一条同日快照。"
          date={pendingManualDate}
          existingCount={snapshotsOnDate(data.snapshots, pendingManualDate).length}
          error={manualError}
          onDateChange={(date) => {
            setPendingManualDate(date);
            setManualDraft({ ...manualDraft, date });
          }}
          onConfirm={(choice) => {
            if (!isIsoDate(pendingManualDate)) {
              setManualError('请选择有效日期。');
              return;
            }
            if (choice === 'none' && snapshotsOnDate(data.snapshots, pendingManualDate).length > 0) return;
            saveManualSnapshot(pendingManualDate, choice === 'overwrite' ? 'overwrite' : 'keep');
          }}
          onCancel={() => setPendingManualDate(null)}
        />
      )}

      <div className="import-grid">
        <label className="drop-card">
          <span>上传 .xlsx 文件</span>
          <input type="file" accept=".xlsx" onChange={(event) => void handleFile(event.target.files?.[0] ?? null)} />
        </label>
        <div className="paste-card">
          <label htmlFor="paste-table">粘贴表格文本</label>
          <textarea id="paste-table" value={pasteText} onChange={(event) => setPasteText(event.target.value)} placeholder="从 Excel 复制后粘贴到这里" />
          <button onClick={handlePasteParse}>解析粘贴内容</button>
        </div>
      </div>

      {draft && (
        <div className="mapping-area">
          <div className="section-header">
            <div>
              <h3>字段识别与修正</h3>
              <p>已识别 {draft.parsed.rows.length} 行数据，确认后导入。</p>
            </div>
            <div className="toolbar compact-toolbar">
              <select value={duplicateMode} onChange={(event) => setDuplicateMode(event.target.value as DuplicateDateMode)}>
                <option value="overwrite">重复日期覆盖</option>
                <option value="keep">重复日期保留新记录</option>
                <option value="skip">重复日期跳过</option>
              </select>
              {importQuality?.hasSuspiciousTotal && <button onClick={() => setDraft(ignoreTotalColumns(draft))}>一键忽略合计列</button>}
              <button className="primary" onClick={confirmImport}>确认导入</button>
              <button onClick={() => setDraft(null)}>取消</button>
            </div>
          </div>

          {foreignMappings.length > 0 && (
            <p className="fx-detected">
              识别到 {foreignMappings.length} 个外币列：
              {foreignMappings.map((mapping) => `${mapping.accountName || mapping.header}（${mapping.currency}）`).join('、')}
              。折算按「账户与汇率配置」里的汇率，可在下表“币种”列修正。
            </p>
          )}

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>导入</th>
                  <th>原始列名</th>
                  <th>识别类型</th>
                  <th>账户名</th>
                  <th>大类</th>
                  <th>渠道</th>
                  <th>币种</th>
                  <th>计入净资产</th>
                  <th>示例值</th>
                </tr>
              </thead>
              <tbody>
                {draft.mappings.map((mapping) => (
                  <tr key={mapping.columnIndex}>
                    <td><input type="checkbox" checked={mapping.import} onChange={(event) => updateMapping(mapping.columnIndex, { import: event.target.checked })} /></td>
                    <td>{mapping.header || `第 ${mapping.columnIndex + 1} 列`}</td>
                    <td>
                      <select value={mapping.role} onChange={(event) => updateMapping(mapping.columnIndex, { role: event.target.value as FieldMapping['role'] })}>
                        <option value="date">时间</option>
                        <option value="account">账户金额</option>
                        <option value="total">合计</option>
                        <option value="income">外界收入</option>
                        <option value="note">备注</option>
                        <option value="ignore">忽略</option>
                      </select>
                    </td>
                    <td><input value={mapping.accountName ?? ''} onChange={(event) => updateMapping(mapping.columnIndex, { accountName: event.target.value })} disabled={mapping.role !== 'account'} /></td>
                    <td>
                      <select value={mapping.category ?? '未分类'} onChange={(event) => updateMapping(mapping.columnIndex, { category: event.target.value as FieldMapping['category'] })} disabled={mapping.role !== 'account'}>
                        {categories.map((category) => <option key={category} value={category}>{category}</option>)}
                      </select>
                    </td>
                    <td>
                      <select value={mapping.venue ?? '其他'} onChange={(event) => updateMapping(mapping.columnIndex, { venue: event.target.value as FieldMapping['venue'] })} disabled={mapping.role !== 'account'}>
                        {venues.map((venue) => <option key={venue} value={venue}>{venue}</option>)}
                      </select>
                    </td>
                    <td><input value={mapping.currency ?? 'CNY'} onChange={(event) => updateMapping(mapping.columnIndex, { currency: event.target.value.toUpperCase() })} disabled={mapping.role !== 'account'} /></td>
                    <td><input type="checkbox" checked={mapping.includedInTotal ?? true} disabled={mapping.role !== 'account'} onChange={(event) => updateMapping(mapping.columnIndex, { includedInTotal: event.target.checked })} /></td>
                    <td>{mapping.sampleValues.filter(Boolean).join(' / ') || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {importQuality && (
            <div className="quality-preview">
              <div className="quality-summary">
                <strong>将导入 {importQuality.snapshotCount} 期、{importQuality.accountCount} 个账户</strong>
                <span>{importQuality.dangerCount} 个严重异常 · {importQuality.warningCount} 个轻微异常</span>
              </div>
              {importQuality.hasSuspiciousTotal && <p className="danger-text">检测到合计列疑似不是总资产，可点击“一键忽略合计列”。</p>}
              <div className="table-wrap small-table">
                <table>
                  <thead><tr><th>日期</th><th>净资产</th><th>账户金额合计</th><th>Excel 合计</th><th>差异</th><th>差异率</th><th>状态</th></tr></thead>
                  <tbody>
                    {importQuality.rows.map((row) => (
                      <tr key={row.date}>
                        <td>{row.date}</td>
                        <td>{formatMoney(row.computedTotalCny)}</td>
                        <td>{formatMoney(row.bookTotal)}</td>
                        <td>{formatMoney(row.excelTotal)}</td>
                        <td>{formatMoney(row.diff)}</td>
                        <td>{formatPercent(row.diffRatio)}</td>
                        <td className={row.status === 'danger' ? 'danger-text' : row.status === 'warning' ? 'warning-text' : ''}>{row.status === 'danger' ? '严重' : row.status === 'warning' ? '提示' : '正常'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ManualAccountRow({ account, value, previous, isNew, onChange, onExclude }: {
  account: AccountConfig;
  value: string;
  previous: AccountEntry | undefined;
  isNew: boolean;
  onChange: (value: string) => void;
  onExclude: () => void;
}) {
  const liability = isLiabilityCategory(account.category);
  const previousAmount = isNew ? null : previous?.originalAmount ?? null;
  const currentAmount = parseNumber(value);
  const diff = previousAmount !== null && currentAmount !== null ? currentAmount - previousAmount : null;
  const netEffect = diff === null ? 0 : liability ? -diff : diff;
  const meta = [account.venue, account.defaultCurrency !== 'CNY' ? account.defaultCurrency : null, liability ? '欠款' : null, isNew ? '新账户' : null].filter(Boolean).join(' · ');
  return (
    <div className="manual-account-row">
      <div className="manual-account-name">
        <strong>{account.name}</strong>
        <small>{meta}</small>
      </div>
      <input aria-label={account.name} value={value} onChange={(event) => onChange(event.target.value)} />
      <div className="manual-account-delta">
        <small>上期 {isNew ? '无' : formatAmount(previousAmount, account.defaultCurrency)}</small>
        {diff !== null ? (
          <span className={netEffect > 0 ? 'positive' : netEffect < 0 ? 'negative' : 'muted'}>
            {diff === 0 ? '无变化' : signed(diff, formatAmount(diff, account.defaultCurrency))}
          </span>
        ) : null}
      </div>
      <button type="button" className="link-button" aria-label={`移出本期：${account.name}`} onClick={onExclude}>移出</button>
    </div>
  );
}
