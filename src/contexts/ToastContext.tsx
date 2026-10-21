import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { CheckCircle, XCircle, AlertCircle, AlertTriangle, X } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  toast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((message: string, type: ToastType = 'success') => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  }, []);

  const remove = (id: string) => setToasts((prev) => prev.filter((t) => t.id !== id));

  const icons = { success: CheckCircle, error: XCircle, info: AlertCircle, warning: AlertTriangle };
  const styles = {
    success: {
      bg: 'bg-white dark:bg-secondary-900',
      border: 'border-success-200 dark:border-success-800/50',
      icon: 'text-success-500',
      text: 'text-secondary-800 dark:text-secondary-100',
    },
    error: {
      bg: 'bg-white dark:bg-secondary-900',
      border: 'border-danger-200 dark:border-danger-800/50',
      icon: 'text-danger-500',
      text: 'text-secondary-800 dark:text-secondary-100',
    },
    info: {
      bg: 'bg-white dark:bg-secondary-900',
      border: 'border-accent-200 dark:border-accent-800/50',
      icon: 'text-accent-500',
      text: 'text-secondary-800 dark:text-secondary-100',
    },
    warning: {
      bg: 'bg-white dark:bg-secondary-900',
      border: 'border-warning-200 dark:border-warning-800/50',
      icon: 'text-warning-500',
      text: 'text-secondary-800 dark:text-secondary-100',
    },
  };

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed top-4 end-4 z-[999] flex flex-col gap-2.5 max-w-sm w-full pointer-events-none">
        {toasts.map((t) => {
          const Icon = icons[t.type];
          const s = styles[t.type];
          return (
            <div
              key={t.id}
              className={`pointer-events-auto flex items-start gap-3 rounded-xl border ${s.bg} ${s.border} px-4 py-3.5 shadow-lg animate-slide-up`}
            >
              <Icon size={18} className={`mt-0.5 shrink-0 ${s.icon}`} />
              <span className={`flex-1 text-sm font-medium ${s.text}`}>{t.message}</span>
              <button onClick={() => remove(t.id)} className="shrink-0 text-secondary-400 hover:text-secondary-600 dark:hover:text-secondary-200 transition-colors">
                <X size={15} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
