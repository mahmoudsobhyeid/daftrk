import { type ReactNode } from 'react';

interface TableProps {
  children: ReactNode;
  className?: string;
}

export function Table({ children, className = '' }: TableProps) {
  return (
    <div className="overflow-x-auto">
      <table className={`w-full text-sm ${className}`}>{children}</table>
    </div>
  );
}

export function TableHead({ children }: TableProps) {
  return (
    <thead>
      <tr className="border-b border-secondary-200 dark:border-secondary-800 bg-secondary-50 dark:bg-secondary-800/50">
        {children}
      </tr>
    </thead>
  );
}

export function TableBody({ children }: TableProps) {
  return <tbody className="divide-y divide-secondary-100 dark:divide-secondary-800">{children}</tbody>;
}

export function TableRow({ children, onClick, className = '' }: TableProps & { onClick?: () => void }) {
  return (
    <tr
      onClick={onClick}
      className={`transition-colors duration-150 hover:bg-secondary-50/70 dark:hover:bg-secondary-800/40 ${onClick ? 'cursor-pointer' : ''} ${className}`}
    >
      {children}
    </tr>
  );
}

export function Th({ children, className = '' }: TableProps) {
  return (
    <th className={`text-start px-4 py-3 text-xs font-semibold uppercase tracking-wider text-secondary-500 dark:text-secondary-400 ${className}`}>
      {children}
    </th>
  );
}

export function Td({ children, className = '', onClick }: TableProps & { onClick?: (e: React.MouseEvent<HTMLTableCellElement>) => void }) {
  return (
    <td onClick={onClick} className={`px-4 py-3.5 text-secondary-700 dark:text-secondary-300 ${className}`}>
      {children}
    </td>
  );
}
