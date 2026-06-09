import type { TaskStatusFilter } from "../../api/tasks.js";

const filters: ReadonlyArray<{ readonly label: string; readonly value: TaskStatusFilter }> = [
  { label: "All", value: "all" },
  { label: "Active", value: "active" },
  { label: "Completed", value: "completed" },
];

export function StatusFilterTabs({
  onChange,
  value,
}: {
  readonly onChange: (value: TaskStatusFilter) => void;
  readonly value: TaskStatusFilter;
}) {
  return (
    <div
      aria-label="Task status"
      className="grid grid-cols-3 rounded-lg border border-zinc-200 bg-zinc-50 p-1"
      role="tablist"
    >
      {filters.map((filter) => {
        const selected = filter.value === value;

        return (
          <button
            aria-selected={selected}
            className={`min-h-9 rounded-md px-3 text-sm font-medium transition ${
              selected
                ? "bg-white text-zinc-950 shadow-sm"
                : "text-zinc-600 hover:bg-white/70 hover:text-zinc-950"
            }`}
            key={filter.value}
            onClick={() => onChange(filter.value)}
            role="tab"
            type="button"
          >
            {filter.label}
          </button>
        );
      })}
    </div>
  );
}
