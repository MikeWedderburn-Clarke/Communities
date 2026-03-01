"use client";

interface BreadcrumbItem {
  label: string;
  action?: () => void;
  active?: boolean;
}

interface Props {
  items: BreadcrumbItem[];
}

export function BreadcrumbNav({ items }: Props) {
  return (
    <nav className="flex flex-wrap items-center gap-2 text-sm" aria-label="Location breadcrumbs">
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        return (
          <span key={item.label + index} className="flex items-center gap-2">
            {item.action && !isLast ? (
              <button
                type="button"
                onClick={item.action}
                className="rounded-full border border-gray-200 px-3 py-1 text-xs font-semibold text-indigo-600 hover:bg-indigo-50"
              >
                {item.label}
              </button>
            ) : (
              <span className={`px-2 py-1 text-xs font-semibold ${isLast ? "text-gray-900" : "text-gray-500"}`}>
                {item.label}
              </span>
            )}
            {index < items.length - 1 && <span className="text-gray-300">›</span>}
          </span>
        );
      })}
    </nav>
  );
}
