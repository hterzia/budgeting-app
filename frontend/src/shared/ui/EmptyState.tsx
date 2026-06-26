import { ReactNode } from 'react';
import clsx from 'clsx';

export function EmptyState({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={clsx('text-center text-gray-500 p-6', className)}>
      <p className="text-lg font-semibold text-gray-700">{title}</p>
      {description && <p className="mt-1 text-sm">{description}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
