interface Props {
  mode: 'calendar' | 'running';
  onChange: (mode: 'calendar' | 'running') => void;
}

export function CumulativeToggle({ mode, onChange }: Props) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm font-medium text-gray-700">Cumulative:</span>
      <button
        type="button"
        onClick={() => onChange(mode === 'calendar' ? 'running' : 'calendar')}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
          mode === 'running' ? 'bg-blue-600' : 'bg-gray-300'
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
            mode === 'running' ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
      <span className="text-sm font-medium text-gray-700">
        {mode === 'calendar' ? 'Monthly' : 'Running'}
      </span>
    </div>
  );
}
