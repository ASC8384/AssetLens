# Manual Snapshot Input Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在导入区新增“手动新增一期”入口，让用户无需准备 Excel 也能快速录入一条新的资产快照。

**Architecture:** 在 `ImportCenter` 中增加独立的手动录入状态与表单 UI，但保存时不走新分支逻辑，而是调用 `src/lib/importers.ts` 中新增的 `buildManualSnapshot` helper，再复用现有 `mergeImportedData` 完成写入。这样 UI 只负责采集日期和金额，快照构建与重复日期处理仍集中在 `lib` 层，保证和现有导入逻辑一致。

**Tech Stack:** React 19、TypeScript、Vitest、Testing Library、现有 importers/calculations helpers

---

## File structure

- Modify: `src/lib/importers.ts`
  - 新增 `buildManualSnapshot(data, date, amountByAccountId)`，将手动表单值构造成 `AssetSnapshot`。
- Create: `src/lib/importers.test.ts`
  - 为手动快照构建与重复日期保存新增单元测试。
- Modify: `src/components/ImportCenter.tsx`
  - 新增“手动新增一期”卡片、手动录入表单、本地状态与保存流程。
- Create: `src/components/ImportCenter.test.tsx`
  - 覆盖手动录入 UI 展示、默认值、保存行为与空账户提示。
- Modify: `src/styles.css`
  - 新增手动录入卡片与表单样式。

### Task 1: Add manual snapshot helper tests

**Files:**
- Create: `src/lib/importers.test.ts`
- Modify: `src/lib/importers.ts:165-187`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { createEmptyAppData } from './defaults';
import { buildManualSnapshot, mergeImportedData } from './importers';
import { recalculateSnapshot } from './calculations';

