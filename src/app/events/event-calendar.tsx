"use client";

import { useMemo, useState } from "react";
import { DAY_HEX } from "@/lib/day-utils";
import type { EventSummary } from "@/types";

// ── Helpers ───────────────────────────────────────────────────────────────────

function stripTime(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function toKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function buildDays(year: number, month: number): (Date | null)[] {
  // Mon-first grid
  const firstCol = (new Date(year, month, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = Array(firstCol).fill(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

// Mon-first column → JS day-of-week (0=Sun)
const COL_DOW = [1, 2, 3, 4, 5, 6, 0];
const DOW_HEADER = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  /** All events currently in scope (status-filtered) — used to mark event days. */
  events: EventSummary[];
  selectedDate: Date | null;
  onSelectDate: (d: Date | null) => void;
}

export function EventCalendar({ events, selectedDate, onSelectDate }: Props) {
  const today = useMemo(() => stripTime(new Date()), []);
  const currentYear = today.getFullYear();

  const [year, setYear] = useState(() => selectedDate?.getFullYear() ?? currentYear);
  const [month, setMonth] = useState(() => selectedDate?.getMonth() ?? today.getMonth());

  const years = useMemo(
    () => Array.from({ length: 7 }, (_, i) => currentYear - 3 + i),
    [currentYear],
  );

  // Build Set of "YYYY-M-D" keys that have at least one event
  const eventDayKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const e of events) {
      const dt = new Date(e.nextOccurrence?.dateTime ?? e.dateTime);
      keys.add(toKey(dt));
    }
    return keys;
  }, [events]);

  const cells = useMemo(() => buildDays(year, month), [year, month]);

  const selectedKey = selectedDate ? toKey(stripTime(selectedDate)) : null;
  const todayKey = toKey(today);

  return (
    <div className="flex-shrink-0 border-b border-gray-100 bg-white px-3 pt-2 pb-1.5">

      {/* Year pills + Clear button */}
      <div className="flex items-center gap-1 flex-wrap mb-1">
        {years.map((y) => (
          <button
            key={y}
            type="button"
            onClick={() => setYear(y)}
            className={`rounded-full border px-2 py-0.5 text-xs font-medium transition ${
              year === y
                ? "bg-indigo-600 text-white border-indigo-600"
                : "border-gray-300 bg-white text-gray-500 hover:bg-gray-50"
            }`}
          >
            {y}
          </button>
        ))}
        {selectedDate && (
          <button
            type="button"
            onClick={() => onSelectDate(null)}
            className="ml-auto rounded-full border border-gray-200 px-2 py-0.5 text-xs text-gray-400 hover:text-red-500 hover:border-red-300 transition"
          >
            Clear
          </button>
        )}
      </div>

      {/* Month pills */}
      <div className="flex items-center gap-1 flex-wrap mb-1.5">
        {MONTH_ABBR.map((name, m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMonth(m)}
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

          const hex = DAY_HEX[day.getDay()];
          const key = toKey(day);
          const hasEvents = eventDayKeys.has(key);
          const isSelected = key === selectedKey;
          const isToday = key === todayKey;

          let bg: string;
          let color: string | undefined;

          if (isSelected) {
            bg = hex;
            color = "#ffffff";
          } else if (hasEvents) {
            bg = hex + "35";
          } else {
            bg = "transparent";
          }

          return (
            <button
              key={idx}
              type="button"
              onClick={() => hasEvents ? onSelectDate(isSelected ? null : day) : undefined}
              className={`text-center text-xs rounded py-0.5 transition ${
                hasEvents
                  ? "cursor-pointer hover:opacity-75"
                  : "cursor-default opacity-20 pointer-events-none"
              } ${isToday ? "ring-1 ring-inset ring-gray-400" : ""}`}
              style={{
                backgroundColor: bg,
                color,
                fontWeight: isSelected ? "700" : "500",
              }}
            >
              {day.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}
