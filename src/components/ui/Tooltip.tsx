import { type ReactNode, useState } from 'react';

interface TooltipProps {
  content: string;
  children: ReactNode;
  side?: 'top' | 'bottom';
}

export function Tooltip({ content, children, side = 'top' }: TooltipProps) {
  const [show, setShow] = useState(false);

  return (
    <div
      className="relative inline-flex"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {children}
      {show && (
        <div
          className={`absolute z-50 whitespace-nowrap rounded-lg bg-secondary-900 px-2.5 py-1.5 text-xs font-medium text-white shadow-lg dark:bg-secondary-700 animate-fade-in-fast pointer-events-none ${
            side === 'top' ? 'bottom-full mb-2 left-1/2 -translate-x-1/2' : 'top-full mt-2 left-1/2 -translate-x-1/2'
          }`}
        >
          {content}
        </div>
      )}
    </div>
  );
}
