import { useEffect, useState } from 'react';
import { ConfigPanel } from './components/ConfigPanel';
import { Dashboard } from './components/Dashboard';
import { DetailsTable } from './components/DetailsTable';
import { ImportCenter } from './components/ImportCenter';
import { ReviewReport } from './components/ReviewReport';
import { TopBar } from './components/TopBar';
import { loadAppData, saveAppData } from './lib/storage';
import type { AppData } from './lib/types';
import './styles.css';

export default function App() {
  const [data, setData] = useState<AppData>(() => loadAppData());
  const activeTab = data.preferences.activeTab;

  useEffect(() => {
    saveAppData(data);
  }, [data]);

  function updateData(next: AppData) {
    setData(next);
  }

  function setActiveTab(tab: AppData['preferences']['activeTab']) {
    setData({ ...data, preferences: { ...data.preferences, activeTab: tab } });
  }

  return (
    <div className="app-shell">
      <TopBar data={data} onChange={updateData} />
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
