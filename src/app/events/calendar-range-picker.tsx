"use client";

import { useState } from "react";
import { DAY_HEX } from "@/lib/day-utils";

export interface DateRange {
  start: Date;
  end: Date;
}

interface Props {
  range: DateRange | null;
  onChange: (range: DateRange | null) => void;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function stripTime(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

function buildDays(year: number, month: number): (Date | null)[] {
  // Mon-first: firstCol = (getDay() + 6) % 7
  const firstCol = (new Date(year, month, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = Array(firstCol).fill(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

// JS day of week (0=Sun) for Mon-first column index 0-6
const COL_DOW = [1, 2, 3, 4, 5, 6, 0];
const DOW_HEADER = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

// ── Single-month sub-component ────────────────────────────────────────────────

interface MonthProps {
  year: number;
  month: number;
  today: Date;
  preview: DateRange | null;
  pendingStart: Date | null;
  hoverDate: Date | null;
  onDayClick: (d: Date) => void;
  onDayEnter: (d: Date) => void;
  onDayLeave: () => void;
}

function CalendarMonth({ year, month, today, preview, pendingStart, hoverDate, onDayClick, onDayEnter, onDayLeave }: MonthProps) {
  const cells = buildDays(year, month);
  const monthLabel = new Date(year, month, 1).toLocaleDateString("en-GB", { month: "long", year: "numeric" });

  return (
    <div className="w-56 flex-shrink-0">
      {/* Month label */}
      <p className="text-center text-sm font-semibold text-gray-700 mb-2">{monthLabel}</p>

      {/* Day-of-week headers */}
      <div className="grid grid-cols-7 gap-px mb-px">
        {DOW_HEADER.map((lbl, i) => {
          const hex = DAY_HEX[COL_DOW[i]];
          return (
            <div
              key={i}
              className="text-center text-xs font-bold py-0.5 rounded-sm"
              style={{ backgroundColor: hex + "30", color: hex }}
            >
              {lbl}
            </div>
          );
        })}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7 gap-px">
        {cells.map((day, idx) => {
          if (!day) return <div key={idx} className="py-1" />;

          const hex = DAY_HEX[day.getDay()];
          const isToday = isSameDay(day, today);
          const isPendingStart = pendingStart !== null && isSameDay(day, pendingStart);

          // Determine highlight state
          let isStart = false;
          let isEnd = false;
          let inRange = false;

          if (preview) {
            isStart = isSameDay(day, preview.start);
            isEnd = isSameDay(day, preview.end);
            inRange = !isStart && !isEnd &&
              day.getTime() > preview.start.getTime() &&
              day.getTime() < preview.end.getTime();
          } else if (isPendingStart && !hoverDate) {
            isStart = true;
          }

          let bg: string;
          let color: string | undefined;
          let fontWeight = "500";

          if (isStart || isEnd) {
            bg = hex;
            color = "#ffffff";
            fontWeight = "700";
          } else if (inRange) {
            bg = hex + "55";
            color = undefined;
          } else if (isPendingStart) {
            bg = hex;
            color = "#ffffff";
            fontWeight = "700";
          } else {
            bg = hex + "20";
            color = undefined;
          }

          // Edge connectors: extend range highlight to edges for start/in-range/end
          const showLeftEdge = (inRange || isEnd) && !isSameDay(day, new Date(year, month, 1));
          const showRightEdge = (inRange || isStart) && day.getDate() < new Date(year, month + 1, 0).getDate();

          return (
            <div key={idx} className="relative" style={{ backgroundColor: inRange || (preview && (isStart || isEnd)) ? hex + "18" : undefined }}>
              <button
                type="button"
                onClick={() => onDayClick(day)}
                onMouseEnter={() => onDayEnter(day)}
                onMouseLeave={onDayLeave}
                className={`relative z-10 w-full text-center text-xs py-1 rounded cursor-pointer transition-colors ${
                  isToday ? "ring-1 ring-inset ring-gray-500" : ""
                }`}
                style={{ backgroundColor: bg, color, fontWeight }}
              >
                {day.getDate()}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main picker ───────────────────────────────────────────────────────────────

export function CalendarRangePicker({ range, onChange }: Props) {
  const today = stripTime(new Date());

  // leftYear/leftMonth = the left calendar panel
  const [leftYear, setLeftYear] = useState(today.getFullYear());
  const [leftMonth, setLeftMonth] = useState(today.getMonth());

  const [pendingStart, setPendingStart] = useState<Date | null>(null);
  const [hoverDate, setHoverDate] = useState<Date | null>(null);

  // Right panel = one month ahead
  const rightMonth = leftMonth === 11 ? 0 : leftMonth + 1;
  const rightYear = leftMonth === 11 ? leftYear + 1 : leftYear;

  function prevMonth() {
    if (leftMonth === 0) { setLeftMonth(11); setLeftYear(y => y - 1); }
    else setLeftMonth(m => m - 1);
  }
  function nextMonth() {
    if (leftMonth === 11) { setLeftMonth(0); setLeftYear(y => y + 1); }
    else setLeftMonth(m => m + 1);
  }
  function goToToday() {
    setLeftYear(today.getFullYear());
    setLeftMonth(today.getMonth());
  }

  function handleDayClick(day: Date) {
    if (!pendingStart) {
      // First click: set pending start
      setPendingStart(day);
    } else {
      // Second click: complete the range
      const start = pendingStart.getTime() <= day.getTime() ? pendingStart : day;
      const end   = pendingStart.getTime() <= day.getTime() ? day : pendingStart;
      onChange({ start, end });
      setPendingStart(null);
      setHoverDate(null);
    }
  }

  function handleDayEnter(day: Date) {
    if (pendingStart) setHoverDate(day);
  }

  function handleDayLeave() {
    setHoverDate(null);
  }

  function clear() {
    onChange(null);
    setPendingStart(null);
    setHoverDate(null);
  }

  // The range being actively previewed (hover or committed)
  const preview: DateRange | null =
    pendingStart && hoverDate
      ? {
          start: pendingStart.getTime() <= hoverDate.getTime() ? pendingStart : hoverDate,
          end:   pendingStart.getTime() <= hoverDate.getTime() ? hoverDate   : pendingStart,
        }
      : range;

  // ── Footer label ──────────────────────────────────────────────────
  let footerText: string;
  if (pendingStart && !hoverDate) {
    footerText = `From ${pendingStart.toLocaleDateString("en-GB", { day: "numeric", month: "short" })} — click end date`;
  } else if (pendingStart && hoverDate) {
    const r = preview!;
    footerText = `${r.start.toLocaleDateString("en-GB", { day: "numeric", month: "short" })} → ${r.end.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`;
  } else if (range) {
    const sameYear = range.start.getFullYear() === range.end.getFullYear();
    const startStr = range.start.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: sameYear ? undefined : "numeric" });
    const endStr   = range.end.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
    footerText = isSameDay(range.start, range.end) ? startStr : `${startStr} – ${endStr}`;
  } else {
    footerText = "Click a day to start selection";
  }

  return (
    <div
      className="mt-2 inline-flex flex-col gap-3 rounded-lg border border-gray-200 bg-white p-3 shadow-sm"
      style={{ userSelect: "none" }}
    >
      {/* Navigation bar */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={prevMonth}
          className="flex h-7 w-7 items-center justify-center rounded text-lg text-gray-500 hover:bg-gray-100"
          title="Previous month"
        >‹</button>

        <div className="flex flex-1 gap-4">
          {/* Two month panels */}
          <CalendarMonth
            year={leftYear} month={leftMonth}
            today={today} preview={preview}
            pendingStart={pendingStart} hoverDate={hoverDate}
            onDayClick={handleDayClick} onDayEnter={handleDayEnter} onDayLeave={handleDayLeave}
          />
          <div className="w-px self-stretch bg-gray-100" />
          <CalendarMonth
            year={rightYear} month={rightMonth}
            today={today} preview={preview}
            pendingStart={pendingStart} hoverDate={hoverDate}
            onDayClick={handleDayClick} onDayEnter={handleDayEnter} onDayLeave={handleDayLeave}
          />
        </div>

        <button
          type="button"
          onClick={nextMonth}
          className="flex h-7 w-7 items-center justify-center rounded text-lg text-gray-500 hover:bg-gray-100"
          title="Next month"
        >›</button>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-gray-100 pt-2 text-xs">
        <span className={`${pendingStart ? "text-indigo-600 font-medium" : "text-gray-500"}`}>
          {footerText}
        </span>
        <div className="flex items-center gap-3 ml-4">
          <button
            type="button"
            onClick={goToToday}
            className="text-gray-400 hover:text-indigo-600 transition-colors"
          >
            Today
          </button>
          {(range || pendingStart) && (
            <button
              type="button"
              onClick={clear}
              className="text-gray-400 hover:text-red-500 transition-colors"
            >
              Clear
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
