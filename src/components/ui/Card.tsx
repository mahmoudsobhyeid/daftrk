import { type ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
  variant?: 'default' | 'hover' | 'glass';
  icon?: ReactNode;
}

const variantClasses = {
  default: 'card',
  hover: 'card-hover',
  glass: 'card-glass',
};

export function Card({ children, className = '', variant = 'default' }: CardProps) {
  return <div className={`${variantClasses[variant]} ${className}`}>{children}</div>;
}

export function CardHeader({ children, className = '' }: CardProps) {
  return (
    <div className={`flex items-center justify-between px-5 py-4 border-b border-secondary-200 dark:border-secondary-800 ${className}`}>
      {children}
    </div>
  );
}

export function CardBody({ children, className = '' }: CardProps) {
  return <div className={`p-5 ${className}`}>{children}</div>;
}

export function CardTitle({ children, className = '', icon }: CardProps) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {icon && <span className="shrink-0 text-secondary-600 dark:text-secondary-400">{icon}</span>}
      <h3 className="text-base font-semibold text-secondary-800 dark:text-secondary-100">{children}</h3>
    </div>
  );
}

export function CardDescription({ children, className = '' }: CardProps) {
  return <p className={`text-sm text-secondary-500 dark:text-secondary-400 ${className}`}>{children}</p>;
}
