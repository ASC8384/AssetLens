import { useEffect, useId, useRef, useState, type ReactElement, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ResponsiveContainer } from 'recharts';

export type ChartLegendItem = {
  key: string;
  label: string;
  color: string;
  detail?: string;
};

export type ChartRenderContext = {
  expanded: boolean;
  isVisible: (key: string) => boolean;
};

type ChartCardProps = {
  title: string;
  expandedTitle?: string;
  className?: string;
  height: number;
  legend?: ChartLegendItem[];
  /** 有值时用这段说明代替图表，并禁用放大。 */
  emptyMessage?: string;
  expandedHint?: string;
  footer?: ReactNode;
  children: (context: ChartRenderContext) => ReactElement;
};

export function ChartCard({ title, expandedTitle, className = '', height, legend = [], emptyMessage, expandedHint, footer, children }: ChartCardProps) {
  const [hiddenKeys, setHiddenKeys] = useState<ReadonlySet<string>>(() => new Set());
  const [expanded, setExpanded] = useState(false);
  const expandButtonRef = useRef<HTMLButtonElement>(null);
  const isVisible = (key: string) => !hiddenKeys.has(key);
  const allHidden = legend.length > 0 && legend.every((item) => hiddenKeys.has(item.key));

  function toggle(key: string) {
    setHiddenKeys((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function closeExpanded() {
    setExpanded(false);
    expandButtonRef.current?.focus();
  }

  function renderBody(isExpanded: boolean, chartHeight: number) {
    return (
      <>
        {legend.length > 0 && !emptyMessage ? <ChartLegend items={legend} hiddenKeys={hiddenKeys} onToggle={toggle} onReset={() => setHiddenKeys(new Set())} /> : null}
        {emptyMessage ? (
          <div className="chart-placeholder" style={{ height: chartHeight }}>{emptyMessage}</div>
        ) : allHidden ? (
          <div className="chart-placeholder" style={{ height: chartHeight }}>图例里的项目都已隐藏，点「全部显示」恢复。</div>
        ) : (
          <ResponsiveContainer width="100%" height={chartHeight}>{children({ expanded: isExpanded, isVisible })}</ResponsiveContainer>
        )}
        {footer}
      </>
    );
  }

  return (
    <div className={`chart-card ${className}`}>
      <div className="chart-card-header">
        <h3>{title}</h3>
        <button ref={expandButtonRef} type="button" className="chart-expand-button" disabled={Boolean(emptyMessage)} aria-label={`放大查看：${title}`} title="放大查看" onClick={() => setExpanded(true)}>
          <ExpandIcon />
          放大
        </button>
      </div>
      {renderBody(false, height)}
      {expanded ? (
        <ChartDialog title={expandedTitle ?? title} hint={expandedHint} onClose={closeExpanded}>
          {(chartHeight) => renderBody(true, chartHeight)}
        </ChartDialog>
      ) : null}
    </div>
  );
}

function ChartLegend({ items, hiddenKeys, onToggle, onReset }: {
  items: ChartLegendItem[];
  hiddenKeys: ReadonlySet<string>;
  onToggle: (key: string) => void;
  onReset: () => void;
}) {
  const hiddenCount = items.filter((item) => hiddenKeys.has(item.key)).length;
  return (
    <div className="chart-legend" role="group" aria-label="图例，点击可暂时隐藏">
      {items.map((item) => {
        const visible = !hiddenKeys.has(item.key);
        return (
          <button
            key={item.key}
            type="button"
            className={visible ? 'chart-legend-item' : 'chart-legend-item is-off'}
            aria-pressed={visible}
            title={visible ? '点击暂时隐藏' : '点击重新显示'}
            onClick={() => onToggle(item.key)}
          >
            <i style={{ background: visible ? item.color : 'transparent', borderColor: item.color }} />
            <span>{item.label}</span>
            {item.detail ? <small>{item.detail}</small> : null}
          </button>
        );
      })}
      {hiddenCount > 0 ? <button type="button" className="link-button chart-legend-reset" onClick={onReset}>全部显示（已隐藏 {hiddenCount} 项）</button> : null}
    </div>
  );
}

function ChartDialog({ title, hint, onClose, children }: {
  title: string;
  hint?: string;
  onClose: () => void;
  children: (chartHeight: number) => ReactNode;
}) {
  const titleId = useId();
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const chartHeight = useExpandedChartHeight();
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    closeButtonRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onCloseRef.current();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // 卡片带 backdrop-filter，会让 fixed 定位相对卡片而不是视口，所以挂到 body 上。
  return createPortal(
    <div className="chart-dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="chart-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <div className="chart-dialog-header">
          <div>
            <h3 id={titleId}>{title}</h3>
            <p>{hint ? `${hint} · ` : ''}点击图例可暂时隐藏，按 Esc 关闭。</p>
          </div>
          <button ref={closeButtonRef} type="button" onClick={onClose}>关闭</button>
        </div>
        {children(chartHeight)}
      </div>
    </div>,
    document.body,
  );
}

function useExpandedChartHeight(): number {
  const measure = () => Math.round(Math.min(760, Math.max(360, window.innerHeight - 300)));
  const [height, setHeight] = useState(measure);
  useEffect(() => {
    const handleResize = () => setHeight(measure());
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  return height;
}

function ExpandIcon() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false">
      <path d="M2 6V2h4M14 6V2h-4M2 10v4h4M14 10v4h-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
