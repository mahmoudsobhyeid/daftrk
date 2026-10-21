import { type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

export function Spinner({ size = 20, className = '' }: { size?: number; className?: string }) {
  return <Loader2 size={size} className={`animate-spin text-primary-500 ${className}`} />;
}

export function FullPageLoader({ label }: { label?: string }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-secondary-50 dark:bg-secondary-950">
      <div className="relative">
        <div className="absolute inset-0 rounded-full bg-primary-500/20 animate-ping" />
        <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-600 text-white shadow-primary">
          <Loader2 size={24} className="animate-spin" />
        </div>
      </div>
      {label && <p className="text-sm font-medium text-secondary-500 animate-pulse-soft">{label}</p>}
    </div>
  );
}

export function EmptyState({ icon, title, description, action }: { icon: ReactNode; title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center animate-slide-up">
      <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-secondary-100 to-secondary-200 text-secondary-400 dark:from-secondary-800 dark:to-secondary-700 dark:text-secondary-500">
        {icon}
      </div>
      <h3 className="text-lg font-bold text-secondary-800 dark:text-secondary-100">{title}</h3>
      {description && <p className="mt-2 max-w-sm text-sm text-secondary-500 dark:text-secondary-400 leading-relaxed">{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`skeleton ${className}`} />;
}
