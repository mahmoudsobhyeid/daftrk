/**
 * KPI Card Component
 *
 * Displays key performance indicators with trend indicators
 */

import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

export interface KPICardProps {
  title: string;
  value: string | number;
  trend?: number; // percentage change
  trendDirection?: 'up' | 'down' | 'neutral';
  icon?: React.ReactNode;
  loading?: boolean;
}

export function KPICard({ title, value, trend, trendDirection = 'neutral', icon, loading }: KPICardProps) {
  const getTrendIcon = () => {
    if (trendDirection === 'up') return <TrendingUp size={16} className="text-success-600" />;
    if (trendDirection === 'down') return <TrendingDown size={16} className="text-error-600" />;
    return <Minus size={16} className="text-secondary-400" />;
  };

  const getTrendColor = () => {
    if (trendDirection === 'up') return 'text-success-600 dark:text-success-400';
    if (trendDirection === 'down') return 'text-error-600 dark:text-error-400';
    return 'text-secondary-600 dark:text-secondary-400';
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-secondary-900 rounded-xl border border-secondary-200 dark:border-secondary-700 p-5 animate-pulse">
        <div className="h-4 bg-secondary-200 dark:bg-secondary-700 rounded w-1/2 mb-3" />
        <div className="h-8 bg-secondary-200 dark:bg-secondary-700 rounded w-3/4" />
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-secondary-900 rounded-xl border border-secondary-200 dark:border-secondary-700 p-5">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <p className="text-sm font-medium text-secondary-600 dark:text-secondary-400">{title}</p>
          <p className="text-2xl font-bold text-secondary-900 dark:text-secondary-100 mt-1">
            {typeof value === 'number' ? value.toLocaleString() : value}
          </p>
        </div>
        {icon && <div className="text-primary-500">{icon}</div>}
      </div>
      {trend !== undefined && (
        <div className={`flex items-center gap-1 text-sm font-medium ${getTrendColor()}`}>
          {getTrendIcon()}
          <span>{Math.abs(trend).toFixed(1)}%</span>
          <span className="text-secondary-400 text-xs">vs last period</span>
        </div>
      )}
    </div>
  );
}
