import { isIsoDate } from '../lib/dates';

export type SnapshotDateDialogChoice = 'overwrite' | 'keep' | 'none';

export function SnapshotDateDialog({
  title,
  description,
  date,
  existingCount,
  error,
  confirmLabel = '确认',
  onDateChange,
  onConfirm,
  onCancel,
}: {
  title: string;
  description?: string;
  date: string;
  existingCount: number;
  error?: string;
  confirmLabel?: string;
  onDateChange: (date: string) => void;
  onConfirm: (choice: SnapshotDateDialogChoice) => void;
  onCancel: () => void;
}) {
  const hasConflict = existingCount > 0 && isIsoDate(date);

  return (
    <div className="date-dialog-backdrop" role="dialog" aria-modal="true" aria-labelledby="date-dialog-title">
      <div className="date-dialog">
        <h3 id="date-dialog-title">{title}</h3>
        {description ? <p>{description}</p> : null}
        <label>日期
          <input aria-label="快照日期" type="date" value={date} onChange={(event) => onDateChange(event.target.value)} />
        </label>
        {hasConflict ? <p className="warning-text">已有 {date} 的记录（{existingCount} 条）。请选择处理方式。</p> : null}
        {error ? <p className="danger-text">{error}</p> : null}
        <div className="toolbar compact-toolbar">
          {hasConflict ? (
            <>
              <button className="primary" onClick={() => onConfirm('overwrite')}>覆盖已有记录</button>
              <button onClick={() => onConfirm('keep')}>保留同日记录</button>
            </>
          ) : (
            <button className="primary" onClick={() => onConfirm('none')}>{confirmLabel}</button>
          )}
          <button onClick={onCancel}>取消</button>
        </div>
      </div>
    </div>
  );
}
