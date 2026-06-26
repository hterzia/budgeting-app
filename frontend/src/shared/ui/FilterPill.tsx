import clsx from 'clsx';

interface FilterPillProps {
  label: string;
  count?: number;
  selected: boolean;
  onClick: () => void;
}

export function FilterPill({ label, count, selected, onClick }: FilterPillProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        'relative inline-flex items-center px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200',
        'focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-amber-600/30',
        selected
          ? 'bg-amber-700 text-white hover:bg-amber-800'
          : 'bg-white text-gray-700 border border-gray-200 hover:bg-amber-50/50 hover:border-amber-200 hover:text-amber-700'
      )}
    >
      <span>{label}</span>
      {count !== undefined && (
        <span
          className={clsx(
            'ml-2 inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full text-xs font-semibold',
            selected ? 'bg-amber-600 text-white' : 'bg-amber-100 text-amber-700'
          )}
        >
          {count}
        </span>
      )}
      {selected && (
        <span className="absolute -top-1 -right-1 flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
          <span className="relative inline-flex rounded-full h-3 w-3 bg-white"></span>
        </span>
      )}
    </button>
  );
}
