import type { RoleCounts } from "@/types";

const ROLE_COLORS: Record<string, string> = {
  Base: "bg-blue-100 text-blue-800",
  Flyer: "bg-purple-100 text-purple-800",
  Hybrid: "bg-green-100 text-green-800",
  Spotter: "bg-amber-100 text-amber-800",
};

export function RoleBadges({ roleCounts }: { roleCounts: RoleCounts }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {(Object.entries(roleCounts) as [string, number][])
        .filter(([, count]) => count > 0)
        .map(([role, count]) => (
          <span
            key={role}
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${ROLE_COLORS[role] ?? "bg-gray-100 text-gray-800"}`}
          >
            {count} {role}{count !== 1 ? "s" : ""}
          </span>
        ))}
    </div>
  );
}
