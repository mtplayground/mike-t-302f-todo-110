import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { App } from "./App.js";
import { getHealth } from "./api/health.js";
import { getTasks, type Task, type TaskStatusFilter } from "./api/tasks.js";

vi.mock("./api/health.js", () => ({
  getHealth: vi.fn(),
}));

vi.mock("./api/tasks.js", () => ({
  createTask: vi.fn(),
  deleteTask: vi.fn(),
  getTasks: vi.fn(),
  updateTask: vi.fn(),
}));

const tasks: readonly Task[] = [
  {
    completed: false,
    createdAt: "2026-06-01T00:00:00.000Z",
    description: "Prepare launch materials",
    dueDate: null,
    id: "11111111-1111-4111-8111-111111111111",
    imageContentType: null,
    imageSize: null,
    imageUrl: null,
    priority: "HIGH",
    title: "Write launch plan",
    updatedAt: "2026-06-01T00:00:00.000Z",
  },
  {
    completed: false,
    createdAt: "2026-06-02T00:00:00.000Z",
    description: "Reconcile office expenses",
    dueDate: null,
    id: "22222222-2222-4222-8222-222222222222",
    imageContentType: null,
    imageSize: null,
    imageUrl: null,
    priority: "MEDIUM",
    title: "Review budget",
    updatedAt: "2026-06-02T00:00:00.000Z",
  },
  {
    completed: true,
    createdAt: "2026-06-03T00:00:00.000Z",
    description: "Archive launch notes",
    dueDate: null,
    id: "33333333-3333-4333-8333-333333333333",
    imageContentType: null,
    imageSize: null,
    imageUrl: null,
    priority: "LOW",
    title: "Close release checklist",
    updatedAt: "2026-06-03T00:00:00.000Z",
  },
];

describe("App search", () => {
  beforeEach(() => {
    vi.mocked(getHealth).mockResolvedValue({ status: "ok" });
    vi.mocked(getTasks).mockImplementation(async (status, options = {}) =>
      tasks.filter(
        (task) => matchesStatus(task, status) && matchesSearch(task, options.search ?? "")
      )
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("passes debounced search through the API and restores the list when cleared", async () => {
    const user = userEvent.setup();

    renderApp();

    expect(await screen.findByText("Write launch plan")).toBeInTheDocument();
    expect(screen.getByText("Review budget")).toBeInTheDocument();

    await user.type(screen.getByRole("searchbox", { name: "Search tasks" }), "budget");

    await waitFor(() =>
      expect(getTasks).toHaveBeenLastCalledWith(
        "all",
        expect.objectContaining({ search: "budget" })
      )
    );
    expect(screen.getByText("Review budget")).toBeInTheDocument();
    expect(screen.queryByText("Write launch plan")).not.toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Active" }));

    await waitFor(() =>
      expect(getTasks).toHaveBeenLastCalledWith(
        "active",
        expect.objectContaining({ search: "budget" })
      )
    );
    expect(screen.getByText("Review budget")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Clear" }));

    await waitFor(() =>
      expect(getTasks).toHaveBeenLastCalledWith("active", expect.objectContaining({ search: "" }))
    );
    const taskList = screen.getByRole("list");
    expect(within(taskList).getByText("Write launch plan")).toBeInTheDocument();
    expect(within(taskList).getByText("Review budget")).toBeInTheDocument();
    expect(within(taskList).queryByText("Close release checklist")).not.toBeInTheDocument();
  });
});

function renderApp() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  );
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
  const normalizedSearch = search.trim().toLocaleLowerCase();

  if (!normalizedSearch) {
    return true;
  }

  return (
    task.title.toLocaleLowerCase().includes(normalizedSearch) ||
    (task.description?.toLocaleLowerCase().includes(normalizedSearch) ?? false)
  );
}
