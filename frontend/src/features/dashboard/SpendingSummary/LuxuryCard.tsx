import { ReactNode } from 'react';
import clsx from 'clsx';

interface LuxuryCardProps {
  children: ReactNode;
  className?: string;
}

export function LuxuryCard({ children, className }: LuxuryCardProps) {
  return (
    <div
      className={clsx(
        'bg-white rounded-2xl p-5 sm:p-6',
        'border border-gray-900/10',
        'transition-all duration-300 ease-out',
        className
      )}
    >
      {children}
    </div>
  );
}
