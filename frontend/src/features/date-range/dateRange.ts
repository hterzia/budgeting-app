export type DateRangePreset = '30days' | 'currentMonth' | '90days' | '6months' | 'ytd' | 'allTime';

export interface DateRangeBounds {
  start: Date;
  end: Date;
}

export type DateRangeSelection =
  | { kind: 'preset'; preset: DateRangePreset }
  | { kind: 'custom'; startDate: string; endDate: string };

export const DATE_RANGE_PRESETS: ReadonlyArray<{ id: DateRangePreset; label: string }> = [
  { id: 'currentMonth', label: 'Current Month' },
  { id: '30days', label: 'Last 30 Days' },
  { id: '90days', label: 'Last 90 Days' },
  { id: '6months', label: 'Last 6 Months' },
  { id: 'ytd', label: 'Year to Date' },
  { id: 'allTime', label: 'All Time' },
];

const PRESET_LABELS: Record<DateRangePreset, string> = DATE_RANGE_PRESETS.reduce(
  (acc, entry) => {
    acc[entry.id] = entry.label;
    return acc;
  },
  {} as Record<DateRangePreset, string>
);

const DEFAULT_PRESET: DateRangePreset = 'currentMonth';
const ALL_TIME_START = new Date(2000, 0, 1);

const formatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

const toStartOfDay = (date: Date): Date => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

const toEndOfDay = (date: Date): Date => {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
};

function formatISODateLocal(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseISODateLocal(value: string): Date {
  const [yearStr, monthStr, dayStr] = value.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);

  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return new Date(NaN);
  }

  return new Date(year, month - 1, day);
}

function resolvePresetBounds(preset: DateRangePreset, now: Date): DateRangeBounds {
  switch (preset) {
    case 'allTime':
      return { start: toStartOfDay(ALL_TIME_START), end: toEndOfDay(now) };
    case 'currentMonth': {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      return { start: toStartOfDay(start), end: toEndOfDay(end) };
    }
    case '30days': {
      const start = toStartOfDay(now);
      start.setDate(start.getDate() - 30);
      return { start, end: toEndOfDay(now) };
    }
    case '90days': {
      const start = toStartOfDay(now);
      start.setDate(start.getDate() - 90);
      return { start, end: toEndOfDay(now) };
    }
    case '6months': {
      const start = toStartOfDay(now);
      start.setMonth(start.getMonth() - 6);
      return { start, end: toEndOfDay(now) };
    }
    case 'ytd': {
      const start = new Date(now.getFullYear(), 0, 1);
      return { start: toStartOfDay(start), end: toEndOfDay(now) };
    }
    default:
      return { start: toStartOfDay(now), end: toEndOfDay(now) };
  }
}

function normalizeSelection(selection: DateRangeSelection): DateRangeSelection {
  if (selection.kind === 'preset') {
    return selection;
  }

  const start = parseISODateLocal(selection.startDate);
  const end = parseISODateLocal(selection.endDate);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return presetSelection(DEFAULT_PRESET);
  }

  if (start.getTime() > end.getTime()) {
    return {
      kind: 'custom',
      startDate: selection.endDate,
      endDate: selection.startDate,
    };
  }

  return selection;
}

export function presetSelection(preset: DateRangePreset): DateRangeSelection {
  return { kind: 'preset', preset };
}

export function customSelection(startDate: Date, endDate: Date): DateRangeSelection {
  const start = toStartOfDay(startDate);
  const end = toStartOfDay(endDate);

  if (start.getTime() <= end.getTime()) {
    return {
      kind: 'custom',
      startDate: formatISODateLocal(start),
      endDate: formatISODateLocal(end),
    };
  }

  return {
    kind: 'custom',
    startDate: formatISODateLocal(end),
    endDate: formatISODateLocal(start),
  };
}

export function isDateRangePreset(value: string): value is DateRangePreset {
  return DATE_RANGE_PRESETS.some((entry) => entry.id === value);
}

export function normalizeDateRangeSelection(value: unknown): DateRangeSelection {
  if (typeof value === 'string' && isDateRangePreset(value)) {
    return presetSelection(value);
  }

  if (value && typeof value === 'object') {
    const selection = value as Partial<DateRangeSelection>;
    if (selection.kind === 'preset' && selection.preset && isDateRangePreset(selection.preset)) {
      return presetSelection(selection.preset);
    }
    if (
      selection.kind === 'custom' &&
      typeof selection.startDate === 'string' &&
      typeof selection.endDate === 'string'
    ) {
      return normalizeSelection({ kind: 'custom', startDate: selection.startDate, endDate: selection.endDate });
    }
  }

  return presetSelection(DEFAULT_PRESET);
}

export function getRangeLabel(selection: DateRangeSelection): string {
  if (selection.kind === 'preset') {
    return PRESET_LABELS[selection.preset];
  }
  return 'Custom Range';
}

export function getRangeBounds(selection: DateRangeSelection): DateRangeBounds {
  const now = new Date();
  const normalizedSelection = normalizeSelection(selection);

  if (normalizedSelection.kind === 'custom') {
    const start = parseISODateLocal(normalizedSelection.startDate);
    const end = parseISODateLocal(normalizedSelection.endDate);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return resolvePresetBounds(DEFAULT_PRESET, now);
    }
    return { start: toStartOfDay(start), end: toEndOfDay(end) };
  }

  return resolvePresetBounds(normalizedSelection.preset, now);
}

export function formatRange(selection: DateRangeSelection): string {
  const bounds = getRangeBounds(selection);
  return `${formatter.format(bounds.start)} - ${formatter.format(bounds.end)}`;
}
