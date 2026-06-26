import { describe, it, expect } from "vitest";
import { selectTrendGranularity } from "../../transactions/aggregations";
import { DateRangeBounds } from "../../date-range/model/dateRange";

describe("selectTrendGranularity", () => {
  it('returns "day" for ranges under 90 days', () => {
    const bounds: DateRangeBounds = {
      start: new Date("2026-02-01T00:00:00"),
      end: new Date("2026-03-05T23:59:59"),
    };
    expect(selectTrendGranularity(bounds)).toBe("day");
  });

  it('returns "month" for ranges of exactly 90 days', () => {
    const start = new Date("2026-03-05T00:00:00");
    const end = new Date(start.getTime() + 90 * 24 * 60 * 60 * 1000);
    expect(selectTrendGranularity({ start, end })).toBe("month");
  });

  it('returns "month" for ranges over 90 days', () => {
    const bounds: DateRangeBounds = {
      start: new Date("2025-12-01T00:00:00"),
      end: new Date("2026-03-05T23:59:59"),
    };
    expect(selectTrendGranularity(bounds)).toBe("month");
  });
});
