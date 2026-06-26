import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import {
  customSelection,
  formatRange,
  getRangeBounds,
  presetSelection,
} from './model/dateRange';

const fixedNow = new Date('2026-03-05T12:00:00Z');

describe('dateRange', () => {
  beforeAll(() => {
    vi.useFakeTimers();
    vi.setSystemTime(fixedNow);
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  it('returns start of current month for currentMonth', () => {
    const { start, end } = getRangeBounds(presetSelection('currentMonth'));
    expect(start.toISOString().slice(0, 10)).toBe('2026-03-01');
    expect(end.getMonth()).toBe(2);
  });

  it('supports custom range', () => {
    const startDate = new Date(2026, 0, 10);
    const endDate = new Date(2026, 0, 20);
    const { start, end } = getRangeBounds(customSelection(startDate, endDate));
    expect(start.getFullYear()).toBe(2026);
    expect(start.getMonth()).toBe(0);
    expect(start.getDate()).toBe(10);
    expect(end.getFullYear()).toBe(2026);
    expect(end.getMonth()).toBe(0);
    expect(end.getDate()).toBe(20);
  });

  it('formats range string', () => {
    const text = formatRange(presetSelection('30days'));
    expect(text).toContain('Mar');
  });

  it('returns correct bounds for 90days', () => {
    const { start, end } = getRangeBounds(presetSelection('90days'));
    const diffDays = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    expect(diffDays).toBeGreaterThanOrEqual(89);
    expect(diffDays).toBeLessThanOrEqual(91);
    expect(end.getMonth()).toBe(2); // March
  });

  it('returns correct bounds for 6months', () => {
    const { start, end } = getRangeBounds(presetSelection('6months'));
    expect(start.getMonth()).toBe(8); // September 2025
    expect(start.getFullYear()).toBe(2025);
    expect(end.getMonth()).toBe(2); // March 2026
  });

  it('returns correct bounds for ytd', () => {
    const { start, end } = getRangeBounds(presetSelection('ytd'));
    expect(start.getFullYear()).toBe(2026);
    expect(start.getMonth()).toBe(0); // January
    expect(start.getDate()).toBe(1);
    expect(end.getMonth()).toBe(2); // March
  });

  it('returns correct bounds for allTime', () => {
    const { start, end } = getRangeBounds(presetSelection('allTime'));
    expect(start.getFullYear()).toBe(2000);
    expect(start.getMonth()).toBe(0);
    expect(start.getDate()).toBe(1);
    expect(end.getMonth()).toBe(2); // current month
  });

  it('custom range with startDate after endDate still returns both', () => {
    const startDate = new Date(2026, 2, 20);
    const endDate = new Date(2026, 2, 10);
    const { start, end } = getRangeBounds(customSelection(startDate, endDate));
    expect(start.getDate()).toBe(10);
    expect(end.getDate()).toBe(20);
  });

  it('formatRange for currentMonth includes month name', () => {
    const text = formatRange(presetSelection('currentMonth'));
    expect(text).toContain('Mar');
  });

  it('formats preset selections', () => {
    const text = formatRange(presetSelection('30days'));
    expect(text).toContain('Mar');
  });
});
