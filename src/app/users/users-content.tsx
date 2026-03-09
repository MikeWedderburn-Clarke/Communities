"use client";

import { DataTable, type ColumnDef } from "@/components/data-table";
import type { UserRow } from "@/types";
import { ROLES, PROFILE_VISIBILITY_TIERS } from "@/types";
import Link from "next/link";

interface Props {
  users: UserRow[];
  isAdmin: boolean;
}

function buildColumns(isAdmin: boolean): ColumnDef<UserRow>[] {
  const cols: ColumnDef<UserRow>[] = [
    {
      key: "id",
      label: "ID",
      filter: { kind: "text" },
      render: (row) => (
        <Link href={`/profile/${row.id}`} className="font-mono text-xs text-indigo-600 hover:underline">
          {row.id}
        </Link>
      ),
    },
    {
      key: "name",
      label: "Name",
      filter: { kind: "text" },
      render: (row) => (
        <Link href={`/profile/${row.id}`} className="font-medium text-gray-900 hover:text-indigo-600">
          {row.name}
        </Link>
      ),
    },
  ];

  if (isAdmin) {
    cols.push({
      key: "email",
      label: "Email",
      filter: { kind: "text" },
      render: (row) => row.email ?? "—",
    });
  }

  cols.push(
    {
      key: "isAdmin",
      label: "Admin?",
      filter: { kind: "boolean" },
      value: (row) => row.isAdmin,
      render: (row) => (row.isAdmin ? "Yes" : "No"),
    },
    {
      key: "isTeacherApproved",
      label: "Teacher?",
      filter: { kind: "boolean" },
      value: (row) => row.isTeacherApproved,
      render: (row) => (row.isTeacherApproved ? "Yes" : "No"),
    },
    {
      key: "teacherRequestedAt",
      label: "Teacher Requested",
      filter: { kind: "date-range" },
      render: (row) => row.teacherRequestedAt?.substring(0, 10) ?? "—",
    },
  );

  if (isAdmin) {
    cols.push({
      key: "teacherApprovedBy",
      label: "Teacher Approved By",
      filter: { kind: "text" },
      render: (row) => row.teacherApprovedBy ?? "—",
    });
  }

  cols.push(
    {
      key: "defaultRole",
      label: "Default Role",
      filter: { kind: "select", options: [...ROLES] },
      render: (row) => row.defaultRole ?? "—",
    },
    {
      key: "defaultShowName",
      label: "Show Name?",
      filter: { kind: "boolean" },
      value: (row) => row.defaultShowName ?? null,
      render: (row) => (row.defaultShowName == null ? "—" : row.defaultShowName ? "Yes" : "No"),
    },
    {
      key: "facebookUrl",
      label: "Facebook",
      filter: { kind: "text" },
      render: (row) =>
        row.facebookUrl ? (
          <a href={row.facebookUrl} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">
            Link
          </a>
        ) : (
          "—"
        ),
    },
    {
      key: "instagramUrl",
      label: "Instagram",
      filter: { kind: "text" },
      render: (row) =>
        row.instagramUrl ? (
          <a href={row.instagramUrl} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">
            Link
          </a>
        ) : (
          "—"
        ),
    },
    {
      key: "websiteUrl",
      label: "Website",
      filter: { kind: "text" },
      render: (row) =>
        row.websiteUrl ? (
          <a href={row.websiteUrl} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">
            Link
          </a>
        ) : (
          "—"
        ),
    },
    {
      key: "youtubeUrl",
      label: "YouTube",
      filter: { kind: "text" },
      render: (row) =>
        row.youtubeUrl ? (
          <a href={row.youtubeUrl} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">
            Link
          </a>
        ) : (
          "—"
        ),
    },
    {
      key: "profileVisibility",
      label: "Visibility",
      filter: { kind: "select", options: [...PROFILE_VISIBILITY_TIERS] },
    },
    {
      key: "homeCity",
      label: "Home City",
      filter: { kind: "text" },
      render: (row) => row.homeCity ?? "—",
    },
    {
      key: "useCurrentLocation",
      label: "Use Location?",
      filter: { kind: "boolean" },
      value: (row) => row.useCurrentLocation,
      render: (row) => (row.useCurrentLocation ? "Yes" : "No"),
    },
    {
      key: "lastLogin",
      label: "Last Login",
      filter: { kind: "date-range" },
      render: (row) => row.lastLogin?.substring(0, 10) ?? "—",
    },
  );

  if (isAdmin) {
    cols.push({
      key: "previousLogin",
      label: "Previous Login",
      filter: { kind: "date-range" },
      render: (row) => row.previousLogin?.substring(0, 10) ?? "—",
    });
  }

  return cols;
}

export function UsersContent({ users, isAdmin }: Props) {
  const columns = buildColumns(isAdmin);
  return (
    <div className="mt-6">
      <DataTable columns={columns} rows={users} rowKey={(row) => row.id} />
    </div>
  );
}
