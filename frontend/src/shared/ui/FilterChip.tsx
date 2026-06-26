import clsx from 'clsx';
import { useCallback } from 'react';

interface FilterChipProps {
  label: string;
  selected: boolean;
  onClick: () => void;
  onRemove?: () => void;
  icon?: React.ReactNode;
  color?: 'rose' | 'teal' | 'amber' | 'violet' | 'blue' | 'slate';
  size?: 'sm' | 'md';
  className?: string;
}

const colorStyles = {
  rose: 'bg-rose-50 text-rose-700 hover:bg-rose-100 border-rose-200',
  teal: 'bg-teal-50 text-teal-700 hover:bg-teal-100 border-teal-200',
  amber: 'bg-amber-50 text-amber-700 hover:bg-amber-100 border-amber-200',
  violet: 'bg-violet-50 text-violet-700 hover:bg-violet-100 border-violet-200',
  blue: 'bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200',
  slate: 'bg-slate-50 text-slate-700 hover:bg-slate-100 border-slate-200',
};

const selectedStyles = {
  rose: 'bg-rose-600 text-white border-rose-700 hover:bg-rose-700',
  teal: 'bg-teal-600 text-white border-teal-700 hover:bg-teal-700',
  amber: 'bg-amber-600 text-white border-amber-700 hover:bg-amber-700',
  violet: 'bg-violet-600 text-white border-violet-700 hover:bg-violet-700',
  blue: 'bg-blue-600 text-white border-blue-700 hover:bg-blue-700',
  slate: 'bg-slate-700 text-white border-slate-800 hover:bg-slate-800',
};

export function FilterChip({
  label,
  selected,
  onClick,
  onRemove,
  icon,
  color = 'slate',
  size = 'md',
  className,
}: FilterChipProps) {
  const handleRemove = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onRemove?.();
    },
    [onRemove]
  );

  const sizeClasses = {
    sm: 'px-2.5 py-1 text-xs',
    md: 'px-3.5 py-1.5 text-sm',
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        'inline-flex items-center gap-2 rounded-full border transition-all duration-200 ease-out',
        'focus:outline-none focus:ring-2 focus:ring-offset-1',
        selected ? selectedStyles[color] : colorStyles[color],
        sizeClasses[size],
        className
      )}
    >
      {icon && <span className={selected ? '' : 'opacity-80'}>{icon}</span>}
      <span className="font-medium">{label}</span>
      {onRemove && (
        <span
          onClick={handleRemove}
          className={clsx(
            'ml-1 rounded-full p-0.5 transition-colors',
            selected ? 'hover:bg-white/20' : 'hover:bg-black/10'
          )}
        >
          <svg
            className="w-3 h-3"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2.5}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </span>
      )}
    </button>
  );
}