describe('buildManualSnapshot', () => {
  it('uses latest snapshot amounts as defaults and keeps latest exchange rates', () => {
    const data = {
      ...createEmptyAppData(),
      accounts: [
        { id: 'fund', name: '基金账户', category: '基金', defaultCurrency: 'CNY', includedInTotal: true, hidden: false },
        { id: 'cash', name: '现金账户', category: '现金', defaultCurrency: 'CNY', includedInTotal: true, hidden: false },
      ],
      snapshots: [
        recalculateSnapshot({
          id: 'snap-1',
          date: '2026-05-01',
          exchangeRates: { CNY: 1, USD: 7.2 },
          entries: [
            { accountId: 'fund', accountName: '基金账户', category: '基金', originalAmount: 1000, currency: 'CNY', exchangeRate: 1, amountCny: null, excelRatio: null, computedRatio: null, ratioDiff: null, includedInTotal: true },
            { accountId: 'cash', accountName: '现金账户', category: '现金', originalAmount: 200, currency: 'CNY', exchangeRate: 1, amountCny: null, excelRatio: null, computedRatio: null, ratioDiff: null, includedInTotal: true },
          ],
          computedTotalCny: 0,
        }),
      ],
    };

    const snapshot = buildManualSnapshot(data, '2026-05-20', { fund: '1500', cash: '' });

    expect(snapshot.date).toBe('2026-05-20');
    expect(snapshot.exchangeRates).toEqual({ CNY: 1, USD: 7.2 });
    expect(snapshot.entries).toEqual(expect.arrayContaining([
      expect.objectContaining({ accountId: 'fund', originalAmount: 1500 }),
      expect.objectContaining({ accountId: 'cash', originalAmount: null }),
    ]));
  });

  it('uses default exchange rates when there is no prior snapshot', () => {
    const data = {
      ...createEmptyAppData(),
      accounts: [
        { id: 'broker', name: '券商账户', category: '证券', defaultCurrency: 'USD', includedInTotal: true, hidden: false },
      ],
      defaultExchangeRates: { CNY: 1, USD: 7.1 },
    };

    const snapshot = buildManualSnapshot(data, '2026-05-20', { broker: '300' });

    expect(snapshot.exchangeRates).toEqual({ CNY: 1, USD: 7.1 });
    expect(snapshot.entries[0]).toMatchObject({ accountId: 'broker', originalAmount: 300, currency: 'USD' });
  });

  it('keeps duplicate-date behavior through mergeImportedData', () => {
    const data = {
      ...createEmptyAppData(),
      accounts: [
        { id: 'fund', name: '基金账户', category: '基金', defaultCurrency: 'CNY', includedInTotal: true, hidden: false },
      ],
      snapshots: [
        recalculateSnapshot({
          id: 'snap-1',
          date: '2026-05-20',
          exchangeRates: { CNY: 1 },
          entries: [
            { accountId: 'fund', accountName: '基金账户', category: '基金', originalAmount: 1000, currency: 'CNY', exchangeRate: 1, amountCny: null, excelRatio: null, computedRatio: null, ratioDiff: null, includedInTotal: true },
          ],
          computedTotalCny: 0,
        }),
      ],
    };

    const snapshot = buildManualSnapshot(data, '2026-05-20', { fund: '1200' });
    const merged = mergeImportedData(data, [snapshot], data.accounts, 'overwrite');

    expect(merged.snapshots).toHaveLength(1);
    expect(merged.snapshots[0]).toMatchObject({ date: '2026-05-20', computedTotalCny: 1200 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/importers.test.ts`
Expected: FAIL with `Cannot find module './importers.test.ts'` or `buildManualSnapshot is not exported`.

- [ ] **Step 3: Write minimal implementation**

在 `src/lib/importers.ts` 添加最小实现：

```ts
export function buildManualSnapshot(data: AppData, date: string, amountByAccountId: Record<string, string>): AssetSnapshot {
  const previous = data.snapshots[data.snapshots.length - 1];
  const exchangeRates = previous?.exchangeRates ?? data.defaultExchangeRates;
  const previousEntries = new Map(previous?.entries.map((entry) => [entry.accountId, entry]) ?? []);

  return recalculateSnapshot({
    id: crypto.randomUUID(),
    date,
    exchangeRates: { ...exchangeRates },
    entries: data.accounts.map((account) => {
      const previousEntry = previousEntries.get(account.id);
      return buildEntry(
        account.name,
        parseNumber(amountByAccountId[account.id]) ?? null,
        null,
        previousEntry ? { ...account, defaultCurrency: previousEntry.currency } : account,
      );
    }),
    computedTotalCny: 0,
  });
}
```

同时创建 `src/lib/importers.test.ts`，把第 1 步中的测试内容写入文件。

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/importers.test.ts`
Expected: PASS with 3 passing tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/importers.ts src/lib/importers.test.ts
git commit -m "feat: add manual snapshot builder"
```

### Task 2: Add ImportCenter manual input UI tests

**Files:**
- Create: `src/components/ImportCenter.test.tsx`
- Modify: `src/components/ImportCenter.tsx:1-169`

- [ ] **Step 1: Write the failing test**

```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ImportCenter } from './ImportCenter';
import { createEmptyAppData } from '../lib/defaults';
import { recalculateSnapshot } from '../lib/calculations';

describe('ImportCenter manual input', () => {
  it('shows manual input form with latest snapshot amounts', () => {
    const onChange = vi.fn();
    const data = {
      ...createEmptyAppData(),
      accounts: [
        { id: 'fund', name: '基金账户', category: '基金', defaultCurrency: 'CNY', includedInTotal: true, hidden: false },
      ],
      snapshots: [
        recalculateSnapshot({
          id: 'snap-1',
          date: '2026-05-01',
          exchangeRates: { CNY: 1 },
          entries: [
            { accountId: 'fund', accountName: '基金账户', category: '基金', originalAmount: 1000, currency: 'CNY', exchangeRate: 1, amountCny: null, excelRatio: null, computedRatio: null, ratioDiff: null, includedInTotal: true },
          ],
          computedTotalCny: 0,
        }),
      ],
    };

    render(<ImportCenter data={data} onChange={onChange} />);

    fireEvent.click(screen.getByText('展开导入区'));
    fireEvent.click(screen.getByText('开始手动输入'));

    expect(screen.getByText('手动新增一期')).toBeTruthy();
    expect(screen.getByDisplayValue('1000')).toBeTruthy();
  });

  it('saves a manual snapshot through onChange', () => {
    const onChange = vi.fn();
    const data = {
      ...createEmptyAppData(),
      accounts: [
        { id: 'fund', name: '基金账户', category: '基金', defaultCurrency: 'CNY', includedInTotal: true, hidden: false },
      ],
      snapshots: [
        recalculateSnapshot({
          id: 'snap-1',
          date: '2026-05-01',
          exchangeRates: { CNY: 1 },
          entries: [
            { accountId: 'fund', accountName: '基金账户', category: '基金', originalAmount: 1000, currency: 'CNY', exchangeRate: 1, amountCny: null, excelRatio: null, computedRatio: null, ratioDiff: null, includedInTotal: true },
          ],
          computedTotalCny: 0,
        }),
      ],
    };

    render(<ImportCenter data={data} onChange={onChange} />);

    fireEvent.click(screen.getByText('展开导入区'));
    fireEvent.click(screen.getByText('开始手动输入'));
    fireEvent.change(screen.getByLabelText('日期'), { target: { value: '2026-05-20' } });
    fireEvent.change(screen.getByLabelText('基金账户'), { target: { value: '1500' } });
    fireEvent.click(screen.getByText('保存手动记录'));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0].snapshots.at(-1)).toMatchObject({ date: '2026-05-20', computedTotalCny: 1500 });
  });

  it('shows an account setup hint instead of the form when there are no accounts', () => {
    render(<ImportCenter data={createEmptyAppData()} onChange={vi.fn()} />);

    fireEvent.click(screen.getByText('展开导入区'));
    fireEvent.click(screen.getByText('开始手动输入'));

    expect(screen.getByText(/先导入一次数据，或先到明细表新增账户/)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/components/ImportCenter.test.tsx`
Expected: FAIL with missing `开始手动输入` button or missing `保存手动记录` form.

- [ ] **Step 3: Write minimal implementation**

在 `src/components/ImportCenter.tsx` 加入新的手动录入状态和 UI。关键代码结构如下：

```tsx
const [manualMode, setManualMode] = useState(false);
const [manualDate, setManualDate] = useState(new Date().toISOString().slice(0, 10));
const [manualValues, setManualValues] = useState<Record<string, string>>({});

function startManualInput() {
  const latest = data.snapshots[data.snapshots.length - 1];
  setDraft(null);
  setManualMode(true);
  setManualDate(new Date().toISOString().slice(0, 10));
  setManualValues(Object.fromEntries(data.accounts.map((account) => {
    const entry = latest?.entries.find((item) => item.accountId === account.id);
    return [account.id, entry?.originalAmount?.toString() ?? ''];
  })));
}

function confirmManualInput() {
  const snapshot = buildManualSnapshot(data, manualDate, manualValues);
  onChange(mergeImportedData(data, [snapshot], data.accounts, duplicateMode));
  setManualMode(false);
  setManualValues({});
}
```

在 `import-grid` 中新增卡片：

```tsx
<div className="manual-card">
  <span>手动新增一期</span>
  <p>适合只更新最新一条资产记录。</p>
  <button onClick={startManualInput}>开始手动输入</button>
</div>
```

在 `draft` 区块之前新增表单：

```tsx
{manualMode && (
  <div className="manual-input-panel">
    {data.accounts.length === 0 ? (
      <p>请先导入一次数据，或先到明细表新增账户。</p>
    ) : (
      <>
        <div className="section-header">
          <div>
            <h3>手动新增一期</h3>
            <p>沿用上一期数值，按需修改即可。</p>
          </div>
          <div className="toolbar compact-toolbar">
            <select value={duplicateMode} onChange={(event) => setDuplicateMode(event.target.value as DuplicateDateMode)}>
              <option value="overwrite">重复日期覆盖</option>
              <option value="keep">重复日期保留新记录</option>
              <option value="skip">重复日期跳过</option>
            </select>
            <button className="primary" onClick={confirmManualInput}>保存手动记录</button>
            <button onClick={() => setManualMode(false)}>取消</button>
          </div>
        </div>
        <div className="manual-grid">
          <label>日期<input type="date" aria-label="日期" value={manualDate} onChange={(event) => setManualDate(event.target.value)} /></label>
          {data.accounts.map((account) => (
            <label key={account.id}>{account.name}<input aria-label={account.name} value={manualValues[account.id] ?? ''} onChange={(event) => setManualValues({ ...manualValues, [account.id]: event.target.value })} /></label>
          ))}
        </div>
      </>
    )}
  </div>
)}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/components/ImportCenter.test.tsx`
Expected: PASS with 3 passing tests.

- [ ] **Step 5: Commit**

```bash
git add src/components/ImportCenter.tsx src/components/ImportCenter.test.tsx
git commit -m "feat: add manual snapshot input UI"
```

### Task 3: Style manual input panel

**Files:**
- Modify: `src/styles.css:60-170`
- Test: `src/components/ImportCenter.test.tsx`

- [ ] **Step 1: Write the failing test**

把一个轻量样式断言加到 `src/components/ImportCenter.test.tsx`：

```tsx
it('shows the manual input helper copy', () => {
  render(<ImportCenter data={data} onChange={vi.fn()} />);

  fireEvent.click(screen.getByText('展开导入区'));
  fireEvent.click(screen.getByText('开始手动输入'));

  expect(screen.getByText('沿用上一期数值，按需修改即可。')).toBeTruthy();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/components/ImportCenter.test.tsx`
Expected: FAIL because helper copy is missing.

- [ ] **Step 3: Write minimal implementation**

在 `src/styles.css` 添加手动录入区域样式：

```css
.manual-card, .manual-input-panel {
  border: 1px solid var(--line);
  border-radius: 20px;
  background: rgba(255,255,255,.72);
  padding: 18px;
}

.manual-card {
  display: grid;
  gap: 10px;
  align-content: start;
}

.manual-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(180px, 1fr));
  gap: 12px;
  margin-top: 14px;
}

.manual-grid label {
  display: grid;
  gap: 6px;
  color: #475467;
}
```

如果第 2 任务中还未加入帮助文案，同时补上：

```tsx
<p>沿用上一期数值，按需修改即可。</p>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/components/ImportCenter.test.tsx`
Expected: PASS with helper copy assertion included.

- [ ] **Step 5: Commit**

```bash
git add src/styles.css src/components/ImportCenter.tsx src/components/ImportCenter.test.tsx
git commit -m "style: add manual input panel styling"
```

### Task 4: Run regression checks and verify UI

**Files:**
- Modify: none
- Test: `src/lib/importers.test.ts`, `src/components/ImportCenter.test.tsx`

- [ ] **Step 1: Run focused tests**

Run: `npm test -- src/lib/importers.test.ts src/components/ImportCenter.test.tsx`
Expected: PASS with all new manual input tests green.

- [ ] **Step 2: Run full regression suite**

Run: `npm test`
Expected: PASS with the full Vitest suite green.

- [ ] **Step 3: Run production build**

Run: `npm run build`
Expected: PASS with Vite production bundle emitted to `dist/`.

- [ ] **Step 4: Verify the UI in browser**

Run existing dev server if needed, then open `http://127.0.0.1:5173/` and verify:

1. 展开“导入数据”区。
2. 点击“开始手动输入”。
3. 检查日期和账户金额默认填充。
4. 修改 1-2 个账户金额并保存。
5. 确认仪表盘总资产、明细表最新一期、区间日均资产净增都同步更新。
6. 用重复日期试一次 `overwrite`，确认旧记录被覆盖。

Expected: 保存后 toast 出现，最新一期数据更新，其他页面联动正常。

- [ ] **Step 5: Commit final verification checkpoint**

```bash
git status --short
```

Expected: no output.
