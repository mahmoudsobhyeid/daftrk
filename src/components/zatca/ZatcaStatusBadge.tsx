/**
 * ZATCA Status Badge Component
 *
 * Displays ZATCA clearance and submission status on invoice views:
 * - Invoice List: Shows quick status indicator
 * - Invoice Details: Shows full status with details
 * - Color-coded badges for easy identification
 * - Error messages with troubleshooting hints
 */

import { CheckCircle, AlertCircle, Clock, XCircle, AlertTriangle } from 'lucide-react';
import type { ZatcaClearanceStatus, ZatcaSubmissionStatus } from '../../lib/zatca/types';

export interface ZatcaStatusBadgeProps {
  clearanceStatus?: ZatcaClearanceStatus;
  submissionStatus?: ZatcaSubmissionStatus;
  errors?: string[];
  warnings?: string[];
  compact?: boolean;
  showDetails?: boolean;
}

const CLEARANCE_LABELS: Record<ZatcaClearanceStatus, { label: string; color: string; icon: typeof CheckCircle }> = {
  draft: { label: 'Draft', color: 'secondary', icon: Clock },
  ready: { label: 'Ready', color: 'accent', icon: Clock },
  submitted: { label: 'Submitted', color: 'accent', icon: Clock },
  cleared: { label: 'Cleared', color: 'success', icon: CheckCircle },
  reported: { label: 'Reported', color: 'success', icon: CheckCircle },
  rejected: { label: 'Rejected', color: 'error', icon: XCircle },
  cancelled: { label: 'Cancelled', color: 'secondary', icon: AlertCircle },
  expired: { label: 'Expired', color: 'error', icon: XCircle },
};

const SUBMISSION_LABELS: Record<ZatcaSubmissionStatus, { label: string; color: string }> = {
  not_submitted: { label: 'Not Submitted', color: 'secondary' },
  pending: { label: 'Pending', color: 'accent' },
  accepted: { label: 'Accepted', color: 'success' },
  rejected: { label: 'Rejected', color: 'error' },
  failed: { label: 'Failed', color: 'error' },
};

export function ZatcaStatusBadge({
  clearanceStatus = 'draft',
  submissionStatus = 'not_submitted',
  errors = [],
  warnings = [],
  compact = false,
  showDetails = false,
}: ZatcaStatusBadgeProps) {
  const clearanceInfo = CLEARANCE_LABELS[clearanceStatus];
  const submissionInfo = SUBMISSION_LABELS[submissionStatus];
  const ClearanceIcon = clearanceInfo.icon;

  const colorClasses = {
    success: 'bg-success-50 text-success-700 border-success-200 dark:bg-success-900/20 dark:text-success-300 dark:border-success-800',
    error: 'bg-error-50 text-error-700 border-error-200 dark:bg-error-900/20 dark:text-error-300 dark:border-error-800',
    warning: 'bg-warning-50 text-warning-700 border-warning-200 dark:bg-warning-900/20 dark:text-warning-300 dark:border-warning-800',
    accent: 'bg-accent-50 text-accent-700 border-accent-200 dark:bg-accent-900/20 dark:text-accent-300 dark:border-accent-800',
    secondary: 'bg-secondary-50 text-secondary-700 border-secondary-200 dark:bg-secondary-900/20 dark:text-secondary-300 dark:border-secondary-800',
  };

  const hasErrors = errors.length > 0;
  const hasWarnings = warnings.length > 0;

  if (compact) {
    return (
      <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${colorClasses[clearanceInfo.color as keyof typeof colorClasses]}`}>
        <ClearanceIcon size={12} />
        <span>{clearanceInfo.label}</span>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Clearance Status */}
      <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border ${colorClasses[clearanceInfo.color as keyof typeof colorClasses]}`}>
        <ClearanceIcon size={16} />
        <span>{clearanceInfo.label}</span>
        {submissionStatus !== 'not_submitted' && (
          <span className="text-xs opacity-75">• {submissionInfo.label}</span>
        )}
      </div>

      {/* Warnings */}
      {hasWarnings && showDetails && (
        <div className="p-3 rounded-lg bg-warning-50 dark:bg-warning-900/10 border border-warning-200 dark:border-warning-800">
          <div className="flex items-start gap-2">
            <AlertTriangle size={16} className="text-warning-600 dark:text-warning-400 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-warning-700 dark:text-warning-300 mb-1">Warnings</p>
              <ul className="text-xs text-warning-600 dark:text-warning-400 space-y-1">
                {warnings.map((warning, idx) => (
                  <li key={idx}>• {warning}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Errors */}
      {hasErrors && showDetails && (
        <div className="p-3 rounded-lg bg-error-50 dark:bg-error-900/10 border border-error-200 dark:border-error-800">
          <div className="flex items-start gap-2">
            <XCircle size={16} className="text-error-600 dark:text-error-400 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-error-700 dark:text-error-300 mb-1">Errors</p>
              <ul className="text-xs text-error-600 dark:text-error-400 space-y-1">
                {errors.map((error, idx) => (
                  <li key={idx}>• {error}</li>
                ))}
              </ul>
              <p className="text-xs text-error-500 dark:text-error-500 mt-2">
                Please check your ZATCA settings and try again. If the issue persists, contact support.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Troubleshooting for rejected status */}
      {clearanceStatus === 'rejected' && showDetails && !hasErrors && (
        <div className="p-3 rounded-lg bg-error-50 dark:bg-error-900/10 border border-error-200 dark:border-error-800">
          <div className="flex items-start gap-2">
            <AlertCircle size={16} className="text-error-600 dark:text-error-400 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-error-700 dark:text-error-300 mb-1">Submission Rejected</p>
              <p className="text-xs text-error-600 dark:text-error-400">
                The invoice was rejected by ZATCA. Please verify that all required fields are complete and valid, then resubmit.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Mini status indicator for invoice list tables
 */
export function ZatcaStatusMini({
  clearanceStatus = 'draft',
}: Pick<ZatcaStatusBadgeProps, 'clearanceStatus'>) {
  const clearanceInfo = CLEARANCE_LABELS[clearanceStatus];
  const ClearanceIcon = clearanceInfo.icon;

  const colorClasses = {
    success: 'text-success-600 dark:text-success-400',
    error: 'text-error-600 dark:text-error-400',
    warning: 'text-warning-600 dark:text-warning-400',
    accent: 'text-accent-600 dark:text-accent-400',
    secondary: 'text-secondary-600 dark:text-secondary-400',
  };

  return (
    <div className={`flex items-center gap-1.5 ${colorClasses[clearanceInfo.color as keyof typeof colorClasses]}`}>
      <ClearanceIcon size={14} />
      <span className="text-xs font-medium">{clearanceInfo.label}</span>
    </div>
  );
}
