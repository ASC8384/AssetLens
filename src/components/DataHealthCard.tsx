import { analyzeDataHealth } from '../lib/dashboard';
import type { AppData } from '../lib/types';

function totalQualityLabel(status: ReturnType<typeof analyzeDataHealth>['totalQualityStatus']): string {
  if (status === 'danger') return '合计差异严重';
  if (status === 'warning') return '合计差异提示';
  if (status === 'ok') return '合计一致';
  return '无原合计';
}

export function DataHealthCard({ data, onNavigate }: { data: AppData; onNavigate?: (tab: AppData['preferences']['activeTab']) => void }) {
  const analysis = analyzeDataHealth(data);
  const actionTab = analysis.action.tab;

  return (
    <section className={`panel data-health-card ${analysis.status}`}>
      <div className="data-health-main">
        <div>
          <span className="eyebrow">DATA HEALTH</span>
          <h2>{analysis.title}</h2>
          <p>{analysis.message}</p>
        </div>
        {actionTab ? (
          <button className="primary" onClick={() => onNavigate?.(actionTab)}>{analysis.action.label}</button>
        ) : (
          <span className="data-health-action">{analysis.action.label}</span>
        )}
      </div>
      <div className="data-health-metrics">
        <div><span>最近快照</span><strong>{analysis.latestDate ?? '—'}</strong><small>{analysis.daysSinceLatest === null ? '等待第一期数据' : `${analysis.daysSinceLatest} 天未更新`}</small></div>
        <div><span>快照期数</span><strong>{analysis.snapshotCount}</strong><small><span>账户数量</span> {analysis.accountCount}</small></div>
        <div><span>数据检查</span><strong>{totalQualityLabel(analysis.totalQualityStatus)}</strong><small>{analysis.hasNonCnyAssets ? '包含非 CNY 资产' : '全部为 CNY 或无资产'}</small></div>
      </div>
      <div className="data-health-chips">
        <span className={`data-health-chip ${analysis.hasTotalIssue ? 'attention' : ''}`}>{analysis.hasTotalIssue ? '合计差异待查' : '合计检查正常'}</span>
        <span className={`data-health-chip ${analysis.hasMissingExchangeRates ? 'attention' : ''}`}>{analysis.hasMissingExchangeRates ? '汇率缺失待查' : '汇率检查正常'}</span>
      </div>
      <div className="data-health-center">
        <div><strong>数据健康中心</strong><small>合计差异 · 汇率缺失 · 重复日期 · 空金额 · 快照更新节奏</small></div>
        <div><strong>备份提醒</strong><small><span>上次备份时间</span> 暂未记录；{analysis.snapshotCount >= 3 ? '已有多期快照，建议导出 JSON 备份。' : '有真实数据后建议定期导出 JSON 备份。'}</small></div>
      </div>
    </section>
  );
}
