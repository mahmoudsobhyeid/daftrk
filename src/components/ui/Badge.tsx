import { type ReactNode } from 'react';

type BadgeVariant = 'primary' | 'secondary' | 'accent' | 'success' | 'warning' | 'danger' | 'neutral';

interface BadgeProps {
  variant?: BadgeVariant;
  children: ReactNode;
  dot?: boolean;
  className?: string;
}

const variants: Record<BadgeVariant, string> = {
  primary: 'bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300',
  secondary: 'bg-secondary-100 text-secondary-600 dark:bg-secondary-800 dark:text-secondary-300',
  accent: 'bg-accent-50 text-accent-700 dark:bg-accent-900/30 dark:text-accent-300',
  success: 'bg-success-50 text-success-700 dark:bg-success-900/30 dark:text-success-300',
  warning: 'bg-warning-50 text-warning-700 dark:bg-warning-900/30 dark:text-warning-300',
  danger: 'bg-danger-50 text-danger-700 dark:bg-danger-900/30 dark:text-danger-300',
  neutral: 'bg-secondary-100 text-secondary-500 dark:bg-secondary-800 dark:text-secondary-400',
};

const dotColors: Record<BadgeVariant, string> = {
  primary: 'bg-primary-500',
  secondary: 'bg-secondary-400',
  accent: 'bg-accent-500',
  success: 'bg-success-500',
  warning: 'bg-warning-500',
  danger: 'bg-danger-500',
  neutral: 'bg-secondary-400',
};

export function Badge({ variant = 'neutral', children, dot = false, className = '' }: BadgeProps) {
  return (
    <span className={`badge ${variants[variant]} ${className}`}>
      {dot && <span className={`badge-dot ${dotColors[variant]}`} />}
      {children}
    </span>
  );
}
