"use client";

import { useState, useMemo, type ReactNode } from "react";

// ── Column definition ─────────────────────────────────────────────

export type FilterType =
  | { kind: "text" }
  | { kind: "select"; options: string[] }
  | { kind: "boolean" }
  | { kind: "date-range" }
  | { kind: "numeric-range" };

export interface ColumnDef<T> {
  key: string;
  label: string;
  filter?: FilterType;
  sortable?: boolean;
  render?: (row: T) => ReactNode;
  /** Extract the raw value used for filtering/sorting when no render is provided */
  value?: (row: T) => string | number | boolean | null | undefined;
}

// ── Filter state ──────────────────────────────────────────────────

type FilterValue =
  | string
  | { min: string; max: string }
  | { minNum: string; maxNum: string }
  | boolean
  | null;

type FilterState = Record<string, FilterValue>;

// ── Helpers ───────────────────────────────────────────────────────

function getDisplayValue<T>(row: T, col: ColumnDef<T>): string {
  if (col.value) {
    const v = col.value(row);
    if (v == null) return "";
    return String(v);
  }
  const raw = (row as Record<string, unknown>)[col.key];
  if (raw == null) return "";
  return String(raw);
}

function matchesFilter<T>(row: T, col: ColumnDef<T>, filter: FilterValue): boolean {
  if (filter == null || filter === "") return true;
  const raw = col.value ? col.value(row) : (row as Record<string, unknown>)[col.key];

  if (!col.filter) return true;

  if (col.filter.kind === "text") {
    return String(raw ?? "")
      .toLowerCase()
      .includes(String(filter).toLowerCase());
  }

  if (col.filter.kind === "select") {
    if (filter === "") return true;
    return String(raw ?? "") === String(filter);
  }

  if (col.filter.kind === "boolean") {
    if (filter === null) return true;
    return Boolean(raw) === Boolean(filter);
  }

  if (col.filter.kind === "date-range") {
    const range = filter as { min: string; max: string };
    if (!range.min && !range.max) return true;
    const val = String(raw ?? "").substring(0, 10); // "YYYY-MM-DD"
    if (range.min && val < range.min) return false;
    if (range.max && val > range.max) return false;
    return true;
  }

  if (col.filter.kind === "numeric-range") {
    const range = filter as { minNum: string; maxNum: string };
    if (!range.minNum && !range.maxNum) return true;
    const num = raw == null ? null : Number(raw);
    if (num == null || isNaN(num)) return false;
    if (range.minNum !== "" && num < Number(range.minNum)) return false;
    if (range.maxNum !== "" && num > Number(range.maxNum)) return false;
    return true;
  }

  return true;
}

function isFilterActive(filter: FilterValue): boolean {
  if (filter == null || filter === "") return false;
  if (typeof filter === "object") {
    if ("min" in filter) return Boolean(filter.min || filter.max);
    if ("minNum" in filter) return Boolean(filter.minNum || filter.maxNum);
  }
  return true;
}

const PAGE_SIZE = 50;

// ── Main component ────────────────────────────────────────────────

interface DataTableProps<T> {
  columns: ColumnDef<T>[];
  rows: T[];
  /** Optional row key extractor; defaults to row index */
  rowKey?: (row: T) => string | number;
}

