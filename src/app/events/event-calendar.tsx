"use client";

import { useEffect, useMemo, useState } from "react";
import { DAY_HEX } from "@/lib/day-utils";
import { getOccurrenceDatesInMonth, hasOccurrenceInRange } from "@/lib/event-utils";
import type { EventSummary } from "@/types";

export interface DateRange {
  start: Date;
  end: Date;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function stripTime(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function toKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function buildDays(year: number, month: number): (Date | null)[] {
  const firstCol = (new Date(year, month, 1).getDay() + 6) % 7; // Mon-first
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = Array(firstCol).fill(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

// Mon-first column → JS day-of-week (0 = Sun)
const COL_DOW = [1, 2, 3, 4, 5, 6, 0];
const DOW_HEADER = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  /** Status-filtered displayed events — used for day counts in the grid. */
  events: EventSummary[];
  /** All events (unfiltered by date) — used for year and month counts. */
  allEvents: EventSummary[];
  dateRange: DateRange | null;
  onDateRangeChange: (r: DateRange | null) => void;
}

export function EventCalendar({ events, allEvents, dateRange, onDateRangeChange }: Props) {
  const today = useMemo(() => stripTime(new Date()), []);
  const currentYear = today.getFullYear();

  const [year, setYear] = useState(() => dateRange?.start.getFullYear() ?? currentYear);

  // selectedMonth: null = no month selected (year-level view)
  const [selectedMonth, setSelectedMonth] = useState<number | null>(() => {
    if (!dateRange) return null;
    const isFullYear =
      dateRange.start.getMonth() === 0 && dateRange.start.getDate() === 1 &&
      dateRange.end.getMonth() === 11 && dateRange.end.getDate() === 31 &&
      dateRange.start.getFullYear() === dateRange.end.getFullYear();
    return isFullYear ? null : dateRange.start.getMonth();
  });

  // Anchor for shift+click range extension
  const [anchorDate, setAnchorDate] = useState<Date | null>(null);
  // Drag state
  const [isDragging, setIsDragging] = useState(false);
  const [hoverDate, setHoverDate]   = useState<Date | null>(null);

  // On mount: if no dateRange exists, emit the current year range so events are filtered immediately
  useEffect(() => {
    if (!dateRange) {
      onDateRangeChange({ start: new Date(year, 0, 1), end: new Date(year, 11, 31) });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Year count (allEvents, year-scoped) ────────────────────────────────────
  const yearCount = useMemo(() => {
    const start = new Date(year, 0, 1);
    const end   = new Date(year, 11, 31);
    return allEvents.filter((e) => hasOccurrenceInRange(e, start, end)).length;
  }, [allEvents, year]);

  // ── Month counts (allEvents, all 12 months for this year) ─────────────────
  const monthCounts = useMemo(() => {
    const counts = new Array<number>(12).fill(0);
    for (const e of allEvents) {
      for (let m = 0; m < 12; m++) {
        if (getOccurrenceDatesInMonth(e, year, m).length > 0) counts[m]++;
      }
    }
    return counts;
  }, [allEvents, year]);

  // ── Day counts (events prop — already filtered to this month) ─────────────
  const eventDayCounts = useMemo(() => {
    const counts = new Map<string, number>();
    if (selectedMonth === null) return counts;
    for (const e of events) {
      for (const d of getOccurrenceDatesInMonth(e, year, selectedMonth)) {
        const key = toKey(d);
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    }
    return counts;
  }, [events, year, selectedMonth]);

  const cells = useMemo(
    () => (selectedMonth !== null ? buildDays(year, selectedMonth) : []),
    [year, selectedMonth],
  );

  // Preview: live drag range or committed range
  const dragPreview: DateRange | null =
    isDragging && anchorDate && hoverDate
      ? {
          start: anchorDate <= hoverDate ? anchorDate : hoverDate,
          end:   anchorDate <= hoverDate ? hoverDate   : anchorDate,
        }
      : null;

  const preview: DateRange | null = dragPreview ?? dateRange;

  // ── Year navigation ────────────────────────────────────────────────────────

  function changeYear(newYear: number) {
    setYear(newYear);
    setSelectedMonth(null);
    setAnchorDate(null);
    setHoverDate(null);
    setIsDragging(false);
    onDateRangeChange({ start: new Date(newYear, 0, 1), end: new Date(newYear, 11, 31) });
  }

  // ── Month toggle ───────────────────────────────────────────────────────────

  function handleMonthToggle(m: number) {
    setAnchorDate(null);
    setHoverDate(null);
    setIsDragging(false);
    if (selectedMonth === m) {
      // Deselect → revert to full year
      setSelectedMonth(null);
      onDateRangeChange({ start: new Date(year, 0, 1), end: new Date(year, 11, 31) });
    } else {
      // Select this month
      setSelectedMonth(m);
      onDateRangeChange({ start: new Date(year, m, 1), end: new Date(year, m + 1, 0) });
    }
  }

  // ── Day interaction ────────────────────────────────────────────────────────

  function handleDayMouseDown(day: Date, e: React.MouseEvent) {
    e.preventDefault();
    if (e.shiftKey) {
      if (anchorDate) {
        const start = anchorDate <= day ? anchorDate : day;
        const end   = anchorDate <= day ? day         : anchorDate;
        onDateRangeChange({ start, end });
      } else {
        setAnchorDate(day);
        onDateRangeChange({ start: day, end: day });
      }
      return;
    }
    setIsDragging(true);
    setAnchorDate(day);
    setHoverDate(day);
  }

  function handleDayMouseEnter(day: Date) {
    if (isDragging) setHoverDate(day);
  }

  // Commit selection on mouse-up anywhere in the calendar container
  function handleContainerMouseUp() {
    if (!isDragging || !anchorDate) return;
    setIsDragging(false);
    const end = hoverDate ?? anchorDate;
    const start = anchorDate <= end ? anchorDate : end;
    const endDate = anchorDate <= end ? end : anchorDate;
    // Toggle: clicking the already-selected single day deselects it → revert to month range
    if (
      isSameDay(start, endDate) &&
      dateRange &&
      isSameDay(dateRange.start, dateRange.end) &&
      isSameDay(start, dateRange.start)
    ) {
      if (selectedMonth !== null) {
        onDateRangeChange({ start: new Date(year, selectedMonth, 1), end: new Date(year, selectedMonth + 1, 0) });
      } else {
        onDateRangeChange(null);
      }
      setAnchorDate(null);
    } else {
      onDateRangeChange({ start, end: endDate });
    }
    setHoverDate(null);
  }

  // Clear day selection → revert to month range (keep month selected)
  function handleClear() {
    if (selectedMonth !== null) {
      onDateRangeChange({ start: new Date(year, selectedMonth, 1), end: new Date(year, selectedMonth + 1, 0) });
    } else {
      onDateRangeChange(null);
    }
    setAnchorDate(null);
    setHoverDate(null);
    setIsDragging(false);
  }

  const todayKey = toKey(today);

  // Show "Clear" only when a specific day range is active within the selected month
  // (not when dateRange equals the whole month)
  const isDaySelected =
    dateRange !== null &&
    selectedMonth !== null &&
    !(
      isSameDay(dateRange.start, new Date(year, selectedMonth, 1)) &&
      isSameDay(dateRange.end, new Date(year, selectedMonth + 1, 0))
    );

  // Footer text
  let footerText: string;
  if (isDragging && dragPreview) {
    const s = dragPreview.start.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
    const e = dragPreview.end.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
    footerText = isSameDay(dragPreview.start, dragPreview.end) ? s : `${s} → ${e}`;
  } else if (isDaySelected && dateRange) {
    const sameYear = dateRange.start.getFullYear() === dateRange.end.getFullYear();
    const s = dateRange.start.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: sameYear ? undefined : "numeric" });
    const e = dateRange.end.toLocaleDateString("en-GB",   { day: "numeric", month: "short", year: "numeric" });
    footerText = isSameDay(dateRange.start, dateRange.end) ? s : `${s} – ${e}`;
  } else if (selectedMonth !== null) {
    footerText = "Click · Shift+click to extend · drag for range";
  } else {
    footerText = "Select a month to view days";
  }

  return (
    <div
      className="flex-shrink-0 border-b border-gray-100 bg-white px-3 pt-2 pb-1.5"
      style={{ userSelect: "none" }}
      onMouseUp={handleContainerMouseUp}
      onMouseLeave={handleContainerMouseUp}
    >
      {/* Year nav — single year with prev/next chevrons */}
      <div className="flex items-center gap-1 mb-1">
        <button
          type="button"
          onClick={() => changeYear(year - 1)}
          aria-label="Previous year"
          className="rounded border border-gray-300 bg-white px-1.5 py-0.5 text-xs text-gray-500 hover:bg-gray-50 transition leading-none"
        >
          ‹
        </button>
        <span className="flex-1 text-center text-xs font-semibold text-gray-700 tabular-nums">
          {year} ({yearCount})
        </span>
        <button
          type="button"
          onClick={() => changeYear(year + 1)}
          aria-label="Next year"
          className="rounded border border-gray-300 bg-white px-1.5 py-0.5 text-xs text-gray-500 hover:bg-gray-50 transition leading-none"
        >
          ›
        </button>
      </div>

      {/* Month pills */}
      <div className="flex items-center gap-1 flex-wrap mb-1.5">
        {MONTH_ABBR.map((name, m) => {
          const count = monthCounts[m];
          const active = selectedMonth === m;
          return (
            <button
              key={m}
              type="button"
              onClick={() => handleMonthToggle(m)}
              aria-pressed={active}
              className={`rounded-full border px-2 py-0.5 text-xs font-medium transition ${
                active
                  ? "bg-indigo-600 text-white border-indigo-600"
                  : count > 0
                    ? "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                    : "border-gray-200 bg-white text-gray-400 hover:bg-gray-50"
              }`}
            >
              {name} ({count})
            </button>
          );
        })}
      </div>

      {/* Day grid — only when a month is selected */}
      {selectedMonth !== null && (
        <div className="grid grid-cols-7 gap-px">
          {/* Day-of-week headers */}
          {DOW_HEADER.map((lbl, i) => {
            const hex = DAY_HEX[COL_DOW[i]];
            return (
              <div
                key={i}
                className="text-center text-xs font-bold py-0.5 rounded-sm"
                style={{ backgroundColor: hex + "28", color: hex }}
              >
                {lbl}
              </div>
            );
          })}

          {/* Day cells */}
          {cells.map((day, idx) => {
            if (!day) return <div key={idx} />;

            const hex    = DAY_HEX[day.getDay()];
            const key    = toKey(day);
            const count  = eventDayCounts.get(key) ?? 0;
            const hasEvents = count > 0;
            const isToday   = key === todayKey;

            let isStart = false, isEnd = false, inRange = false;
            if (preview) {
              isStart = isSameDay(day, preview.start);
              isEnd   = isSameDay(day, preview.end);
              inRange = !isStart && !isEnd && day > preview.start && day < preview.end;
            }

            let bg: string;
            let color: string | undefined;
            let fontWeight = "500";

            if (isStart || isEnd) {
              bg        = hex;
              color     = "#ffffff";
              fontWeight = "700";
            } else if (inRange) {
              bg = hex + "50";
            } else if (hasEvents) {
              bg = hex + "30";
            } else {
              bg = "transparent";
            }

            const showConnector = inRange || isStart || isEnd;

            return (
              <div
                key={idx}
                className="relative"
                style={{ backgroundColor: showConnector ? hex + "18" : undefined }}
              >
                <button
                  type="button"
                  onMouseDown={(e) => handleDayMouseDown(day, e)}
                  onMouseEnter={() => handleDayMouseEnter(day)}
                  aria-label={`${day.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}${hasEvents ? `, ${count} event${count !== 1 ? "s" : ""}` : ""}${isStart || isEnd || inRange ? ", selected" : ""}`}
                  className={`relative z-10 w-full text-center text-xs py-0.5 rounded transition flex flex-col items-center leading-none gap-px ${
                    isToday ? "ring-1 ring-inset ring-gray-400" : ""
                  } ${
                    !hasEvents && !isStart && !isEnd && !inRange
                      ? "opacity-25"
                      : "cursor-pointer hover:opacity-80"
                  }`}
                  style={{ backgroundColor: bg, color, fontWeight }}
                >
                  <span>{day.getDate()}</span>
                  {count > 0 && (
                    <span
                      className="tabular-nums"
                      style={{ fontSize: "0.55rem", lineHeight: 1, opacity: isStart || isEnd ? 0.85 : 0.65 }}
                    >
                      {count}
                    </span>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Footer status + clear */}
      <div className="mt-1 flex items-center justify-between text-xs">
        <div role="status" aria-live="polite" aria-atomic="true">
          <span className={isDragging ? "text-indigo-600 font-medium" : "text-gray-400"}>
            {footerText}
          </span>
        </div>
        {isDaySelected && (
          <button
            type="button"
            onClick={handleClear}
            className="ml-3 text-gray-400 hover:text-red-500 transition"
          >
            Clear
          </button>
        )}
      </div>
    </div>
  );
}
