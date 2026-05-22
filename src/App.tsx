import { useEffect, useRef, useState } from 'react';
import { ConfigPanel } from './components/ConfigPanel';
import { Dashboard } from './components/Dashboard';
import { DataHealthCard } from './components/DataHealthCard';
import { DetailsTable } from './components/DetailsTable';
import { FireView } from './components/FireView';
import { ImportCenter, type ImportCompletion } from './components/ImportCenter';
import { ReviewReport } from './components/ReviewReport';
import { TopBar } from './components/TopBar';
import { StrategyPanel } from './components/StrategyPanel';
import { loadAppData, saveAppData } from './lib/storage';
import { createSampleData } from './lib/sampleData';
import type { AppData } from './lib/types';
import './styles.css';

export default function App() {
  const [data, setData] = useState<AppData>(() => loadAppData());
  const [notice, setNotice] = useState('');
  const [manualInputRequest, setManualInputRequest] = useState(0);
  const noticeTimerRef = useRef<number | null>(null);
  const activeTab = data.preferences.activeTab;

  useEffect(() => {
    saveAppData(data);
  }, [data]);

  useEffect(() => () => {
    if (noticeTimerRef.current !== null) window.clearTimeout(noticeTimerRef.current);
  }, []);

  function updateData(next: AppData, message = '已保存到本地浏览器') {
    setData(next);
    setNotice(message);
    if (noticeTimerRef.current !== null) window.clearTimeout(noticeTimerRef.current);
    noticeTimerRef.current = window.setTimeout(() => {
      setNotice('');
      noticeTimerRef.current = null;
    }, 2400);
  }

  function setActiveTab(tab: AppData['preferences']['activeTab']) {
    setData({ ...data, preferences: { ...data.preferences, activeTab: tab } });
  }

  function handleImportComplete(completion: ImportCompletion) {
    if (completion.dangerCount > 0) {
      updateData({ ...completion.data, preferences: { ...completion.data.preferences, activeTab: 'details', detailMode: 'analysis' } }, `已导入 ${completion.snapshotCount} 期、${completion.accountCount} 个账户；发现 ${completion.dangerCount} 个严重异常，请在明细表检查。`);
      return;
    }
    if (completion.isFirstImport) {
      updateData({ ...completion.data, preferences: { ...completion.data.preferences, activeTab: 'dashboard' } }, `首次导入完成：已导入 ${completion.snapshotCount} 期、${completion.accountCount} 个账户，建议先看仪表盘。`);
      return;
    }
    updateData({ ...completion.data, preferences: { ...completion.data.preferences, activeTab: 'dashboard' } }, `已导入 ${completion.snapshotCount} 期、${completion.accountCount} 个账户；可以查看仪表盘或生成复盘。`);
  }

  return (
    <div className="app-shell">
      {notice && <div className="toast">{notice}</div>}
      <TopBar data={data} onChange={updateData} onManualInputRequest={() => setManualInputRequest((value) => value + 1)} />
      {data.snapshots.length === 0 && (
        <section className="onboarding panel">
          <div><span className="eyebrow">GET STARTED</span><h2>三步开始分析资产</h2></div>
          <ol><li>展开导入区，上传 Excel 或粘贴表格。</li><li>检查字段映射和导入质量，必要时忽略合计列。</li><li>查看仪表盘、明细表和复盘报告。</li></ol>
          <button className="primary" onClick={() => updateData(createSampleData(), '已载入示例数据')}>先看示例数据</button>
        </section>
      )}

      <DataHealthCard data={data} onNavigate={setActiveTab} />

      <div className="control-strip three-column-controls">
        <ImportCenter data={data} onChange={updateData} onImportComplete={handleImportComplete} manualInputRequest={manualInputRequest} onManualSnapshotCreated={(next) => updateData({ ...next, preferences: { ...next.preferences, activeTab: 'details' } }, '已新增一期记录，可在明细表继续编辑。')} />
        <StrategyPanel data={data} onChange={updateData} />
        <ConfigPanel data={data} onChange={updateData} />
      </div>

      <nav className="tabs">
        <button className={activeTab === 'dashboard' ? 'active' : ''} onClick={() => setActiveTab('dashboard')}>仪表盘</button>
        <button className={activeTab === 'details' ? 'active' : ''} onClick={() => setActiveTab('details')}>明细表</button>
        <button className={activeTab === 'report' ? 'active' : ''} onClick={() => setActiveTab('report')}>复盘报告</button>
        <button className={activeTab === 'fire' ? 'active' : ''} onClick={() => setActiveTab('fire')}>FIRE</button>
      </nav>

      <main>
        {activeTab === 'dashboard' && <Dashboard data={data} />}
        {activeTab === 'details' && <DetailsTable data={data} onChange={updateData} />}
        {activeTab === 'report' && <ReviewReport data={data} />}
        {activeTab === 'fire' && <FireView data={data} onChange={updateData} />}
      </main>
    </div>
  );
}
