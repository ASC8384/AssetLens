import type { AppData } from '../lib/types';
import { createManualSnapshot } from '../lib/importers';
import { exportBackup, importBackup } from '../lib/storage';
import { downloadText } from '../lib/format';
import { createSampleData } from '../lib/sampleData';

export function TopBar({ data, onChange }: { data: AppData; onChange: (data: AppData) => void }) {
  function addManualSnapshot() {
    const date = window.prompt('请输入新一期日期，例如 2026-05-01', new Date().toISOString().slice(0, 10));
    if (!date) return;
    onChange({ ...data, snapshots: [...data.snapshots, createManualSnapshot(data, date)] });
  }

  function exportJson() {
    downloadText(`asset-lens-backup-${new Date().toISOString().slice(0, 10)}.json`, exportBackup(data));
  }

  async function importJson(file: File | null) {
    if (!file) return;
    onChange(importBackup(await file.text()));
  }

  return (
    <header className="top-bar">
      <div>
        <h1>AssetLens</h1>
        <p>{data.snapshots.length} 期记录 · {data.accounts.length} 个账户 · 数据仅保存在本地浏览器</p>
      </div>
      <div className="toolbar">
        <button onClick={addManualSnapshot}>手动新增记录</button>
        <button onClick={exportJson}>导出 JSON 备份</button>
        <label className="button-like">
          导入 JSON 备份
          <input type="file" accept="application/json,.json" onChange={(event) => void importJson(event.target.files?.[0] ?? null)} />
        </label>
        <button onClick={() => onChange(createSampleData())}>载入示例数据</button>
      </div>
    </header>
  );
}
