import { useMemo, useState } from 'react';
import { buildManualSnapshot, buildSnapshotsFromDraft, createImportDraft, mergeImportedData, parseExcelFile, parsePastedTable } from '../lib/importers';
import { analyzeImportQuality, ignoreTotalColumns } from '../lib/importQuality';
import { formatMoney, formatPercent } from '../lib/format';
import type { AccountConfig, AppData, DuplicateDateMode, FieldMapping, ImportDraft } from '../lib/types';
import { categories } from '../lib/defaults';

type ManualDraft = {
  date: string;
  amountByAccountId: Record<string, string>;
};

export type ImportCompletion = {
  data: AppData;
  snapshotCount: number;
  accountCount: number;
  dangerCount: number;
  warningCount: number;
  isFirstImport: boolean;
};

function todayString(): string {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function manualAccounts(data: AppData): AccountConfig[] {
  const previous = data.snapshots[data.snapshots.length - 1];
  return data.accounts.length > 0 ? data.accounts : previous?.entries.map((entry) => ({
    id: entry.accountId,
    name: entry.accountName,
    category: entry.category,
    defaultCurrency: entry.currency,
    includedInTotal: entry.includedInTotal,
    hidden: false,
  })) ?? [];
}

function createManualDraft(data: AppData, accounts: AccountConfig[]): ManualDraft {
  const previous = data.snapshots[data.snapshots.length - 1];
  const previousEntries = new Map(previous?.entries.map((entry) => [entry.accountId, entry]) ?? []);
  return {
    date: todayString(),
    amountByAccountId: Object.fromEntries(accounts.map((account) => [account.id, previousEntries.get(account.id)?.originalAmount?.toString() ?? ''])),
  };
}

export function ImportCenter({ data, onChange, onImportComplete }: { data: AppData; onChange: (data: AppData, message?: string) => void; onImportComplete?: (completion: ImportCompletion) => void }) {
  const [expanded, setExpanded] = useState(false);
  const [draft, setDraft] = useState<ImportDraft | null>(null);
  const [manualDraft, setManualDraft] = useState<ManualDraft | null>(null);
  const [pasteText, setPasteText] = useState('');
  const [duplicateMode, setDuplicateMode] = useState<DuplicateDateMode>('overwrite');
  const importedPreview = useMemo(() => draft ? buildSnapshotsFromDraft(draft, data.accounts) : null, [draft, data.accounts]);
  const importQuality = useMemo(() => importedPreview ? analyzeImportQuality(importedPreview.snapshots, importedPreview.accounts.length) : null, [importedPreview]);
  const manualAccountList = useMemo(() => manualAccounts(data), [data]);

  async function handleFile(file: File | null) {
    if (!file) return;
    setManualDraft(null);
    const parsed = await parseExcelFile(file);
    setDraft(createImportDraft(parsed));
  }

  function handlePasteParse() {
    if (!pasteText.trim()) return;
    setManualDraft(null);
    setDraft(createImportDraft(parsePastedTable(pasteText)));
  }

  function startManualInput() {
    setDraft(null);
    setDuplicateMode('overwrite');
    setManualDraft(createManualDraft(data, manualAccountList));
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

  function confirmImport() {
    if (!draft) return;
    const imported = buildSnapshotsFromDraft(draft, data.accounts);
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

  function confirmManualInput() {
    if (!manualDraft?.date || manualAccountList.length === 0) return;
    const snapshot = buildManualSnapshot(data, manualDraft.date, manualDraft.amountByAccountId);
    onChange(mergeImportedData(data, [snapshot], manualAccountList, duplicateMode));
    setManualDraft(null);
  }

  return (
    <section className="panel import-center">
      <div className="section-header compact-section-header">
        <div>
          <h2>导入数据</h2>
          <p>默认只导入金额列；<code>占比</code> 列会自动忽略，用网页重算占比。</p>
        </div>
        <button onClick={() => setExpanded(!expanded)}>{expanded || draft || manualDraft ? '收起导入区' : '展开导入区'}</button>
      </div>

      {(expanded || draft || manualDraft) && <>
      <div className="help-card">
        <h3>导入格式说明</h3>
        <ul>
          <li>第一行必须是表头，第一列建议命名为 <code>时间</code>。</li>
          <li>每个账户只关注金额列；<code>占比</code> 列默认忽略，系统会按金额重新计算占比。</li>
          <li><code>合计</code> 列可选；如果它不是总资产，请在字段映射里改成“忽略”。</li>
          <li>金额支持 <code>1,234.56</code>、<code>￥1,234.56</code>、空值和 <code>-</code>。</li>
        </ul>
        <pre>{`时间\t基金账户A\t占比\t现金账户A\t占比\t合计
2026-05-01\t59000\t34.3%\t10000\t5.8%\t69000`}</pre>
      </div>

      <div className="help-card manual-card">
        <h3>手动新增一期</h3>
        <p>按最近一期金额预填，适合只调整少数账户后快速补录一条新快照。</p>
        {!manualDraft && <button onClick={startManualInput}>开始手动输入</button>}
      </div>

      {manualDraft && (
        <div className="mapping-area manual-input-panel">
          <div className="section-header">
            <div>
              <h3>手动新增一期</h3>
              <p>沿用上一期数值，按需修改即可。</p>
            </div>
            <div className="toolbar compact-toolbar">
              {manualAccountList.length > 0 && (
                <>
                  <select aria-label="重复日期处理方式" value={duplicateMode} onChange={(event) => setDuplicateMode(event.target.value as DuplicateDateMode)}>
                    <option value="overwrite">重复日期覆盖</option>
                    <option value="keep">重复日期保留新记录</option>
                    <option value="skip">重复日期跳过</option>
                  </select>
                  <button className="primary" onClick={confirmManualInput}>保存</button>
                </>
              )}
              <button onClick={() => setManualDraft(null)}>取消</button>
            </div>
          </div>

          {manualAccountList.length === 0 ? (
            <p>请先导入一次数据，或先到明细表新增账户。</p>
          ) : (
            <div className="manual-grid">
              <label>日期<input aria-label="日期" type="date" value={manualDraft.date} onChange={(event) => setManualDraft({ ...manualDraft, date: event.target.value })} /></label>
              {manualAccountList.map((account) => (
                <label key={account.id}>{account.name}<input aria-label={account.name} value={manualDraft.amountByAccountId[account.id] ?? ''} onChange={(event) => updateManualAmount(account.id, event.target.value)} /></label>
              ))}
            </div>
          )}
        </div>
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

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>导入</th>
                  <th>原始列名</th>
                  <th>识别类型</th>
                  <th>账户名</th>
                  <th>分类</th>
                  <th>币种</th>
                  <th>计入总资产</th>
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
                        <option value="ignore">忽略</option>
                      </select>
                    </td>
                    <td><input value={mapping.accountName ?? ''} onChange={(event) => updateMapping(mapping.columnIndex, { accountName: event.target.value })} disabled={mapping.role === 'date' || mapping.role === 'total'} /></td>
                    <td>
                      <select value={mapping.category ?? '杂项'} onChange={(event) => updateMapping(mapping.columnIndex, { category: event.target.value as FieldMapping['category'] })} disabled={mapping.role !== 'account'}>
                        {categories.map((category) => <option key={category} value={category}>{category}</option>)}
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
                  <thead><tr><th>日期</th><th>网页重算总资产</th><th>Excel 合计</th><th>差异</th><th>差异率</th><th>状态</th></tr></thead>
                  <tbody>
                    {importQuality.rows.map((row) => (
                      <tr key={row.date}>
                        <td>{row.date}</td>
                        <td>{formatMoney(row.computedTotalCny)}</td>
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
      </>}
    </section>
  );
}
