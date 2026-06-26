import { ReactNode } from 'react';
import clsx from 'clsx';

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={clsx(
        'bg-white rounded-2xl',
        'border border-gray-200',
        'hover:border-amber-200/50',
        'transition-all duration-300 ease-out',
        'overflow-hidden',
        className
      )}
    >
      {children}
    </div>
  );
}
