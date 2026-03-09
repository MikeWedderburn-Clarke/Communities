"use client";

import Link from "next/link";
import { DataTable, type ColumnDef } from "@/components/data-table";
import type { EventRow } from "@/types";
import {
  RECURRENCE_FREQUENCIES,
  SKILL_LEVELS,
  EVENT_CATEGORIES,
  EVENT_STATUSES,
  CURRENCIES,
} from "@/types";

interface Props {
  events: EventRow[];
}

const STATUS_BADGE: Record<string, string> = {
  approved: "bg-green-100 text-green-800",
  pending: "bg-yellow-100 text-yellow-800",
  rejected: "bg-red-100 text-red-800",
};

const COLUMNS: ColumnDef<EventRow>[] = [
  {
    key: "id",
    label: "ID",
    filter: { kind: "text" },
    render: (row) => (
      <Link href={`/events/${row.id}`} className="font-mono text-xs text-indigo-600 hover:underline">
        {row.id}
      </Link>
    ),
  },
  {
    key: "title",
    label: "Title",
    filter: { kind: "text" },
    render: (row) => (
      <Link href={`/events/${row.id}`} className="font-medium text-gray-900 hover:text-indigo-600">
        {row.title}
      </Link>
    ),
  },
  {
    key: "description",
    label: "Description",
    filter: { kind: "text" },
    render: (row) => (
      <span className="block max-w-xs truncate text-gray-600" title={row.description}>
        {row.description}
      </span>
    ),
  },
  {
    key: "dateTime",
    label: "Date / Time",
    filter: { kind: "date-range" },
    render: (row) => row.dateTime.replace("T", " ").substring(0, 16),
  },
  {
    key: "endDateTime",
    label: "End Date / Time",
    filter: { kind: "date-range" },
    render: (row) => row.endDateTime.replace("T", " ").substring(0, 16),
  },
  {
    key: "locationName",
    label: "Location",
    filter: { kind: "text" },
    value: (row) => row.locationName,
  },
  {
    key: "status",
    label: "Status",
    filter: { kind: "select", options: [...EVENT_STATUSES] },
    render: (row) => (
      <span
        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize ${STATUS_BADGE[row.status] ?? "bg-gray-100 text-gray-700"}`}
      >
        {row.status}
      </span>
    ),
  },
  {
    key: "createdByName",
    label: "Created By",
    filter: { kind: "text" },
    value: (row) => row.createdByName ?? "",
  },
  {
    key: "dateAdded",
    label: "Date Added",
    filter: { kind: "date-range" },
    render: (row) => row.dateAdded.substring(0, 10),
  },
  {
    key: "lastUpdated",
    label: "Last Updated",
    filter: { kind: "date-range" },
    render: (row) => row.lastUpdated.substring(0, 10),
  },
  {
    key: "recurrenceType",
    label: "Recurrence",
    filter: { kind: "select", options: [...RECURRENCE_FREQUENCIES] },
  },
  {
    key: "recurrenceEndDate",
    label: "Recurrence End",
    filter: { kind: "date-range" },
    render: (row) => row.recurrenceEndDate ?? "—",
  },
  {
    key: "skillLevel",
    label: "Skill Level",
    filter: { kind: "select", options: [...SKILL_LEVELS] },
  },
  {
    key: "prerequisites",
    label: "Prerequisites",
    filter: { kind: "text" },
    render: (row) => row.prerequisites ?? "—",
  },
  {
    key: "costAmount",
    label: "Cost",
    filter: { kind: "numeric-range" },
    value: (row) => row.costAmount ?? "",
    render: (row) => (row.costAmount == null ? "—" : String(row.costAmount)),
  },
  {
    key: "costCurrency",
    label: "Currency",
    filter: { kind: "select", options: [...CURRENCIES] },
    render: (row) => row.costCurrency ?? "—",
  },
  {
    key: "concessionAmount",
    label: "Concession",
    filter: { kind: "numeric-range" },
    value: (row) => row.concessionAmount ?? "",
    render: (row) => (row.concessionAmount == null ? "—" : String(row.concessionAmount)),
  },
  {
    key: "maxAttendees",
    label: "Max Attendees",
    filter: { kind: "numeric-range" },
    value: (row) => row.maxAttendees ?? "",
    render: (row) => (row.maxAttendees == null ? "—" : String(row.maxAttendees)),
  },
  {
    key: "eventCategory",
    label: "Category",
    filter: { kind: "select", options: [...EVENT_CATEGORIES] },
    render: (row) => <span className="capitalize">{row.eventCategory}</span>,
  },
  {
    key: "isExternal",
    label: "External?",
    filter: { kind: "boolean" },
    value: (row) => row.isExternal,
    render: (row) => (row.isExternal ? "Yes" : "No"),
  },
  {
    key: "externalUrl",
    label: "External URL",
    filter: { kind: "text" },
    render: (row) =>
      row.externalUrl ? (
        <a href={row.externalUrl} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">
          {row.externalUrl}
        </a>
      ) : (
        "—"
      ),
  },
  {
    key: "posterUrl",
    label: "Poster URL",
    filter: { kind: "text" },
    render: (row) => (row.posterUrl ? row.posterUrl : "—"),
  },
];

export function EventsTable({ events }: Props) {
  return (
    <div className="mt-6">
      <DataTable
        columns={COLUMNS}
        rows={events}
        rowKey={(row) => row.id}
      />
    </div>
  );
}
