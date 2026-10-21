/** Shared utility components used across admin sub-pages */
export function UsageBar({ value, max }: { value: number; max: number | null }) {
  const pct = max ? Math.min(100, Math.round((value / max) * 100)) : 0;
  const color =
    pct >= 90 ? 'bg-danger-500' :
    pct >= 70 ? 'bg-warning-500' :
    'bg-success-500';
  return (
    <div className="flex items-center gap-1.5 flex-1 min-w-[80px]">
      <div className="flex-1 h-1.5 bg-secondary-100 dark:bg-secondary-700 rounded-full overflow-hidden">
        {max
          ? <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
          : <div className="h-full rounded-full bg-primary-300 dark:bg-primary-700/50" style={{ width: '100%' }} />
        }
      </div>
      <span className="text-[10px] text-secondary-400 shrink-0">{value}{max ? `/${max}` : ''}</span>
    </div>
  );
}
