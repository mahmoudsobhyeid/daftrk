import { type ReactNode, useEffect, useRef } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  footer?: ReactNode;
}

const sizes = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
};

export function Modal({ open, onClose, title, description, children, size = 'md', footer }: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
      const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onCloseRef.current(); };
      window.addEventListener('keydown', onEsc);
      dialogRef.current?.focus();
      return () => {
        document.body.style.overflow = '';
        window.removeEventListener('keydown', onEsc);
      };
    }
  }, [open]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? 'modal-title' : undefined}
      aria-describedby={description ? 'modal-desc' : undefined}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <div
        className="absolute inset-0 bg-secondary-900/40 backdrop-blur-md animate-fade-in-fast"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={dialogRef}
        tabIndex={-1}
        className={`relative w-full ${sizes[size]} max-h-[90vh] overflow-hidden flex flex-col rounded-2xl bg-white dark:bg-secondary-900 shadow-2xl border border-secondary-200 dark:border-secondary-800 animate-scale-in outline-none`}
      >
        {(title || description) && (
          <div className="flex items-start justify-between px-6 py-5 border-b border-secondary-200 dark:border-secondary-800 shrink-0">
            <div>
              {title && <h2 id="modal-title" className="text-lg font-bold text-secondary-800 dark:text-secondary-100">{title}</h2>}
              {description && <p id="modal-desc" className="mt-1 text-sm text-secondary-500 dark:text-secondary-400">{description}</p>}
            </div>
            <button
              onClick={onClose}
              aria-label="Close dialog"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-secondary-400 hover:bg-secondary-100 hover:text-secondary-700 dark:hover:bg-secondary-800 dark:hover:text-secondary-200 transition-colors shrink-0"
            >
              <X size={18} />
            </button>
          </div>
        )}
        <div className="overflow-y-auto p-6 flex-1">{children}</div>
        {footer && (
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-secondary-200 dark:border-secondary-800 bg-secondary-50 dark:bg-secondary-800/50 shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
