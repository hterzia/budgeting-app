import { useEffect, useMemo, useState } from 'react';
import clsx from "clsx";
import {
  DATE_RANGE_PRESETS,
  DateRangeSelection,
  formatRange,
  getRangeBounds,
  getRangeLabel,
  presetSelection,
  customSelection,
} from '../../features/date-range/model/dateRange';

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
        className={clsx(
          "flex items-center space-x-3 bg-white border",
          "border-gray-300 rounded-lg px-4 py-2",
          "text-sm font-medium text-gray-700",
          "hover:border-amber-400 hover:text-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-600/20 focus:border-amber-500 transition-all"
        )}
      >
        <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <span className="font-serif font-medium">{selectedLabel}</span>
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
          <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl z-20 border border-gray-200 overflow-hidden">
            <div className="p-5 border-b border-gray-200 bg-gradient-to-b from-gray-50/50 to-transparent">
              <p className="text-xs tracking-widest text-gray-500 uppercase font-medium mb-4">Quick Select</p>
              <div className="grid grid-cols-2 gap-2">
                {presetRanges.slice(0, 4).map((range) => (
                  <button
                    key={range.id}
                    onClick={() => selectPreset(range.id)}
                    className={clsx(
                      "px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-left",
                      "hover:border-amber-300",
                      value.kind === 'preset' && value.preset === range.id
                        ? 'bg-amber-50 text-amber-700 border border-amber-200'
                        : 'bg-white text-gray-700 hover:bg-amber-50/50 border border-gray-200 hover:border-amber-200 hover:text-amber-700'
                    )}
                  >
                    {range.label}
                  </button>
                ))}
                <button
                  onClick={() => selectPreset('12months')}
                  className={clsx(
                    "px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-left",
                    "hover:border-amber-300",
                    value.kind === 'preset' && value.preset === '12months'
                      ? 'bg-amber-50 text-amber-700 border border-amber-200'
                      : 'bg-white text-gray-700 hover:bg-amber-50/50 border border-gray-200 hover:border-amber-200 hover:text-amber-700'
                  )}
                >
                  Last 12 Months
                </button>
                <button
                  onClick={() => selectPreset('allTime')}
                  className={clsx(
                    "px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-left",
                    "hover:border-amber-300",
                    value.kind === 'preset' && value.preset === 'allTime'
                      ? 'bg-amber-50 text-amber-700 border border-amber-200'
                      : 'bg-white text-gray-700 hover:bg-amber-50/50 border border-gray-200 hover:border-amber-200 hover:text-amber-700'
                  )}
                >
                  All Time
                </button>
                <button
                  onClick={() => selectPreset('24months')}
                  className={clsx(
                    "px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-left",
                    "hover:border-amber-300",
                    value.kind === 'preset' && value.preset === '24months'
                      ? 'bg-amber-50 text-amber-700 border border-amber-200'
                      : 'bg-white text-gray-700 hover:bg-amber-50/50 border border-gray-200 hover:border-amber-200 hover:text-amber-700'
                  )}
                >
                  Last 24 Months
                </button>
                <button
                  onClick={() => selectPreset('36months')}
                  className={clsx(
                    "px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-left",
                    "hover:border-amber-300",
                    value.kind === 'preset' && value.preset === '36months'
                      ? 'bg-amber-50 text-amber-700 border border-amber-200'
                      : 'bg-white text-gray-700 hover:bg-amber-50/50 border border-gray-200 hover:border-amber-200 hover:text-amber-700'
                  )}
                >
                  Last 36 Months
                </button>
              </div>
            </div>

            {allowCustom && (
              <>
                <div className="p-5">
                  <div className="flex items-center justify-between mb-5">
                    <button
                      onClick={prevMonth}
                      className="p-2 rounded-lg transition-colors text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>
                    <span className="text-sm font-serif text-gray-900">
                      {calendarMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                    </span>
                    <button
                      onClick={nextMonth}
                      className="p-2 rounded-lg transition-colors text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </div>

                  <div className="grid grid-cols-7 gap-1.5 mb-3">
                    {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((day) => (
                      <div key={day} className="text-center text-xs font-medium text-gray-400 py-1.5">
                        {day}
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-7 gap-1.5">
                    {getCalendarDays(calendarMonth).map((day, index) => {
                      if (!day) {
                        return <div key={index} className="aspect-square" />;
                      }

                      const selectionStatus = isDateSelected(day);
                      let dayClass = 'text-gray-700 hover:bg-amber-50 hover:text-amber-700';
                      let buttonClass = '';

                      if (selectionStatus === 'start') {
                        dayClass = 'bg-amber-600 text-white';
                        buttonClass = 'rounded-l-full';
                      } else if (selectionStatus === 'end') {
                        dayClass = 'bg-amber-600 text-white';
                        buttonClass = 'rounded-r-full';
                      } else if (selectionStatus === 'in-range') {
                        dayClass = 'bg-amber-100 text-amber-700';
                      }

                      return (
                        <div key={index} className="aspect-square">
                          <div className="relative">
                            <button
                              type="button"
                              onClick={() => handleDateClick(day)}
                              className={clsx(
                                "flex items-center justify-center w-8 h-8 mx-auto text-sm transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-amber-600/20 focus:ring-offset-1",
                                dayClass,
                                buttonClass
                              )}
                            >
                              {day.getDate()}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="bg-gray-50 px-5 py-4 border-t border-gray-200">
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between text-sm">
                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-wider">Selected Range</p>
                        <p className="text-sm font-medium text-gray-900">
                          {startDate && endDate
                            ? `${formatDate(startDate)} - ${formatDate(endDate)}`
                            : getRangeLabel(value)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-gray-500 uppercase tracking-wider">Period</p>
                        <p className="text-sm font-medium text-gray-900">
                          {startDate && endDate
                            ? `${dayDiffInclusive(startDate, endDate)} days`
                            : `${dayDiffInclusive(selectedBounds.start, selectedBounds.end)} days`}
                        </p>
                      </div>
                    </div>
                    {startDate && !endDate && (
                      <p className="text-xs text-amber-700">Click another date to complete the selection</p>
                    )}
                  </div>
                </div>

                {startDate && endDate && (
                  <div className="px-5 py-4 bg-gray-50 border-t border-gray-200">
                    <button
                      onClick={applyCustomRange}
                      className="w-full bg-amber-700 text-white py-2.5 rounded-xl hover:bg-amber-800 transition-colors font-medium text-sm"
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
