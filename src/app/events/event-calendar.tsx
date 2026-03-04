"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  const currentYear = new Date().getFullYear();

  // todayKey computed client-side only — avoids SSR/client hydration mismatch
  // when the server and browser render on different clock values.
  const [todayKey, setTodayKey] = useState<string>("");
  useEffect(() => {
    setTodayKey(toKey(stripTime(new Date())));
  }, []);

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

  // Anchor for shift+click — state is fine here since shift+click is two
  // separate user interactions with a re-render in between.
  const [anchorDate, setAnchorDate] = useState<Date | null>(null);

  // Drag state stored in refs to avoid stale-closure bug:
  // On a single click, mousedown and mouseup fire within the same browser task
  // before React has a chance to re-render, so event handlers that read state
  // see the previous render's values. Refs are always current.
  const isDraggingRef = useRef(false);
  const anchorRef     = useRef<Date | null>(null);
  const hoverRef      = useRef<Date | null>(null);

  // Separate state drives the visual drag preview (triggers re-render).
  const [dragPreview, setDragPreview] = useState<DateRange | null>(null);

  // On mount: if no dateRange exists, emit the current year range immediately.
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
  const preview: DateRange | null = dragPreview ?? dateRange;

  // ── Year navigation ────────────────────────────────────────────────────────

  function changeYear(newYear: number) {
    setYear(newYear);
    setSelectedMonth(null);
    setAnchorDate(null);
    isDraggingRef.current = false;
    anchorRef.current     = null;
    hoverRef.current      = null;
    setDragPreview(null);
    onDateRangeChange({ start: new Date(newYear, 0, 1), end: new Date(newYear, 11, 31) });
  }

  // ── Month toggle ───────────────────────────────────────────────────────────

  function handleMonthToggle(m: number) {
    setAnchorDate(null);
    isDraggingRef.current = false;
    anchorRef.current     = null;
    hoverRef.current      = null;
    setDragPreview(null);
    if (selectedMonth === m) {
      setSelectedMonth(null);
      onDateRangeChange({ start: new Date(year, 0, 1), end: new Date(year, 11, 31) });
    } else {
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
    // Write to refs immediately — no batching delay, always readable in mouseup
    isDraggingRef.current = true;
    anchorRef.current     = day;
    hoverRef.current      = day;
    setDragPreview({ start: day, end: day });
  }

  function handleDayMouseEnter(day: Date) {
    if (!isDraggingRef.current || !anchorRef.current) return;
    hoverRef.current = day;
    const anchor = anchorRef.current;
    setDragPreview({
      start: anchor <= day ? anchor : day,
      end:   anchor <= day ? day    : anchor,
    });
  }

  // Commit selection — reads refs, not state, so always sees current values
  // even when mouseup fires in the same browser task as mousedown.
  function handleContainerMouseUp() {
    if (!isDraggingRef.current || !anchorRef.current) return;
    const anchor = anchorRef.current;
    const hover  = hoverRef.current ?? anchor;

    isDraggingRef.current = false;
    anchorRef.current     = null;
    hoverRef.current      = null;
    setDragPreview(null);

    const start   = anchor <= hover ? anchor : hover;
    const endDate = anchor <= hover ? hover  : anchor;

    // Toggle: re-clicking the already-selected single day → revert to month range
    if (
      isSameDay(start, endDate) &&
      dateRange &&
      isSameDay(dateRange.start, dateRange.end) &&
      isSameDay(start, dateRange.start)
    ) {
      if (selectedMonth !== null) {
        onDateRangeChange({
          start: new Date(year, selectedMonth, 1),
          end:   new Date(year, selectedMonth + 1, 0),
        });
      } else {
        onDateRangeChange(null);
      }
      setAnchorDate(null);
    } else {
      setAnchorDate(start);
      onDateRangeChange({ start, end: endDate });
    }
  }

  // Clear day selection → revert to month range (keep month selected)
  function handleClear() {
    if (selectedMonth !== null) {
      onDateRangeChange({ start: new Date(year, selectedMonth, 1), end: new Date(year, selectedMonth + 1, 0) });
    } else {
      onDateRangeChange(null);
    }
    setAnchorDate(null);
    isDraggingRef.current = false;
    anchorRef.current     = null;
    hoverRef.current      = null;
    setDragPreview(null);
  }

  // Show "Clear" only when a specific day range is active (not the whole month)
  const isDaySelected =
    dateRange !== null &&
    selectedMonth !== null &&
    !(
      isSameDay(dateRange.start, new Date(year, selectedMonth, 1)) &&
      isSameDay(dateRange.end, new Date(year, selectedMonth + 1, 0))
    );

  const isActiveDrag = !!dragPreview;

  // Footer text
  let footerText: string;
  if (isActiveDrag && dragPreview) {
    const s = dragPreview.start.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
    const e = dragPreview.end.toLocaleDateString("en-GB",   { day: "numeric", month: "short" });
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
      {/* Year nav — compact, left-aligned, not stretched */}
      <div className="inline-flex items-center gap-1 mb-1">
        <button
          type="button"
          onClick={() => changeYear(year - 1)}
          aria-label="Previous year"
          className="rounded border border-gray-300 bg-white px-1.5 py-0.5 text-xs text-gray-500 hover:bg-gray-50 transition leading-none"
        >
          ‹
        </button>
        <span className="text-xs font-semibold text-gray-700 tabular-nums px-0.5">
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

            const hex       = DAY_HEX[day.getDay()];
            const key       = toKey(day);
            const count     = eventDayCounts.get(key) ?? 0;
            const hasEvents = count > 0;
            const isToday   = todayKey !== "" && key === todayKey;

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
              bg         = hex;
              color      = "#ffffff";
              fontWeight = "700";
            } else if (inRange) {
              bg = hex + "50";
            } else if (hasEvents) {
              bg = hex + "30";
            } else {
              bg = "transparent";
            }

            const showConnector = inRange || isStart || isEnd;

            // Inline count: "15" or "15 (3)"
            const dayLabel = hasEvents ? `${day.getDate()} (${count})` : String(day.getDate());

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
                  className={`relative z-10 w-full text-center text-xs py-0.5 rounded transition leading-none ${
                    isToday ? "ring-1 ring-inset ring-gray-400" : ""
                  } ${
                    !hasEvents && !isStart && !isEnd && !inRange
                      ? "opacity-25"
                      : "cursor-pointer hover:opacity-80"
                  }`}
                  style={{ backgroundColor: bg, color, fontWeight }}
                >
                  {dayLabel}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Footer status + clear */}
      <div className="mt-1 flex items-center justify-between text-xs">
        <div role="status" aria-live="polite" aria-atomic="true">
          <span className={isActiveDrag ? "text-indigo-600 font-medium" : "text-gray-400"}>
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