export function DataTable<T>({ columns, rows, rowKey }: DataTableProps<T>) {
  const [filters, setFilters] = useState<FilterState>({});
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const activeFilterCount = useMemo(
    () => Object.values(filters).filter(isFilterActive).length,
    [filters],
  );

  // Apply filters
  const filtered = useMemo(() => {
    return rows.filter((row) =>
      columns.every((col) => {
        const f = filters[col.key];
        return matchesFilter(row, col, f ?? null);
      }),
    );
  }, [rows, columns, filters]);

  // Apply sort
  const sorted = useMemo(() => {
    if (!sortCol) return filtered;
    const col = columns.find((c) => c.key === sortCol);
    if (!col) return filtered;
    return [...filtered].sort((a, b) => {
      const av = getDisplayValue(a, col);
      const bv = getDisplayValue(b, col);
      const cmp = av.localeCompare(bv, undefined, { numeric: true, sensitivity: "base" });
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [filtered, sortCol, sortDir, columns]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const pageRows = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return sorted.slice(start, start + PAGE_SIZE);
  }, [sorted, page]);

  function handleSort(key: string) {
    if (sortCol === key) {
      if (sortDir === "asc") setSortDir("desc");
      else { setSortCol(null); }
    } else {
      setSortCol(key);
      setSortDir("asc");
    }
    setPage(1);
  }

  function setFilter(key: string, value: FilterValue) {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  }

  function clearFilters() {
    setFilters({});
    setPage(1);
  }

  return (
    <div className="space-y-3">
      {/* Collapsible filters */}
      <details
        open={filtersOpen}
        onToggle={(e) => setFiltersOpen((e.target as HTMLDetailsElement).open)}
        className="rounded-lg border border-gray-200 bg-white"
      >
        <summary className="flex cursor-pointer select-none items-center gap-2 px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50">
          <svg
            className={`h-4 w-4 text-gray-400 transition-transform ${filtersOpen ? "rotate-90" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          Filters
          {activeFilterCount > 0 && (
            <span className="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-indigo-600 px-1.5 text-[11px] font-bold text-white">
              {activeFilterCount}
            </span>
          )}
          {activeFilterCount > 0 && (
            <button
              type="button"
              onClick={(e) => { e.preventDefault(); clearFilters(); }}
              className="ml-auto text-xs text-gray-400 hover:text-red-500"
            >
              Clear all
            </button>
          )}
        </summary>

        <div className="border-t border-gray-100 p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {columns
              .filter((col) => col.filter)
              .map((col) => (
                <FilterInput
                  key={col.key}
                  col={col}
                  value={filters[col.key] ?? null}
                  onChange={(v) => setFilter(col.key, v)}
                />
              ))}
          </div>
        </div>
      </details>

      {/* Row count + pagination info */}
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>
          {filtered.length === rows.length
            ? `${rows.length} rows`
            : `${filtered.length} of ${rows.length} rows`}
        </span>
        {totalPages > 1 && (
          <span>
            Page {page} / {totalPages}
          </span>
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  scope="col"
                  onClick={col.sortable !== false ? () => handleSort(col.key) : undefined}
                  className={`whitespace-nowrap px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 ${
                    col.sortable !== false ? "cursor-pointer select-none hover:bg-gray-100" : ""
                  }`}
                >
                  <span className="flex items-center gap-1">
                    {col.label}
                    {col.sortable !== false && sortCol === col.key && (
                      <span className="text-indigo-600">
                        {sortDir === "asc" ? "↑" : "↓"}
                      </span>
                    )}
                    {col.sortable !== false && sortCol !== col.key && (
                      <span className="text-gray-300">↕</span>
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {pageRows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-3 py-8 text-center text-sm text-gray-400"
                >
                  No rows match the current filters.
                </td>
              </tr>
            ) : (
              pageRows.map((row, idx) => (
                <tr
                  key={rowKey ? rowKey(row) : idx}
                  className="hover:bg-gray-50"
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className="max-w-xs truncate whitespace-nowrap px-3 py-2 text-gray-700"
                      title={getDisplayValue(row, col)}
                    >
                      {col.render ? col.render(row) : getDisplayValue(row, col)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="rounded border border-gray-300 px-3 py-1 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40"
          >
            Previous
          </button>
          <span className="text-sm text-gray-500">
            {page} / {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className="rounded border border-gray-300 px-3 py-1 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

// ── Filter input sub-component ────────────────────────────────────

function FilterInput<T>({
  col,
  value,
  onChange,
}: {
  col: ColumnDef<T>;
  value: FilterValue;
  onChange: (v: FilterValue) => void;
}) {
  if (!col.filter) return null;

  const labelCls = "block text-xs font-medium text-gray-600 mb-1";
  const inputCls =
    "w-full rounded border border-gray-300 px-2 py-1 text-xs focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400";

  if (col.filter.kind === "text") {
    return (
      <div>
        <label className={labelCls}>{col.label}</label>
        <input
          type="text"
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value || null)}
          placeholder={`Filter ${col.label}…`}
          className={inputCls}
        />
      </div>
    );
  }

  if (col.filter.kind === "select") {
    return (
      <div>
        <label className={labelCls}>{col.label}</label>
        <select
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value || null)}
          className={inputCls}
        >
          <option value="">All</option>
          {col.filter.options.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      </div>
    );
  }

  if (col.filter.kind === "boolean") {
    return (
      <div>
        <label className={labelCls}>{col.label}</label>
        <select
          value={value === null ? "" : value ? "true" : "false"}
          onChange={(e) =>
            onChange(e.target.value === "" ? null : e.target.value === "true")
          }
          className={inputCls}
        >
          <option value="">All</option>
          <option value="true">Yes</option>
          <option value="false">No</option>
        </select>
      </div>
    );
  }

  if (col.filter.kind === "date-range") {
    const range =
      value && typeof value === "object" && "min" in value
        ? (value as { min: string; max: string })
        : { min: "", max: "" };
    return (
      <div>
        <label className={labelCls}>{col.label}</label>
        <div className="flex gap-1">
          <input
            type="date"
            value={range.min}
            onChange={(e) => onChange({ min: e.target.value, max: range.max })}
            className={inputCls}
            title="From"
          />
          <input
            type="date"
            value={range.max}
            onChange={(e) => onChange({ min: range.min, max: e.target.value })}
            className={inputCls}
            title="To"
          />
        </div>
      </div>
    );
  }

  if (col.filter.kind === "numeric-range") {
    const range =
      value && typeof value === "object" && "minNum" in value
        ? (value as { minNum: string; maxNum: string })
        : { minNum: "", maxNum: "" };
    return (
      <div>
        <label className={labelCls}>{col.label}</label>
        <div className="flex gap-1">
          <input
            type="number"
            value={range.minNum}
            onChange={(e) => onChange({ minNum: e.target.value, maxNum: range.maxNum })}
            placeholder="Min"
            className={inputCls}
          />
          <input
            type="number"
            value={range.maxNum}
            onChange={(e) => onChange({ minNum: range.minNum, maxNum: e.target.value })}
            placeholder="Max"
            className={inputCls}
          />
        </div>
      </div>
    );
  }

  return null;
}
