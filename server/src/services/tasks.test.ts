import { TaskPriority } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { prisma } from "../db/prisma.js";
import { createTask, deleteTask, listTasks, updateTask } from "./tasks.js";
import { cleanupTasks, serviceTestPrefix } from "../test/task-test-utils.js";

describe("task service", () => {
  beforeEach(async () => {
    await cleanupTasks(serviceTestPrefix);
  });

  afterAll(async () => {
    await cleanupTasks(serviceTestPrefix);
    await prisma.$disconnect();
  });

  it("creates tasks and lists them by completion status", async () => {
    const activeTask = await createTask({
      title: `${serviceTestPrefix}active`,
      description: "service active task",
      dueDate: new Date("2026-11-01T00:00:00.000Z"),
      priority: TaskPriority.MEDIUM,
    });
    const completedTask = await createTask({
      title: `${serviceTestPrefix}completed`,
      description: null,
      dueDate: null,
      priority: TaskPriority.HIGH,
    });

    await updateTask(completedTask.id, { completed: true });

    const allTasks = (await listTasks({ status: "all" })).filter((task) =>
      task.title.startsWith(serviceTestPrefix)
    );
    const activeTasks = (await listTasks({ status: "active" })).filter((task) =>
      task.title.startsWith(serviceTestPrefix)
    );
    const completedTasks = (await listTasks({ status: "completed" })).filter((task) =>
      task.title.startsWith(serviceTestPrefix)
    );

    expect(allTasks.map((task) => task.id)).toEqual(
      expect.arrayContaining([activeTask.id, completedTask.id])
    );
    expect(activeTasks).toHaveLength(1);
    expect(activeTasks[0]).toMatchObject({
      id: activeTask.id,
      completed: false,
      priority: TaskPriority.MEDIUM,
    });
    expect(completedTasks).toHaveLength(1);
    expect(completedTasks[0]).toMatchObject({
      id: completedTask.id,
      completed: true,
      priority: TaskPriority.HIGH,
    });
  });

  it("filters tasks by case-insensitive title or description search combined with status", async () => {
    const titleMatch = await createTask({
      title: `${serviceTestPrefix}Quarterly Plan`,
      description: "does not contain the term",
      dueDate: null,
      priority: TaskPriority.MEDIUM,
    });
    const descriptionMatch = await createTask({
      title: `${serviceTestPrefix}ordinary title`,
      description: "Includes Launch Notes",
      dueDate: null,
      priority: TaskPriority.MEDIUM,
    });
    const completedDescriptionMatch = await createTask({
      title: `${serviceTestPrefix}completed item`,
      description: "launch follow up",
      dueDate: null,
      priority: TaskPriority.MEDIUM,
    });
    const nonMatch = await createTask({
      title: `${serviceTestPrefix}unrelated`,
      description: "nothing relevant here",
      dueDate: null,
      priority: TaskPriority.MEDIUM,
    });

    await updateTask(completedDescriptionMatch.id, { completed: true });

    const allMatches = (await listTasks({ search: "launch", status: "all" })).filter((task) =>
      task.title.startsWith(serviceTestPrefix)
    );
    const activeMatches = (
      await listTasks({ search: "LAUNCH", status: "active" })
    ).filter((task) => task.title.startsWith(serviceTestPrefix));
    const completedMatches = (
      await listTasks({ search: "launch", status: "completed" })
    ).filter((task) => task.title.startsWith(serviceTestPrefix));
    const emptySearchMatches = (
      await listTasks({ search: "", status: "all" })
    ).filter((task) => task.title.startsWith(serviceTestPrefix));

    expect(allMatches.map((task) => task.id)).toEqual(
      expect.arrayContaining([descriptionMatch.id, completedDescriptionMatch.id])
    );
    expect(allMatches.map((task) => task.id)).not.toContain(nonMatch.id);
    expect(activeMatches.map((task) => task.id)).toEqual([descriptionMatch.id]);
    expect(completedMatches.map((task) => task.id)).toEqual([completedDescriptionMatch.id]);
    expect(emptySearchMatches.map((task) => task.id)).toEqual(
      expect.arrayContaining([
        titleMatch.id,
        descriptionMatch.id,
        completedDescriptionMatch.id,
        nonMatch.id,
      ])
    );
  });

  it("updates and deletes tasks", async () => {
    const task = await createTask({
      title: `${serviceTestPrefix}edit-me`,
      description: "before",
      dueDate: new Date("2026-11-02T00:00:00.000Z"),
      priority: TaskPriority.LOW,
    });

    const updatedTask = await updateTask(task.id, {
      title: `${serviceTestPrefix}edited`,
      description: null,
      dueDate: null,
      priority: TaskPriority.HIGH,
      completed: true,
    });

    expect(updatedTask).toMatchObject({
      id: task.id,
      title: `${serviceTestPrefix}edited`,
      description: null,
      dueDate: null,
      priority: TaskPriority.HIGH,
      completed: true,
    });

    await deleteTask(task.id);

    await expect(updateTask(task.id, { completed: false })).rejects.toMatchObject({
      code: "TASK_NOT_FOUND",
      statusCode: 404,
    });
  });
});
