import { useEffect, useMemo, useState } from 'react';
import {
  DATE_RANGE_PRESETS,
  DateRangeSelection,
  formatRange,
  getRangeBounds,
  getRangeLabel,
  presetSelection,
  customSelection,
} from '../model/dateRange';

const formatDate = (date: Date): string => {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const dayDiffInclusive = (start: Date, end: Date): number => {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.floor((end.getTime() - start.getTime()) / msPerDay) + 1;
};

export function DateRangeSelector({
  value,
  onChange,
  allowCustom = true,
}: {
  value: DateRangeSelection;
  onChange: (range: DateRangeSelection) => void;
  allowCustom?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);

  useEffect(() => {
    if (value.kind === 'custom') {
      const bounds = getRangeBounds(value);
      setStartDate(bounds.start);
      setEndDate(bounds.end);
      setCalendarMonth(bounds.start);
      return;
    }

    setStartDate(null);
    setEndDate(null);
    setCalendarMonth(new Date());
  }, [value]);

  const presetRanges = useMemo(() => DATE_RANGE_PRESETS, []);

  const selectedBounds = getRangeBounds(value);
  const selectedLabel = formatRange(value);

  const prevMonth = () => {
    setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1));
  };

  const selectPreset = (preset: (typeof DATE_RANGE_PRESETS)[number]['id']) => {
    onChange(presetSelection(preset));
    setIsOpen(false);
  };

  const handleDateClick = (date: Date) => {
    const normalizedDate = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);

    if (!startDate || (startDate && endDate)) {
      setStartDate(normalizedDate);
      setEndDate(null);
    } else if (normalizedDate < startDate) {
      setStartDate(normalizedDate);
      setEndDate(null);
    } else {
      setEndDate(normalizedDate);
    }
  };

  const applyCustomRange = () => {
    if (!allowCustom || !startDate || !endDate) return;
    onChange(customSelection(startDate, endDate));
    setIsOpen(false);
  };

  const isDateSelected = (date: Date): 'start' | 'end' | 'in-range' | 'none' => {
    if (!startDate) return 'none';
    if (endDate) {
      if (date.getTime() === startDate.getTime()) return 'start';
      if (date.getTime() === endDate.getTime()) return 'end';
      if (date > startDate && date < endDate) return 'in-range';
    }
    return 'none';
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-3 bg-white border border-gray-300 rounded-lg px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
      >
        <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <span className="font-semibold">{selectedLabel}</span>
        <svg
          className={`w-4 h-4 text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl z-20 border border-gray-200 overflow-hidden">
            <div className="p-4 border-b border-gray-100">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Quick Select</p>
              <div className="grid grid-cols-2 gap-2">
                {presetRanges.slice(0, 4).map((range) => (
                  <button
                    key={range.id}
                    onClick={() => selectPreset(range.id)}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors text-left ${
                      value.kind === 'preset' && value.preset === range.id
                        ? 'bg-blue-50 text-blue-700 border border-blue-200'
                        : 'bg-gray-50 text-gray-700 hover:bg-gray-100 border border-transparent'
                    }`}
                  >
                    {range.label}
                  </button>
                ))}
                <button
                  onClick={() => selectPreset('allTime')}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors text-left ${
                    value.kind === 'preset' && value.preset === 'allTime'
                      ? 'bg-blue-50 text-blue-700 border border-blue-200'
                      : 'bg-gray-50 text-gray-700 hover:bg-gray-100 border border-transparent'
                  }`}
                >
                  All Time
                </button>
                <button
                  onClick={() => selectPreset('24months')}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors text-left ${
                    value.kind === 'preset' && value.preset === '24months'
                      ? 'bg-blue-50 text-blue-700 border border-blue-200'
                      : 'bg-gray-50 text-gray-700 hover:bg-gray-100 border border-transparent'
                  }`}
                >
                  Last 24 Months
                </button>
                <button
                  onClick={() => selectPreset('36months')}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors text-left ${
                    value.kind === 'preset' && value.preset === '36months'
                      ? 'bg-blue-50 text-blue-700 border border-blue-200'
                      : 'bg-gray-50 text-gray-700 hover:bg-gray-100 border border-transparent'
                  }`}
                >
                  Last 36 Months
                </button>
              </div>
            </div>

            {allowCustom && (
              <>
                <div className="p-4">
                  <div className="flex items-center justify-between mb-4">
                    <button
                      onClick={prevMonth}
                      className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-600 hover:text-gray-900"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>
                    <span className="text-sm font-semibold text-gray-900">
                      {calendarMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                    </span>
                    <button
                      onClick={nextMonth}
                      className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-600 hover:text-gray-900"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </div>

                  <div className="grid grid-cols-7 gap-1 mb-2">
                    {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((day) => (
                      <div key={day} className="text-center text-xs font-medium text-gray-400 py-1">
                        {day}
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-7 gap-1">
                    {getCalendarDays(calendarMonth).map((day, index) => {
                      if (!day) {
                        return <div key={index} className="aspect-square" />;
                      }

                      const selectionStatus = isDateSelected(day);
                      let dayClass = 'text-gray-700 hover:bg-blue-50 hover:text-blue-700';
                      let buttonClass = '';

                      if (selectionStatus === 'start') {
                        dayClass = 'bg-blue-600 text-white';
                        buttonClass = 'rounded-l-full';
                      } else if (selectionStatus === 'end') {
                        dayClass = 'bg-blue-600 text-white';
                        buttonClass = 'rounded-r-full';
                      } else if (selectionStatus === 'in-range') {
                        dayClass = 'bg-blue-100 text-blue-700';
                      }

                      return (
                        <div key={index} className="aspect-square">
                          <div className="relative">
                            <button
                              type="button"
                              onClick={() => handleDateClick(day)}
                              className={`flex items-center justify-center w-8 h-8 mx-auto text-sm transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 ${dayClass} ${buttonClass}`}
                            >
                              {day.getDate()}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="bg-gray-50 px-4 py-3 border-t border-gray-100">
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between text-sm">
                      <div>
                        <p className="text-xs text-gray-500 uppercase">Selected Range</p>
                        <p className="text-sm font-medium text-gray-900">
                          {startDate && endDate
                            ? `${formatDate(startDate)} - ${formatDate(endDate)}`
                            : getRangeLabel(value)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-gray-500 uppercase">Period</p>
                        <p className="text-sm font-medium text-gray-900">
                          {startDate && endDate
                            ? `${dayDiffInclusive(startDate, endDate)} days`
                            : `${dayDiffInclusive(selectedBounds.start, selectedBounds.end)} days`}
                        </p>
                      </div>
                    </div>
                    {startDate && !endDate && (
                      <p className="text-xs text-blue-600">Click another date to complete the selection</p>
                    )}
                  </div>
                </div>

                {startDate && endDate && (
                  <div className="px-4 py-3 bg-gray-50 border-t border-gray-100">
                    <button
                      onClick={applyCustomRange}
                      className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm"
                    >
                      Apply Date Range
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function getCalendarDays(month: Date): (Date | null)[] {
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const firstDayOfMonth = new Date(year, monthIndex, 1);
  const lastDayOfMonth = new Date(year, monthIndex + 1, 0);
  const daysInMonth = lastDayOfMonth.getDate();
  const startingDayOfWeek = firstDayOfMonth.getDay();

  const days: (Date | null)[] = [];

  for (let i = 0; i < startingDayOfWeek; i++) {
    days.push(null);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    days.push(new Date(year, monthIndex, day));
  }

  return days;
}
