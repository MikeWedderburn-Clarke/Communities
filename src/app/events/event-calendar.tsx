"use client";

import { useMemo, useState } from "react";
import { DAY_HEX } from "@/lib/day-utils";
import { getOccurrenceDatesInMonth } from "@/lib/event-utils";
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
  /** All events in scope (status-filtered) — used to mark which days have events. */
  events: EventSummary[];
  dateRange: DateRange | null;
  onDateRangeChange: (r: DateRange | null) => void;
}

export function EventCalendar({ events, dateRange, onDateRangeChange }: Props) {
  const today = useMemo(() => stripTime(new Date()), []);
  const currentYear = today.getFullYear();

  const [year, setYear]  = useState(() => dateRange?.start.getFullYear() ?? currentYear);
  const [month, setMonth] = useState(() => dateRange?.start.getMonth() ?? today.getMonth());

  // Anchor for shift+click range extension
  const [anchorDate, setAnchorDate] = useState<Date | null>(null);
  // Drag state
  const [isDragging, setIsDragging] = useState(false);
  const [hoverDate, setHoverDate]   = useState<Date | null>(null);

  const years = useMemo(
    () => Array.from({ length: 7 }, (_, i) => currentYear - 3 + i),
    [currentYear],
  );

  // Days that have at least one occurrence in this month (includes recurrences)
  const eventDayKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const e of events) {
      for (const d of getOccurrenceDatesInMonth(e, year, month)) {
        keys.add(toKey(d));
      }
    }
    return keys;
  }, [events, year, month]);

  const cells = useMemo(() => buildDays(year, month), [year, month]);

  // Preview: live drag range or committed range
  const dragPreview: DateRange | null =
    isDragging && anchorDate && hoverDate
      ? {
          start: anchorDate <= hoverDate ? anchorDate : hoverDate,
          end:   anchorDate <= hoverDate ? hoverDate   : anchorDate,
        }
      : null;

  const preview: DateRange | null = dragPreview ?? dateRange;

  // ── Year / month navigation — clears selection ─────────────────────────────

  function handleYearChange(y: number) {
    setYear(y);
    onDateRangeChange(null);
    setAnchorDate(null);
    setHoverDate(null);
    setIsDragging(false);
  }

  function handleMonthChange(m: number) {
    setMonth(m);
    onDateRangeChange(null);
    setAnchorDate(null);
    setHoverDate(null);
    setIsDragging(false);
  }

  // ── Day interaction ────────────────────────────────────────────────────────

  function handleDayMouseDown(day: Date, e: React.MouseEvent) {
    e.preventDefault(); // prevent text selection during drag
    if (e.shiftKey) {
      // Shift+click: extend range from current anchor
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
    // Start drag / potential single-click
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
    // Toggle: clicking the already-selected single day deselects it
    if (
      isSameDay(start, endDate) &&
      dateRange &&
      isSameDay(dateRange.start, dateRange.end) &&
      isSameDay(start, dateRange.start)
    ) {
      onDateRangeChange(null);
      setAnchorDate(null);
    } else {
      onDateRangeChange({ start, end: endDate });
    }
    setHoverDate(null);
  }

  function handleClear() {
    onDateRangeChange(null);
    setAnchorDate(null);
    setHoverDate(null);
    setIsDragging(false);
  }

  const todayKey = toKey(today);

  // Footer
  let footerText: string;
  if (isDragging && dragPreview) {
    const s = dragPreview.start.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
    const e = dragPreview.end.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
    footerText = isSameDay(dragPreview.start, dragPreview.end) ? s : `${s} → ${e}`;
  } else if (dateRange) {
    const sameYear = dateRange.start.getFullYear() === dateRange.end.getFullYear();
    const s = dateRange.start.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: sameYear ? undefined : "numeric" });
    const e = dateRange.end.toLocaleDateString("en-GB",   { day: "numeric", month: "short", year: "numeric" });
    footerText = isSameDay(dateRange.start, dateRange.end) ? s : `${s} – ${e}`;
  } else {
    footerText = "Click · Shift+click to extend · drag for range";
  }

  return (
    <div
      className="flex-shrink-0 border-b border-gray-100 bg-white px-3 pt-2 pb-1.5"
      style={{ userSelect: "none" }}
      onMouseUp={handleContainerMouseUp}
      onMouseLeave={handleContainerMouseUp}
    >
      {/* Year pills */}
      <div className="flex items-center gap-1 flex-wrap mb-1">
        {years.map((y) => (
          <button
            key={y}
            type="button"
            onClick={() => handleYearChange(y)}
            className={`rounded-full border px-2 py-0.5 text-xs font-medium transition ${
              year === y
                ? "bg-indigo-600 text-white border-indigo-600"
                : "border-gray-300 bg-white text-gray-500 hover:bg-gray-50"
            }`}
          >
            {y}
          </button>
        ))}
      </div>

      {/* Month pills */}
      <div className="flex items-center gap-1 flex-wrap mb-1.5">
        {MONTH_ABBR.map((name, m) => (
          <button
            key={m}
            type="button"
            onClick={() => handleMonthChange(m)}
            className={`rounded-full border px-2 py-0.5 text-xs font-medium transition ${
              month === m
                ? "bg-indigo-600 text-white border-indigo-600"
                : "border-gray-300 bg-white text-gray-500 hover:bg-gray-50"
            }`}
          >
            {name}
          </button>
        ))}
      </div>

      {/* Day grid */}
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

          const hex       = DAY_HEX[day.getDay()];
          const key       = toKey(day);
          const hasEvents = eventDayKeys.has(key);
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
                className={`relative z-10 w-full text-center text-xs py-0.5 rounded transition ${
                  isToday ? "ring-1 ring-inset ring-gray-400" : ""
                } ${
                  !hasEvents && !isStart && !isEnd && !inRange
                    ? "opacity-25"
                    : "cursor-pointer hover:opacity-80"
                }`}
                style={{ backgroundColor: bg, color, fontWeight }}
              >
                {day.getDate()}
              </button>
            </div>
          );
        })}
      </div>

      {/* Footer status + clear */}
      <div className="mt-1 flex items-center justify-between text-xs">
        <span className={isDragging ? "text-indigo-600 font-medium" : "text-gray-400"}>
          {footerText}
        </span>
        {dateRange && (
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
