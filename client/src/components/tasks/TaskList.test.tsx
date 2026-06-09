import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { Task } from "../../api/tasks.js";
import { TaskList } from "./TaskList.js";

const activeTask: Task = {
  completed: false,
  createdAt: "2026-06-01T00:00:00.000Z",
  description: "Cover component behavior",
  dueDate: "2026-06-15",
  id: "11111111-1111-4111-8111-111111111111",
  imageContentType: "image/png",
  imageSize: 2048,
  imageUrl: "https://images.test/write-component-tests.png",
  priority: "HIGH",
  title: "Write component tests",
  updatedAt: "2026-06-01T00:00:00.000Z",
};

const completedTask: Task = {
  completed: true,
  createdAt: "2026-05-30T00:00:00.000Z",
  description: null,
  dueDate: null,
  id: "22222222-2222-4222-8222-222222222222",
  imageContentType: null,
  imageSize: null,
  imageUrl: null,
  priority: "LOW",
  title: "Review task filters",
  updatedAt: "2026-06-02T00:00:00.000Z",
};

describe("TaskList", () => {
  it("renders tasks with due date, priority, and status", () => {
    renderTaskList({ tasks: [activeTask, completedTask] });

    expect(screen.getByText("Write component tests")).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: "Write component tests image preview" })
    ).toHaveAttribute("src", "https://images.test/write-component-tests.png");
    expect(screen.getByText("Cover component behavior")).toBeInTheDocument();
    expect(screen.getByText("Jun 15, 2026")).toBeInTheDocument();
    expect(screen.getByText("High")).toBeInTheDocument();
    expect(screen.getByText("Review task filters")).toBeInTheDocument();
    expect(screen.getByText("No due date")).toBeInTheDocument();
    expect(screen.getByText("Low")).toBeInTheDocument();
    expect(screen.getByText("Completed")).toBeInTheDocument();
  });

  it("calls toggle and delete handlers for task interactions", async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    const onToggleComplete = vi.fn();

    renderTaskList({
      onDelete,
      onToggleComplete,
      tasks: [activeTask],
    });

    await user.click(
      screen.getByRole("checkbox", { name: "Mark completed: Write component tests" })
    );

    expect(onToggleComplete).toHaveBeenCalledWith(activeTask, true);

    const taskItem = screen.getByText("Write component tests").closest("li");
    expect(taskItem).not.toBeNull();

    await user.click(within(taskItem as HTMLElement).getByRole("button", { name: "Delete" }));

    expect(onDelete).toHaveBeenCalledWith(activeTask);
  });

  it("shows empty and error states", () => {
    const { rerender } = renderTaskList({ tasks: [] });

    expect(screen.getByText("No tasks match this filter.")).toBeInTheDocument();

    rerender(
      <TaskList
        error="Unable to load tasks"
        isLoading={false}
        onDelete={vi.fn()}
        onEdit={vi.fn()}
        onToggleComplete={vi.fn()}
        pendingTaskIds={new Set()}
        tasks={[]}
      />
    );

    expect(screen.getByText("Unable to load tasks")).toBeInTheDocument();
  });
});

function renderTaskList({
  error = null,
  isLoading = false,
  onDelete = vi.fn(),
  onEdit = vi.fn(),
  onToggleComplete = vi.fn(),
  pendingTaskIds = new Set<string>(),
  tasks,
}: {
  readonly error?: string | null;
  readonly isLoading?: boolean;
  readonly onDelete?: (task: Task) => void;
  readonly onEdit?: (task: Task) => void;
  readonly onToggleComplete?: (task: Task, completed: boolean) => void;
  readonly pendingTaskIds?: ReadonlySet<string>;
  readonly tasks: readonly Task[];
}) {
  return render(
    <TaskList
      error={error}
      isLoading={isLoading}
      onDelete={onDelete}
      onEdit={onEdit}
      onToggleComplete={onToggleComplete}
      pendingTaskIds={pendingTaskIds}
      tasks={tasks}
    />
  );
}
