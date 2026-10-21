/**
 * ZATCA Status badges and clearance state components
 */
import { CheckCircle2, Clock, AlertTriangle, XCircle, Send, FileCheck, RefreshCw, Ban } from 'lucide-react';
import type { ZatcaClearanceStatus, ZatcaSubmissionStatus } from '../../lib/zatca/types';

interface ZatcaClearanceBadgeProps {
  status: ZatcaClearanceStatus;
  small?: boolean;
}

const CLEARANCE_CONFIG: Record<ZatcaClearanceStatus, {
  label: string;
  labelAr: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  className: string;
}> = {
  draft: {
    label: 'Draft',
    labelAr: 'مسودة',
    icon: Clock,
    className: 'bg-secondary-100 text-secondary-600 dark:bg-secondary-800 dark:text-secondary-400',
  },
  ready: {
    label: 'Ready',
    labelAr: 'جاهزة',
    icon: FileCheck,
    className: 'bg-accent-50 text-accent-700 dark:bg-accent-900/20 dark:text-accent-400',
  },
  submitted: {
    label: 'Submitted',
    labelAr: 'مُرسلة',
    icon: Send,
    className: 'bg-primary-50 text-primary-700 dark:bg-primary-900/20 dark:text-primary-400',
  },
  cleared: {
    label: 'Cleared',
    labelAr: 'مُخلَّصة',
    icon: CheckCircle2,
    className: 'bg-success-50 text-success-700 dark:bg-success-900/20 dark:text-success-400',
  },
  reported: {
    label: 'Reported',
    labelAr: 'مُبلَّغ عنها',
    icon: CheckCircle2,
    className: 'bg-success-50 text-success-600 dark:bg-success-900/20 dark:text-success-400',
  },
  rejected: {
    label: 'Rejected',
    labelAr: 'مرفوضة',
    icon: XCircle,
    className: 'bg-danger-50 text-danger-700 dark:bg-danger-900/20 dark:text-danger-400',
  },
  cancelled: {
    label: 'Cancelled',
    labelAr: 'ملغاة',
    icon: Ban,
    className: 'bg-secondary-100 text-secondary-500 dark:bg-secondary-800 dark:text-secondary-500',
  },
  expired: {
    label: 'Expired',
    labelAr: 'منتهية',
    icon: AlertTriangle,
    className: 'bg-warning-50 text-warning-700 dark:bg-warning-900/20 dark:text-warning-400',
  },
};

export function ZatcaClearanceBadge({ status, small = false }: ZatcaClearanceBadgeProps) {
  const cfg = CLEARANCE_CONFIG[status] ?? CLEARANCE_CONFIG.draft;
  const Icon = cfg.icon;

  if (small) {
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${cfg.className}`}>
        <Icon size={10} />
        {cfg.label}
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${cfg.className}`}>
      <Icon size={12} />
      {cfg.label}
    </span>
  );
}

interface ZatcaSubmissionBadgeProps {
  status: ZatcaSubmissionStatus;
}

const SUBMISSION_CONFIG: Record<ZatcaSubmissionStatus, {
  label: string;
  className: string;
}> = {
  not_submitted: { label: 'Not Submitted', className: 'text-secondary-400' },
  pending: { label: 'Pending', className: 'text-accent-600 dark:text-accent-400' },
  accepted: { label: 'Accepted', className: 'text-success-600 dark:text-success-400' },
  rejected: { label: 'Rejected', className: 'text-danger-600 dark:text-danger-400' },
  failed: { label: 'Failed', className: 'text-warning-600 dark:text-warning-400' },
};

export function ZatcaSubmissionBadge({ status }: ZatcaSubmissionBadgeProps) {
  const cfg = SUBMISSION_CONFIG[status] ?? SUBMISSION_CONFIG.not_submitted;
  return (
    <span className={`text-xs font-semibold ${cfg.className}`}>{cfg.label}</span>
  );
}

