import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { AlertTriangle } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
}

export function ConfirmDialog({ open, onClose, onConfirm, title, message, confirmLabel, danger = true }: ConfirmDialogProps) {
  const { t } = useLanguage();
  return (
    <Modal open={open} onClose={onClose} size="sm">
      <div className="flex flex-col items-center text-center">
        <div className={`mb-5 flex h-14 w-14 items-center justify-center rounded-2xl ${
          danger
            ? 'bg-danger-50 text-danger-600 dark:bg-danger-900/30 dark:text-danger-400'
            : 'bg-warning-50 text-warning-600 dark:bg-warning-900/30 dark:text-warning-400'
        }`}>
          <AlertTriangle size={26} />
        </div>
        <h2 className="text-lg font-bold text-secondary-800 dark:text-secondary-100">{title}</h2>
        <p className="mt-2 text-sm text-secondary-500 dark:text-secondary-400 leading-relaxed max-w-sm">{message}</p>
        <div className="mt-7 flex w-full gap-3">
          <Button variant="secondary" className="flex-1" onClick={onClose}>{t('common.cancel')}</Button>
          <Button variant={danger ? 'danger' : 'primary'} className="flex-1" onClick={() => { onConfirm(); onClose(); }}>
            {confirmLabel ?? t('common.confirm')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
