import type { InvoiceStatus } from '../../lib/types';
import { useLanguage } from '../../contexts/LanguageContext';

const statusConfig: Record<InvoiceStatus, { dot: string; badge: string }> = {
  draft: {
    dot: 'bg-secondary-400',
    badge: 'bg-secondary-100 text-secondary-600 dark:bg-secondary-800 dark:text-secondary-300',
  },
  sent: {
    dot: 'bg-accent-500',
    badge: 'bg-accent-50 text-accent-700 dark:bg-accent-900/30 dark:text-accent-300',
  },
  paid: {
    dot: 'bg-success-500',
    badge: 'bg-success-50 text-success-700 dark:bg-success-900/30 dark:text-success-300',
  },
  overdue: {
    dot: 'bg-danger-500',
    badge: 'bg-danger-50 text-danger-700 dark:bg-danger-900/30 dark:text-danger-300',
  },
  cancelled: {
    dot: 'bg-warning-500',
    badge: 'bg-warning-50 text-warning-700 dark:bg-warning-900/30 dark:text-warning-300',
  },
};

export function StatusBadge({ status }: { status: InvoiceStatus }) {
  const { t } = useLanguage();
  const config = statusConfig[status];
  return (
    <span className={`badge ${config.badge}`}>
      <span className={`badge-dot ${config.dot}`} />
      {t(`status.${status}`)}
    </span>
  );
}
