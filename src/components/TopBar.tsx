import type { AppData } from '../lib/types';
import { createEmptyAppData } from '../lib/defaults';
import { exportBackup, importBackup } from '../lib/storage';
import { downloadText } from '../lib/format';
import { createSampleData } from '../lib/sampleData';

export function TopBar({ data, onChange, onManualInputRequest }: { data: AppData; onChange: (data: AppData) => void; onManualInputRequest: () => void }) {

  function exportJson() {
    downloadText(`asset-lens-backup-${new Date().toISOString().slice(0, 10)}.json`, exportBackup(data));
  }

  async function importJson(file: File | null) {
    if (!file) return;
    onChange(importBackup(await file.text()));
  }

  function clearData() {
    if (!window.confirm('确定清空所有本地资产数据吗？建议先导出 JSON 备份。')) return;
    onChange(createEmptyAppData());
  }

  return (
    <header className="top-bar">
      <div className="brand-block">
        <span className="eyebrow">LOCAL ASSET COMMAND</span>
        <h1>AssetLens</h1>
        <p>{data.snapshots.length} 期记录 · {data.accounts.length} 个账户 · 数据仅保存在本地浏览器</p>
      </div>
      <div className="toolbar">
        <button onClick={onManualInputRequest}>手动新增记录</button>
        <button onClick={exportJson}>导出 JSON 备份</button>
        <label className="button-like">
          导入 JSON 备份
          <input type="file" accept="application/json,.json" onChange={(event) => void importJson(event.target.files?.[0] ?? null)} />
        </label>
        <button onClick={() => onChange(createSampleData())}>载入示例数据</button>
        <button className="danger-button" onClick={clearData}>清空本地数据</button>
      </div>
    </header>
  );
}
