import type { Task, TaskPriority } from "../../api/tasks.js";

export function TaskList({
  error,
  isLoading,
  onDelete,
  onEdit,
  onToggleComplete,
  pendingTaskIds,
  tasks,
}: {
  readonly error: string | null;
  readonly isLoading: boolean;
  readonly onDelete: (task: Task) => void;
  readonly onEdit: (task: Task) => void;
  readonly onToggleComplete: (task: Task, completed: boolean) => void;
  readonly pendingTaskIds: ReadonlySet<string>;
  readonly tasks: readonly Task[];
}) {
  if (isLoading) {
    return (
      <ul className="divide-y divide-zinc-100">
        {Array.from({ length: 4 }).map((_, index) => (
          <li className="px-4 py-4" key={index}>
            <div className="h-4 w-2/3 rounded bg-zinc-100" />
            <div className="mt-3 flex gap-2">
              <div className="h-6 w-20 rounded-full bg-zinc-100" />
              <div className="h-6 w-24 rounded-full bg-zinc-100" />
            </div>
          </li>
        ))}
      </ul>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-72 items-center justify-center px-4 py-12 text-center text-sm text-red-700">
        {error}
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div className="flex min-h-72 items-center justify-center px-4 py-12 text-center text-sm text-zinc-500">
        No tasks match this filter.
      </div>
    );
  }

  return (
    <ul className="divide-y divide-zinc-100">
      {tasks.map((task) => (
        <li className="px-4 py-4" key={task.id}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 gap-3">
              {task.imageUrl ? (
                <img
                  alt={`${task.title} image preview`}
                  className="h-16 w-16 shrink-0 rounded-md border border-zinc-200 object-cover"
                  loading="lazy"
                  src={task.imageUrl}
                />
              ) : null}
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <input
                    aria-label={`${task.completed ? "Mark active" : "Mark completed"}: ${task.title}`}
                    checked={task.completed}
                    className="h-4 w-4 rounded border-zinc-300 text-emerald-600 accent-emerald-600 disabled:cursor-not-allowed"
                    disabled={pendingTaskIds.has(task.id)}
                    onChange={(event) => onToggleComplete(task, event.target.checked)}
                    type="checkbox"
                  />
                  <h3
                    className={`truncate text-sm font-semibold ${
                      task.completed ? "text-zinc-500 line-through" : "text-zinc-950"
                    }`}
                  >
                    {task.title}
                  </h3>
                </div>
                {task.description ? (
                  <p className="mt-2 line-clamp-2 text-sm leading-6 text-zinc-600">
                    {task.description}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">
              <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs font-medium text-zinc-700">
                {task.dueDate ? formatDueDate(task.dueDate) : "No due date"}
              </span>
              <span
                className={`rounded-full border px-2.5 py-1 text-xs font-medium ${priorityClassName(
                  task.priority
                )}`}
              >
                {formatPriority(task.priority)}
              </span>
              <span className="rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-xs font-medium text-zinc-600">
                {task.completed ? "Completed" : "Active"}
              </span>
              <button
                className="rounded-md border border-zinc-300 bg-white px-2.5 py-1 text-xs font-medium text-zinc-700 transition hover:border-zinc-400 hover:bg-zinc-50"
                disabled={pendingTaskIds.has(task.id)}
                onClick={() => onEdit(task)}
                type="button"
              >
                Edit
              </button>
              <button
                className="rounded-md border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700 transition hover:border-red-300 hover:bg-red-100 disabled:cursor-not-allowed disabled:border-zinc-200 disabled:bg-zinc-50 disabled:text-zinc-400"
                disabled={pendingTaskIds.has(task.id)}
                onClick={() => onDelete(task)}
                type="button"
              >
                Delete
              </button>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

function formatDueDate(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}

function formatPriority(priority: TaskPriority): string {
  return priority[0] + priority.slice(1).toLowerCase();
}

function priorityClassName(priority: TaskPriority): string {
  if (priority === "HIGH") {
    return "border-red-200 bg-red-50 text-red-700";
  }

  if (priority === "MEDIUM") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  return "border-emerald-200 bg-emerald-50 text-emerald-700";
}
