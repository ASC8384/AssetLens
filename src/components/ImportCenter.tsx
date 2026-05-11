import { useMemo, useState } from 'react';
import { buildSnapshotsFromDraft, createImportDraft, mergeImportedData, parseExcelFile, parsePastedTable } from '../lib/importers';
import type { AppData, DuplicateDateMode, FieldMapping, ImportDraft } from '../lib/types';
import { categories } from '../lib/defaults';

export function ImportCenter({ data, onChange }: { data: AppData; onChange: (data: AppData) => void }) {
  const [expanded, setExpanded] = useState(false);
  const [draft, setDraft] = useState<ImportDraft | null>(null);
  const [pasteText, setPasteText] = useState('');
  const [duplicateMode, setDuplicateMode] = useState<DuplicateDateMode>('overwrite');
  const importedPreview = useMemo(() => draft ? buildSnapshotsFromDraft(draft, data.accounts) : null, [draft, data.accounts]);

  async function handleFile(file: File | null) {
    if (!file) return;
    const parsed = await parseExcelFile(file);
    setDraft(createImportDraft(parsed));
  }

  function handlePasteParse() {
    if (!pasteText.trim()) return;
    setDraft(createImportDraft(parsePastedTable(pasteText)));
  }

  function updateMapping(columnIndex: number, patch: Partial<FieldMapping>) {
    if (!draft) return;
    setDraft({
      ...draft,
      mappings: draft.mappings.map((mapping) => mapping.columnIndex === columnIndex ? { ...mapping, ...patch } : mapping),
    });
  }

  function confirmImport() {
    if (!draft) return;
    const imported = buildSnapshotsFromDraft(draft, data.accounts);
    onChange(mergeImportedData(data, imported.snapshots, imported.accounts, duplicateMode));
    setDraft(null);
    setPasteText('');
  }

  return (
    <section className="panel import-center">
      <div className="section-header compact-section-header">
        <div>
          <h2>导入数据</h2>
          <p>默认只导入金额列；<code>占比</code> 列会自动忽略，用网页重算占比。</p>
        </div>
        <button onClick={() => setExpanded(!expanded)}>{expanded || draft ? '收起导入区' : '展开导入区'}</button>
      </div>

      {(expanded || draft) && <>
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

          {importedPreview && (
            <div className="preview-note">
              将导入 {importedPreview.snapshots.length} 期、{importedPreview.accounts.length} 个账户。
            </div>
          )}
        </div>
      )}
      </>}
    </section>
  );
}