interface ZatcaInfoPanelProps {
  invoice: {
    uuid?: string;
    icv?: number;
    zatca_hash?: string;
    zatca_qr_data?: string;
    zatca_clearance_status?: ZatcaClearanceStatus;
    zatca_submission_status?: ZatcaSubmissionStatus;
    zatca_submission_time?: string;
    zatca_clearance_uuid?: string;
    zatca_response_code?: number;
    zatca_warnings?: unknown[];
    zatca_errors?: unknown[];
    is_locked?: boolean;
  };
  onRegenerate?: () => void;
  onDownloadXml?: () => void;
  regenerating?: boolean;
}

export function ZatcaInfoPanel({ invoice, onRegenerate, onDownloadXml, regenerating }: ZatcaInfoPanelProps) {
  const clearanceStatus = invoice.zatca_clearance_status ?? 'draft';
  const submissionStatus = invoice.zatca_submission_status ?? 'not_submitted';

  return (
    <div className="rounded-xl border border-secondary-200 dark:border-secondary-700 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-secondary-50 dark:bg-secondary-800/50 border-b border-secondary-200 dark:border-secondary-700">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-secondary-500 dark:text-secondary-400">
            ZATCA Status
          </span>
          <ZatcaClearanceBadge status={clearanceStatus} small />
        </div>
        <div className="flex items-center gap-2">
          {onDownloadXml && invoice.zatca_xml !== undefined && (
            <button
              onClick={onDownloadXml}
              className="text-xs font-semibold text-primary-600 dark:text-primary-400 hover:underline"
            >
              XML
            </button>
          )}
          {onRegenerate && (
            <button
              onClick={onRegenerate}
              disabled={regenerating}
              className="flex items-center gap-1 text-xs font-semibold text-secondary-500 hover:text-secondary-700 dark:hover:text-secondary-300 transition-colors disabled:opacity-50"
            >
              <RefreshCw size={12} className={regenerating ? 'animate-spin' : ''} />
              Regenerate
            </button>
          )}
        </div>
      </div>

      {/* Fields */}
      <div className="px-4 py-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
        <div>
          <span className="text-secondary-400 block">Invoice UUID</span>
          <span className="font-mono text-secondary-700 dark:text-secondary-300 break-all">
            {invoice.uuid ? invoice.uuid.slice(0, 18) + '...' : '—'}
          </span>
        </div>
        <div>
          <span className="text-secondary-400 block">ICV</span>
          <span className="font-semibold text-secondary-700 dark:text-secondary-300">
            {invoice.icv ?? '—'}
          </span>
        </div>
        <div>
          <span className="text-secondary-400 block">Submission</span>
          <ZatcaSubmissionBadge status={submissionStatus} />
        </div>
        <div>
          <span className="text-secondary-400 block">Locked</span>
          <span className={`font-semibold ${invoice.is_locked ? 'text-success-600 dark:text-success-400' : 'text-secondary-400'}`}>
            {invoice.is_locked ? 'Yes' : 'No'}
          </span>
        </div>
        {invoice.zatca_hash && (
          <div className="col-span-2">
            <span className="text-secondary-400 block">Invoice Hash</span>
            <span className="font-mono text-secondary-600 dark:text-secondary-400 break-all text-[10px]">
              {invoice.zatca_hash}
            </span>
          </div>
        )}
        {invoice.zatca_submission_time && (
          <div className="col-span-2">
            <span className="text-secondary-400 block">Submitted At</span>
            <span className="text-secondary-700 dark:text-secondary-300">
              {new Date(invoice.zatca_submission_time).toLocaleString()}
            </span>
          </div>
        )}
        {invoice.zatca_errors && (invoice.zatca_errors as unknown[]).length > 0 && (
          <div className="col-span-2">
            <span className="text-danger-500 font-semibold block mb-1">ZATCA Errors</span>
            <ul className="space-y-0.5">
              {(invoice.zatca_errors as string[]).map((e, i) => (
                <li key={i} className="text-danger-600 dark:text-danger-400">{e}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
