/**
 * Report Controls Component
 *
 * Provides standard controls for all reports:
 * - Date filters (Today, This Week, This Month, Custom Range)
 * - Export options (PDF, Excel/CSV)
 * - Search
 * - Column sorting
 */

import { useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { Calendar, Download, Search, Filter } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Input';

export interface DateRange {
  startDate?: string;
  endDate?: string;
}

export interface ReportControlsProps {
  onDateRangeChange: (range: DateRange) => void;
  onExport?: (format: 'pdf' | 'excel' | 'csv') => void;
  onSearch?: (query: string) => void;
  showDateFilter?: boolean;
  showExport?: boolean;
  showSearch?: boolean;
  loading?: boolean;
}

export function ReportControls({
  onDateRangeChange,
  onExport,
  onSearch,
  showDateFilter = true,
  showExport = true,
  showSearch = true,
  loading = false,
}: ReportControlsProps) {
  const { t } = useLanguage();
  const [datePreset, setDatePreset] = useState<'today' | 'this_week' | 'this_month' | 'custom'>('this_month');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const handleDatePresetChange = (preset: 'today' | 'this_week' | 'this_month' | 'custom') => {
    setDatePreset(preset);
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    
    let range: DateRange = {};
    
    switch (preset) {
      case 'today':
        range = { startDate: today, endDate: today };
        break;
      case 'this_week': {
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - now.getDay());
        range = { startDate: weekStart.toISOString().split('T')[0], endDate: today };
        break;
      }
      case 'this_month': {
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        range = { startDate: monthStart.toISOString().split('T')[0], endDate: today };
        break;
      }
      case 'custom':
        if (customStartDate) range.startDate = customStartDate;
        if (customEndDate) range.endDate = customEndDate;
        break;
    }
    
    onDateRangeChange(range);
  };

  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
    if (onSearch) onSearch(query);
  };

  return (
    <div className="flex flex-wrap items-center gap-3 p-4 bg-white dark:bg-secondary-900 rounded-xl border border-secondary-200 dark:border-secondary-700">
      {/* Date Filter */}
      {showDateFilter && (
        <div className="flex items-center gap-2">
          <Calendar size={16} className="text-secondary-400" />
          <Select
            value={datePreset}
            onChange={(e) => handleDatePresetChange(e.target.value as any)}
            options={[
              { value: 'today', label: t('reports.today') || 'Today' },
              { value: 'this_week', label: t('reports.thisWeek') || 'This Week' },
              { value: 'this_month', label: t('reports.thisMonth') || 'This Month' },
              { value: 'custom', label: t('reports.custom') || 'Custom' },
            ]}
            className="w-32"
          />
          {datePreset === 'custom' && (
            <>
              <Input
                type="date"
                value={customStartDate}
                onChange={(e) => {
                  setCustomStartDate(e.target.value);
                  handleDatePresetChange('custom');
                }}
                className="w-36"
              />
              <Input
                type="date"
                value={customEndDate}
                onChange={(e) => {
                  setCustomEndDate(e.target.value);
                  handleDatePresetChange('custom');
                }}
                className="w-36"
              />
            </>
          )}
        </div>
      )}

      {/* Search */}
      {showSearch && (
        <div className="flex items-center gap-2 flex-1 min-w-[200px]">
          <Search size={16} className="text-secondary-400" />
          <Input
            placeholder={t('reports.search') || 'Search...'}
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="flex-1"
          />
        </div>
      )}

      {/* Export */}
      {showExport && onExport && (
        <div className="flex items-center gap-2">
          <Filter size={16} className="text-secondary-400" />
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onExport('pdf')}
            disabled={loading}
          >
            <Download size={14} />
            PDF
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onExport('excel')}
            disabled={loading}
          >
            <Download size={14} />
            Excel
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onExport('csv')}
            disabled={loading}
          >
            <Download size={14} />
            CSV
          </Button>
        </div>
      )}
    </div>
  );
}
