import { useId } from 'react';

/** ── Area / Line Chart ─────────────────────────────── */
export interface ChartPoint {
  label: string;
  value: number;
}

interface AreaChartProps {
  data: ChartPoint[];
  color?: string;
  fillOpacity?: number;
  height?: number;
  showDots?: boolean;
  showLabels?: boolean;
  formatValue?: (v: number) => string;
}

export function AreaChart({
  data,
  color = '#3b82f6',
  fillOpacity = 0.18,
  height = 80,
  showDots = true,
  showLabels = false,
  formatValue = (v) => String(v),
}: AreaChartProps) {
  const id = useId().replace(/:/g, '');
  if (!data.length) return null;

  const W = 400, H = height;
  const PAD_X = 4, PAD_Y = 6;
  const plotW = W - PAD_X * 2;
  const plotH = H - PAD_Y * 2 - (showLabels ? 16 : 0);
  const max = Math.max(...data.map((d) => d.value), 1);
  const min = 0;
  const range = max - min || 1;

  const pts = data.map((d, i) => ({
    x: PAD_X + (i / Math.max(data.length - 1, 1)) * plotW,
    y: PAD_Y + plotH - ((d.value - min) / range) * plotH,
    value: d.value,
    label: d.label,
  }));

  const lineD = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const areaD = `${lineD} L${pts[pts.length - 1].x.toFixed(1)},${(PAD_Y + plotH).toFixed(1)} L${pts[0].x.toFixed(1)},${(PAD_Y + plotH).toFixed(1)} Z`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="none">
      <defs>
        <linearGradient id={`ag-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={fillOpacity * 2} />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaD} fill={`url(#ag-${id})`} />
      <path d={lineD} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {showDots && pts.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="3" fill={color} opacity="0.9" />
      ))}
      {showLabels && pts.map((p, i) => (
        <text key={i} x={p.x} y={H - 2} textAnchor="middle" fontSize="9" fill="currentColor" opacity="0.4">
          {p.label}
        </text>
      ))}
    </svg>
  );
}

/** ── Horizontal Bar Chart ───────────────────────────── */
export interface BarItem {
  label: string;
  value: number;
  color: string;
}

export function HorizBarChart({ data, formatValue = (v) => String(v) }: { data: BarItem[]; formatValue?: (v: number) => string }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="space-y-2.5">
      {data.map((item, i) => (
        <div key={i}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold text-secondary-600 dark:text-secondary-400 capitalize">{item.label.replace('_', ' ')}</span>
            <span className="text-xs font-bold text-secondary-700 dark:text-secondary-200">{formatValue(item.value)}</span>
          </div>
          <div className="h-2 bg-secondary-100 dark:bg-secondary-700 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{ width: `${(item.value / max) * 100}%`, backgroundColor: item.color }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

/** ── Donut Chart ─────────────────────────────────────── */
export function DonutChart({
  data,
  size = 120,
  innerLabel,
}: {
  data: BarItem[];
  size?: number;
  innerLabel?: string;
}) {
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  const r = 40, cx = 60, cy = 60;
  const circumference = 2 * Math.PI * r;
  let cumulative = 0;

  const segments = data.map((d) => {
    const dashLen = (d.value / total) * circumference;
    const offset = circumference * 0.25 - cumulative;
    cumulative += dashLen;
    return { ...d, dashLen, offset };
  });

  return (
    <svg viewBox="0 0 120 120" width={size} height={size} className="shrink-0">
      {segments.map((seg, i) => (
        <circle
          key={i}
          cx={cx} cy={cy} r={r}
          fill="none"
          stroke={seg.color}
          strokeWidth="18"
          strokeDasharray={`${seg.dashLen.toFixed(2)} ${(circumference - seg.dashLen).toFixed(2)}`}
          strokeDashoffset={seg.offset.toFixed(2)}
          transform="rotate(-90 60 60)"
          strokeLinecap="butt"
        />
      ))}
      {innerLabel && (
        <text x={cx} y={cy + 5} textAnchor="middle" fontSize="13" fontWeight="700" fill="currentColor">
          {innerLabel}
        </text>
      )}
    </svg>
  );
}

/** ── Sparkline (tiny inline chart) ─────────────────── */
export function Sparkline({ data, color = '#3b82f6', width = 80, height = 28 }: {
  data: number[];
  color?: string;
  width?: number;
  height?: number;
}) {
  if (data.length < 2) return null;
  const max = Math.max(...data, 1);
  const pts = data.map((v, i) => ({
    x: (i / (data.length - 1)) * width,
    y: height - (v / max) * height + 1,
  }));
  const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height}>
      <path d={d} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
