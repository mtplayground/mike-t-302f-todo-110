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

    const allTasks = (await listTasks("all")).filter((task) =>
      task.title.startsWith(serviceTestPrefix)
    );
    const activeTasks = (await listTasks("active")).filter((task) =>
      task.title.startsWith(serviceTestPrefix)
    );
    const completedTasks = (await listTasks("completed")).filter((task) =>
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
