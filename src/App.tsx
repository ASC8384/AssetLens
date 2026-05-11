import { useEffect, useState } from 'react';
import { ConfigPanel } from './components/ConfigPanel';
import { Dashboard } from './components/Dashboard';
import { DetailsTable } from './components/DetailsTable';
import { ImportCenter } from './components/ImportCenter';
import { ReviewReport } from './components/ReviewReport';
import { TopBar } from './components/TopBar';
import { loadAppData, saveAppData } from './lib/storage';
import { createSampleData } from './lib/sampleData';
import type { AppData } from './lib/types';
import './styles.css';

export default function App() {
  const [data, setData] = useState<AppData>(() => loadAppData());
  const [notice, setNotice] = useState('');
  const activeTab = data.preferences.activeTab;

  useEffect(() => {
    saveAppData(data);
  }, [data]);

  function updateData(next: AppData, message = '已保存到本地浏览器') {
    setData(next);
    setNotice(message);
    window.setTimeout(() => setNotice(''), 2400);
  }

  function setActiveTab(tab: AppData['preferences']['activeTab']) {
    setData({ ...data, preferences: { ...data.preferences, activeTab: tab } });
  }

  return (
    <div className="app-shell">
      {notice && <div className="toast">{notice}</div>}
      <TopBar data={data} onChange={updateData} />
      {data.snapshots.length === 0 && (
        <section className="onboarding panel">
          <div><span className="eyebrow">GET STARTED</span><h2>三步开始分析资产</h2></div>
          <ol><li>展开导入区，上传 Excel 或粘贴表格。</li><li>检查字段映射和导入质量，必要时忽略合计列。</li><li>查看仪表盘、明细表和复盘报告。</li></ol>
          <button className="primary" onClick={() => updateData(createSampleData(), '已载入示例数据')}>先看示例数据</button>
        </section>
      )}

      <div className="control-strip">
        <ImportCenter data={data} onChange={updateData} />
        <ConfigPanel data={data} onChange={updateData} />
      </div>

      <nav className="tabs">
        <button className={activeTab === 'dashboard' ? 'active' : ''} onClick={() => setActiveTab('dashboard')}>仪表盘</button>
        <button className={activeTab === 'details' ? 'active' : ''} onClick={() => setActiveTab('details')}>明细表</button>
        <button className={activeTab === 'report' ? 'active' : ''} onClick={() => setActiveTab('report')}>复盘报告</button>
      </nav>

      <main>
        {activeTab === 'dashboard' && <Dashboard data={data} />}
        {activeTab === 'details' && <DetailsTable data={data} onChange={updateData} />}
        {activeTab === 'report' && <ReviewReport data={data} />}
      </main>
    </div>
  );
}
