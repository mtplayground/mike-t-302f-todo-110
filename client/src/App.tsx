import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { ApiError } from "./api/client.js";
import { getHealth } from "./api/health.js";
import {
  createTask,
  deleteTask,
  getTasks,
  updateTask,
  type Task,
  type TaskFormInput,
  type TaskStatusFilter,
} from "./api/tasks.js";
import { StatusFilterTabs } from "./components/tasks/StatusFilterTabs.js";
import { TaskForm } from "./components/tasks/TaskForm.js";
import { TaskList } from "./components/tasks/TaskList.js";

export function App() {
  const queryClient = useQueryClient();
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<TaskStatusFilter>("all");
  const debouncedSearchTerm = useDebouncedValue(searchTerm.trim(), 300);
  const healthQuery = useQuery({
    queryKey: ["health"],
    queryFn: ({ signal }) => getHealth({ signal }),
    retry: 1,
    staleTime: 30_000,
  });
  const tasksQuery = useQuery({
    queryKey: ["tasks", statusFilter, debouncedSearchTerm],
    queryFn: ({ signal }) => getTasks(statusFilter, { search: debouncedSearchTerm, signal }),
    staleTime: 10_000,
  });
  const createMutation = useMutation({
    mutationFn: createTask,
    onSuccess: async () => {
      setStatusFilter("all");
      await queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { readonly id: string; readonly input: TaskFormInput }) =>
      updateTask(id, input),
    onSuccess: async () => {
      setEditingTask(null);
      await queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });
  const toggleCompleteMutation = useMutation({
    mutationFn: ({ completed, task }: { readonly completed: boolean; readonly task: Task }) =>
      updateTask(task.id, { completed }),
    onMutate: async ({ completed, task }) => {
      await queryClient.cancelQueries({ queryKey: ["tasks"] });
      const snapshots = queryClient.getQueriesData<Task[]>({ queryKey: ["tasks"] });
      const updatedTask = {
        ...task,
        completed,
        updatedAt: new Date().toISOString(),
      };

      for (const [queryKey, currentTasks] of snapshots) {
        queryClient.setQueryData(
          queryKey,
          applyTaskToCache(
            currentTasks,
            updatedTask,
            getStatusFromQueryKey(queryKey),
            getSearchFromQueryKey(queryKey)
          )
        );
      }

      return { snapshots };
    },
    onError: (_error, _variables, context) => {
      for (const [queryKey, tasksSnapshot] of context?.snapshots ?? []) {
        queryClient.setQueryData(queryKey, tasksSnapshot);
      }
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });
  const deleteMutation = useMutation({
    mutationFn: (task: Task) => deleteTask(task.id),
    onMutate: async (task) => {
      await queryClient.cancelQueries({ queryKey: ["tasks"] });
      const snapshots = queryClient.getQueriesData<Task[]>({ queryKey: ["tasks"] });
      const previousEditingTask = editingTask;

      for (const [queryKey, currentTasks] of snapshots) {
        queryClient.setQueryData(
          queryKey,
          currentTasks?.filter((currentTask) => currentTask.id !== task.id)
        );
      }

      if (editingTask?.id === task.id) {
        setEditingTask(null);
      }

      return { previousEditingTask, snapshots };
    },
    onError: (_error, _variables, context) => {
      for (const [queryKey, tasksSnapshot] of context?.snapshots ?? []) {
        queryClient.setQueryData(queryKey, tasksSnapshot);
      }

      if (context?.previousEditingTask) {
        setEditingTask(context.previousEditingTask);
      }
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });

  const apiStatus =
    healthQuery.data?.status === "ok" ? "Online" : healthQuery.isError ? "Offline" : "Checking";
  const tasks = tasksQuery.data ?? [];
  const formError =
    createMutation.error || updateMutation.error
      ? formatApiError((createMutation.error ?? updateMutation.error) as Error)
      : null;

  async function handleTaskFormSubmit(input: TaskFormInput): Promise<void> {
    if (editingTask) {
      await updateMutation.mutateAsync({ id: editingTask.id, input });
      return;
    }

    await createMutation.mutateAsync(input);
  }

  return (
    <main className="min-h-screen bg-stone-50 text-zinc-950">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 py-5 sm:px-6 lg:px-8">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 pb-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-normal">todomvc-030</h1>
            <p className="mt-1 text-sm text-zinc-600">Task workspace</p>
          </div>
          <ApiStatusBadge status={apiStatus} />
        </header>

        <section className="grid flex-1 gap-6 py-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <div className="rounded-lg border border-zinc-200 bg-white">
            <div className="flex flex-col gap-3 border-b border-zinc-200 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
              <h2 className="text-base font-semibold">Tasks</h2>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
                <label className="relative block sm:w-72">
                  <span className="sr-only">Search tasks</span>
                  <input
                    className="h-10 w-full rounded-lg border border-zinc-300 bg-white px-3 pr-16 text-sm text-zinc-950 outline-none transition placeholder:text-zinc-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder="Search tasks"
                    type="search"
                    value={searchTerm}
                  />
                  {searchTerm ? (
                    <button
                      className="absolute right-1 top-1 h-8 rounded-md px-2 text-xs font-medium text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-800"
                      onClick={() => setSearchTerm("")}
                      type="button"
                    >
                      Clear
                    </button>
                  ) : null}
                </label>
                <StatusFilterTabs onChange={setStatusFilter} value={statusFilter} />
              </div>
            </div>
            <TaskList
              error={tasksQuery.error ? formatApiError(tasksQuery.error) : null}
              isLoading={tasksQuery.isLoading}
              onDelete={(task) => deleteMutation.mutate(task)}
              onEdit={setEditingTask}
              onToggleComplete={(task, completed) =>
                toggleCompleteMutation.mutate({ completed, task })
              }
              pendingTaskIds={getPendingTaskIds(
                toggleCompleteMutation.isPending
                  ? toggleCompleteMutation.variables?.task
                  : undefined,
                deleteMutation.isPending ? deleteMutation.variables : undefined
              )}
              tasks={tasks}
            />
          </div>

          <aside className="space-y-4">
            <div className="rounded-lg border border-zinc-200 bg-white p-4">
              <TaskForm
                error={formError}
                isSubmitting={createMutation.isPending || updateMutation.isPending}
                onCancelEdit={() => setEditingTask(null)}
                onSubmit={handleTaskFormSubmit}
                task={editingTask}
              />
            </div>

            <div className="rounded-lg border border-zinc-200 bg-white p-4">
              <h2 className="text-base font-semibold">System</h2>
              <dl className="mt-4 space-y-3 text-sm">
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-zinc-500">API</dt>
                  <dd className="font-medium text-zinc-800">{apiStatus}</dd>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-zinc-500">Shown</dt>
                  <dd className="font-medium text-zinc-800">{tasks.length}</dd>
                </div>
                {healthQuery.error ? (
                  <div className="border-t border-zinc-100 pt-3 text-xs leading-5 text-red-700">
                    {formatApiError(healthQuery.error)}
                  </div>
                ) : null}
              </dl>
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}

function ApiStatusBadge({ status }: { readonly status: "Checking" | "Offline" | "Online" }) {
  const className =
    status === "Online"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : status === "Offline"
        ? "border-red-200 bg-red-50 text-red-700"
        : "border-amber-200 bg-amber-50 text-amber-700";

  return (
    <span className={`rounded-full border px-3 py-1 text-sm font-medium ${className}`}>
      {status}
    </span>
  );
}

function useDebouncedValue(value: string, delayMs: number): string {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setDebouncedValue(value), delayMs);

    return () => window.clearTimeout(timeoutId);
  }, [delayMs, value]);

  return debouncedValue;
}

function formatApiError(error: Error): string {
  if (error instanceof ApiError) {
    return `${error.status} ${error.statusText}`;
  }

  return error.message;
}

function applyTaskToCache(
  tasks: Task[] | undefined,
  task: Task,
  status: TaskStatusFilter,
  search: string
): Task[] | undefined {
  if (!tasks) {
    return tasks;
  }

  const tasksWithoutUpdated = tasks.filter((currentTask) => currentTask.id !== task.id);

  if (!matchesStatus(task, status) || !matchesSearch(task, search)) {
    return tasksWithoutUpdated;
  }

  return [task, ...tasksWithoutUpdated].sort(compareTasks);
}

function getSearchFromQueryKey(queryKey: readonly unknown[]): string {
  const search = queryKey[2];

  return typeof search === "string" ? search : "";
}

function compareTasks(first: Task, second: Task): number {
  if (first.completed !== second.completed) {
    return Number(first.completed) - Number(second.completed);
  }

  return second.createdAt.localeCompare(first.createdAt);
}

function getPendingTaskIds(...tasks: ReadonlyArray<Task | undefined>): ReadonlySet<string> {
  return new Set(tasks.filter((task): task is Task => Boolean(task)).map((task) => task.id));
}

function getStatusFromQueryKey(queryKey: readonly unknown[]): TaskStatusFilter {
  const status = queryKey[1];

  if (status === "active" || status === "completed") {
    return status;
  }

  return "all";
}

function matchesStatus(task: Task, status: TaskStatusFilter): boolean {
  if (status === "active") {
    return !task.completed;
  }

  if (status === "completed") {
    return task.completed;
  }

  return true;
}

function matchesSearch(task: Task, search: string): boolean {
  if (!search) {
    return true;
  }

  const normalizedSearch = search.toLocaleLowerCase();

  return (
    task.title.toLocaleLowerCase().includes(normalizedSearch) ||
    (task.description?.toLocaleLowerCase().includes(normalizedSearch) ?? false)
  );
}
