"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { DAY_HEX } from "@/lib/day-utils";
import { getOccurrenceDatesInMonth } from "@/lib/event-utils";
import type { EventSummary } from "@/types";
import type { CountMode } from "./events-content";

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
  /** Status+date-filtered events — used for day occurrence counts in the grid. */
  events: EventSummary[];
  /** Status-filtered (not date-filtered) events — used for year/month occurrence counts. */
  allEvents: EventSummary[];
  dateRange: DateRange | null;
  onDateRangeChange: (r: DateRange | null) => void;
  countMode: CountMode;
}

export function EventCalendar({ events, allEvents, dateRange, onDateRangeChange, countMode }: Props) {
  const currentYear = new Date().getFullYear();

  // todayKey computed client-side only — avoids SSR/client hydration mismatch.
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

  // daySelectionActive: true only when the user has explicitly clicked/dragged
  // days. When false, the day grid shows event markers but no selection box.
  const [daySelectionActive, setDaySelectionActive] = useState(false);

  // Anchor for shift+click — plain state is fine here (two separate clicks).
  const [anchorDate, setAnchorDate] = useState<Date | null>(null);

  // Drag state stored in refs to avoid stale-closure bug:
  // mousedown and mouseup can fire within the same browser task before React
  // re-renders, so handlers must read refs instead of state.
  const isDraggingRef = useRef(false);
  const anchorRef     = useRef<Date | null>(null);
  const hoverRef      = useRef<Date | null>(null);

  // Separate state drives the visual drag preview (triggers re-render).
  const [dragPreview, setDragPreview] = useState<DateRange | null>(null);

  // On mount: emit year range if none set.
  useEffect(() => {
    if (!dateRange) {
      onDateRangeChange({ start: new Date(year, 0, 1), end: new Date(year, 11, 31) });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Month occurrence counts (allEvents, all 12 months) ────────────────────
  // In "instances" mode: total occurrences. In "events" mode: unique events with ≥1 occurrence.
  const monthCounts = useMemo(() => {
    const counts = new Array<number>(12).fill(0);
    for (const e of allEvents) {
      for (let m = 0; m < 12; m++) {
        const n = getOccurrenceDatesInMonth(e, year, m).length;
        counts[m] += countMode === "instances" ? n : (n > 0 ? 1 : 0);
      }
    }
    return counts;
  }, [allEvents, year, countMode]);

  const yearCount = useMemo(
    () => monthCounts.reduce((a, b) => a + b, 0),
    [monthCounts],
  );

  // ── Day occurrence counts (events — already filtered to this month) ────────
  // Day counts are the same regardless of countMode: each day's count is how many
  // events occur on that specific date, which does not aggregate across a month.
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

  // Preview: drag preview during drag; committed selection only when a day was
  // explicitly selected. When just a month is selected (no day), preview = null
  // so no days are highlighted.
  const preview: DateRange | null = dragPreview ?? (daySelectionActive ? dateRange : null);

  // ── Year navigation ────────────────────────────────────────────────────────

  function changeYear(newYear: number) {
    setYear(newYear);
    setSelectedMonth(null);
    setDaySelectionActive(false);
    setAnchorDate(null);
    isDraggingRef.current = false;
    anchorRef.current     = null;
    hoverRef.current      = null;
    setDragPreview(null);
    onDateRangeChange({ start: new Date(newYear, 0, 1), end: new Date(newYear, 11, 31) });
  }

  // ── Month toggle ───────────────────────────────────────────────────────────

  function handleMonthToggle(m: number) {
    setDaySelectionActive(false);
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
        setDaySelectionActive(true);
        onDateRangeChange({ start, end });
      } else {
        setAnchorDate(day);
        setDaySelectionActive(true);
        onDateRangeChange({ start: day, end: day });
      }
      return;
    }
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

  // Commit selection — reads refs so always current regardless of render timing.
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

    // Toggle: re-clicking the already-selected single day → clear day selection
    if (
      daySelectionActive &&
      isSameDay(start, endDate) &&
      dateRange &&
      isSameDay(dateRange.start, dateRange.end) &&
      isSameDay(start, dateRange.start)
    ) {
      setDaySelectionActive(false);
      setAnchorDate(null);
      if (selectedMonth !== null) {
        onDateRangeChange({
          start: new Date(year, selectedMonth, 1),
          end:   new Date(year, selectedMonth + 1, 0),
        });
      }
    } else {
      setDaySelectionActive(true);
      setAnchorDate(start);
      onDateRangeChange({ start, end: endDate });
    }
  }

  // Clear: revert to month range (or year range if no month selected)
  function handleClear() {
    setDaySelectionActive(false);
    setAnchorDate(null);
    isDraggingRef.current = false;
    anchorRef.current     = null;
    hoverRef.current      = null;
    setDragPreview(null);
    if (selectedMonth !== null) {
      onDateRangeChange({ start: new Date(year, selectedMonth, 1), end: new Date(year, selectedMonth + 1, 0) });
    } else {
      onDateRangeChange(null);
    }
  }

  // "Clear" shown only when the user has explicitly selected specific days
  const isDaySelected = daySelectionActive && selectedMonth !== null;

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
      {/* Year nav — compact, left-aligned */}
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

            const isSelected = isStart || isEnd || inRange;

            // Selection box: faint indigo wash on all selected cells;
            // border ring on start/end to draw the box boundary.
            // Event colour only shown for days not inside a selection.
            const containerBg = isSelected ? "rgba(99,102,241,0.08)" : undefined;
            const buttonBg    = !isSelected && hasEvents ? hex + "30" : "transparent";

            const isSingleDay = preview
              ? isSameDay(preview.start, preview.end) && isStart && isEnd
              : false;

            const buttonRing =
              isStart || isEnd
                ? isSingleDay
                  ? "ring-1 ring-inset ring-indigo-300 rounded"
                  : isStart
                    ? "ring-1 ring-inset ring-indigo-300 rounded-l"
                    : "ring-1 ring-inset ring-indigo-300 rounded-r"
                : "";

            const dayLabel = hasEvents
              ? `${day.getDate()} (${count})`
              : String(day.getDate());

            return (
              <div
                key={idx}
                className="relative"
                style={{ backgroundColor: containerBg }}
              >
                <button
                  type="button"
                  onMouseDown={(e) => handleDayMouseDown(day, e)}
                  onMouseEnter={() => handleDayMouseEnter(day)}
                  aria-label={`${day.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}${hasEvents ? `, ${count} event${count !== 1 ? "s" : ""}` : ""}${isSelected ? ", selected" : ""}`}
                  className={`relative z-10 w-full text-center text-xs py-0.5 rounded transition leading-none ${
                    isToday ? "ring-1 ring-inset ring-gray-400" : ""
                  } ${buttonRing} ${
                    !hasEvents && !isSelected
                      ? "opacity-25"
                      : "cursor-pointer hover:opacity-80"
                  }`}
                  style={{
                    backgroundColor: buttonBg,
                    fontWeight: isStart || isEnd ? "600" : "500",
                  }}
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
