import clsx from 'clsx';
import { ReactNode } from 'react';

interface FilterActionsProps {
  children?: ReactNode;
  onReset?: () => void;
  resetLabel?: string;
  primaryAction?: ReactNode;
  className?: string;
}

export function FilterActions({
  children,
  onReset,
  resetLabel = 'Reset All',
  primaryAction,
  className,
}: FilterActionsProps) {
  return (
    <div className={clsx('space-y-4', className)}>
      {children && <div className="flex flex-col gap-3">{children}</div>}
      {(onReset || primaryAction) && (
        <div className="flex items-center justify-between pt-4 border-t border-rose-100 mt-4">
          {onReset && (
            <button
              type="button"
              onClick={onReset}
              className="text-sm font-medium text-rose-600 hover:text-rose-800 hover:bg-rose-50 px-3 py-2 rounded-lg transition-colors"
            >
              {resetLabel}
            </button>
          )}
          <div className={clsx(onReset ? 'ml-auto' : '')}>{primaryAction}</div>
        </div>
      )}
    </div>
  );
}
