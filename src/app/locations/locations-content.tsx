"use client";

import { DataTable, type ColumnDef } from "@/components/data-table";
import type { LocationRow } from "@/types";

interface Props {
  locations: LocationRow[];
}

const COLUMNS: ColumnDef<LocationRow>[] = [
  {
    key: "id",
    label: "ID",
    filter: { kind: "text" },
    render: (row) => <span className="font-mono text-xs text-gray-600">{row.id}</span>,
  },
  {
    key: "name",
    label: "Name",
    filter: { kind: "text" },
    render: (row) => <span className="font-medium text-gray-900">{row.name}</span>,
  },
  {
    key: "city",
    label: "City",
    filter: { kind: "text" },
  },
  {
    key: "country",
    label: "Country",
    filter: { kind: "text" },
  },
  {
    key: "latitude",
    label: "Latitude",
    filter: { kind: "numeric-range" },
    value: (row) => row.latitude,
    render: (row) => row.latitude.toFixed(5),
  },
  {
    key: "longitude",
    label: "Longitude",
    filter: { kind: "numeric-range" },
    value: (row) => row.longitude,
    render: (row) => row.longitude.toFixed(5),
  },
  {
    key: "what3names",
    label: "What3Names",
    filter: { kind: "text" },
    render: (row) => row.what3names ?? "—",
  },
  {
    key: "howToFind",
    label: "How to Find",
    filter: { kind: "text" },
    render: (row) =>
      row.howToFind ? (
        <span className="block max-w-xs truncate text-gray-600" title={row.howToFind}>
          {row.howToFind}
        </span>
      ) : (
        "—"
      ),
  },
  {
    key: "createdByName",
    label: "Created By",
    filter: { kind: "text" },
    value: (row) => row.createdByName ?? "",
    render: (row) => row.createdByName ?? "—",
  },
];

export function LocationsContent({ locations }: Props) {
  return (
    <div className="mt-6">
      <DataTable columns={COLUMNS} rows={locations} rowKey={(row) => row.id} />
    </div>
  );
}
