import { ReactNode } from 'react';
import clsx from 'clsx';

export function Table({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={clsx('bg-white rounded-lg overflow-hidden', className)}>
      {children}
    </div>
  );
}
