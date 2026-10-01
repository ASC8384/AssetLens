import type { ReactNode } from 'react';
import { isUnclassifiedCategory } from '../lib/defaults';
import { formatMoney, formatPercent } from '../lib/format';
import { analyzeStrategy } from '../lib/strategy';
import type { AppData, ConsolePanelId } from '../lib/types';

export type { ConsolePanelId };

type Chip = {
  label: string;
  attention?: boolean;
};

type ConsoleCard = {
  id: ConsolePanelId;
  title: string;
  summary: ReactNode;
  expandLabel: string;
  collapseLabel: string;
  chips: Chip[];
};

function riskStatusLabel(status: 'below' | 'within' | 'above'): string {
  if (status === 'below') return '偏低';
  if (status === 'above') return '偏高';
  return '达标';
}

function importChips(data: AppData): Chip[] {
  const latest = data.snapshots[data.snapshots.length - 1];
  return [
    { label: `${data.snapshots.length} 期记录`, attention: data.snapshots.length === 0 },
    { label: latest ? `最近 ${latest.date}` : '尚无数据', attention: !latest },
  ];
}

function strategyChips(data: AppData): Chip[] {
  const latest = data.snapshots[data.snapshots.length - 1];
  const analysis = latest ? analyzeStrategy(latest, data.strategy, data.accounts) : null;
  const range = `${formatPercent(data.strategy.riskAssetMinRatio)}–${formatPercent(data.strategy.riskAssetMaxRatio)}`;
  if (!analysis) {
    return [
      { label: `风险资产 —（区间 ${range}）` },
      { label: '应急备用金暂无数据' },
    ];
  }
  const cashChip: Chip = analysis.cashReserveGap >= 0
    ? { label: '应急备用金已达标' }
    : { label: `应急备用金差额 ${formatMoney(analysis.cashReserveGap)}`, attention: true };
  return [
    { label: `风险资产 ${formatPercent(analysis.riskAssetRatio)}（区间 ${range}）` },
    { label: riskStatusLabel(analysis.riskStatus), attention: analysis.riskStatus !== 'within' },
    cashChip,
  ];
}

function configChips(data: AppData): Chip[] {
  const unclassifiedCount = data.accounts.filter((account) => isUnclassifiedCategory(account.category)).length;
  const chips: Chip[] = [
    { label: `${data.accounts.length} 个账户` },
    { label: `${Object.keys(data.defaultExchangeRates).length} 个币种` },
  ];
  if (unclassifiedCount > 0) chips.push({ label: `${unclassifiedCount} 个待归类`, attention: true });
  return chips;
}

const cardCopy: Array<Omit<ConsoleCard, 'chips'>> = [
  {
    id: 'import',
    title: '导入数据',
    summary: <>默认只导入金额列；<code>占比</code> 列会自动忽略，用网页重算占比。</>,
    expandLabel: '展开导入区',
    collapseLabel: '收起导入区',
  },
  {
    id: 'strategy',
    title: '资产策略',
    summary: '可自定义目标参数，影响仪表盘策略雷达和复盘报告。',
    expandLabel: '展开策略',
    collapseLabel: '收起策略',
  },
  {
    id: 'config',
    title: '账户与汇率配置',
    summary: '按流动性归类账户，并维护默认汇率与历史汇率。',
    expandLabel: '展开配置',
    collapseLabel: '收起配置',
  },
];

export function ControlConsole({
  data,
  activePanel,
  onActivePanelChange,
  children,
}: {
  data: AppData;
  activePanel: ConsolePanelId | null;
  onActivePanelChange: (panel: ConsolePanelId | null) => void;
  children: Record<ConsolePanelId, ReactNode>;
}) {
  const cards: ConsoleCard[] = cardCopy.map((card) => ({
    ...card,
    chips: card.id === 'import' ? importChips(data) : card.id === 'strategy' ? strategyChips(data) : configChips(data),
  }));

  return (
    <div className="control-console">
      <div className="console-cards">
        {cards.map((card) => {
          const open = activePanel === card.id;
          return (
            <section key={card.id} className={`panel console-card${open ? ' active' : ''}`}>
              <div className="console-card-header">
                <div>
                  <h2>{card.title}</h2>
                  <p>{card.summary}</p>
                </div>
                <button
                  type="button"
                  aria-expanded={open}
                  onClick={() => onActivePanelChange(open ? null : card.id)}
                >
                  {open ? card.collapseLabel : card.expandLabel}
                </button>
              </div>
              <div className="console-card-chips">
                {card.chips.map((chip) => (
                  <span key={chip.label} className={`data-health-chip${chip.attention ? ' attention' : ''}`}>{chip.label}</span>
                ))}
              </div>
            </section>
          );
        })}
      </div>
      {cards.map((card) => (
        <div key={card.id} className="console-body panel" hidden={activePanel !== card.id}>
          {children[card.id]}
        </div>
      ))}
    </div>
  );
}
