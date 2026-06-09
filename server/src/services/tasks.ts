import type { Prisma, Task, TaskPriority } from "@prisma/client";

import { prisma } from "../db/prisma.js";
import { AppError } from "../errors/app-error.js";
import {
  createSignedTaskImageUrl,
  deleteTaskImage,
  type UploadedImageMetadata,
} from "./storage.js";

export type TaskStatusFilter = "active" | "all" | "completed";

export interface CreateTaskInput {
  readonly description: string | null;
  readonly dueDate: Date | null;
  readonly image?: UploadedImageMetadata | null;
  readonly priority: TaskPriority;
  readonly title: string;
}

export interface UpdateTaskInput {
  readonly completed?: boolean;
  readonly description?: string | null;
  readonly dueDate?: Date | null;
  readonly image?: UploadedImageMetadata;
  readonly priority?: TaskPriority;
  readonly removeImage?: boolean;
  readonly title?: string;
}

export interface TaskDto {
  readonly completed: boolean;
  readonly createdAt: string;
  readonly description: string | null;
  readonly dueDate: string | null;
  readonly id: string;
  readonly imageContentType: string | null;
  readonly imageSize: number | null;
  readonly imageUrl: string | null;
  readonly priority: TaskPriority;
  readonly title: string;
  readonly updatedAt: string;
}

export async function createTask(input: CreateTaskInput): Promise<TaskDto> {
  const task = await prisma.task.create({
    data: {
      description: input.description,
      dueDate: input.dueDate,
      imageContentType: input.image?.imageContentType ?? null,
      imageKey: input.image?.imageKey ?? null,
      imageSize: input.image?.imageSize ?? null,
      imageUrl: input.image?.imageUrl ?? null,
      priority: input.priority,
      title: input.title,
    },
  });

  return toTaskDto(task);
}

export async function listTasks(status: TaskStatusFilter): Promise<TaskDto[]> {
  const tasks = await prisma.task.findMany({
    where: toStatusWhere(status),
    orderBy: [{ completed: "asc" }, { createdAt: "desc" }],
  });

  return Promise.all(tasks.map(toTaskDto));
}

export async function updateTask(id: string, input: UpdateTaskInput): Promise<TaskDto> {
  const existingTask = await getTaskOrThrow(id);
  const data: Prisma.TaskUpdateInput = {};

  if (input.completed !== undefined) {
    data.completed = input.completed;
  }

  if (input.description !== undefined) {
    data.description = input.description;
  }

  if (input.dueDate !== undefined) {
    data.dueDate = input.dueDate;
  }

  if (input.priority !== undefined) {
    data.priority = input.priority;
  }

  if (input.title !== undefined) {
    data.title = input.title;
  }

  if (input.image) {
    data.imageContentType = input.image.imageContentType;
    data.imageKey = input.image.imageKey;
    data.imageSize = input.image.imageSize;
    data.imageUrl = input.image.imageUrl;
  } else if (input.removeImage) {
    data.imageContentType = null;
    data.imageKey = null;
    data.imageSize = null;
    data.imageUrl = null;
  }

  if (Object.keys(data).length === 0) {
    return toTaskDto(existingTask);
  }

  const task = await prisma.task.update({
    where: { id },
    data,
  });

  if ((input.image || input.removeImage) && existingTask.imageKey) {
    await deleteTaskImage(existingTask.imageKey);
  }

  return toTaskDto(task);
}

export async function deleteTask(id: string): Promise<void> {
  const task = await getTaskOrThrow(id);

  await deleteTaskImage(task.imageKey);
  await prisma.task.delete({ where: { id } });
}

async function getTaskOrThrow(id: string): Promise<Task> {
  const task = await prisma.task.findUnique({
    where: { id },
  });

  if (!task) {
    throw new AppError("Task was not found", {
      code: "TASK_NOT_FOUND",
      statusCode: 404,
    });
  }

  return task;
}

function toStatusWhere(status: TaskStatusFilter) {
  if (status === "active") {
    return { completed: false };
  }

  if (status === "completed") {
    return { completed: true };
  }

  return {};
}

async function toTaskDto(task: Task): Promise<TaskDto> {
  return {
    completed: task.completed,
    createdAt: task.createdAt.toISOString(),
    description: task.description,
    dueDate: task.dueDate ? formatDateOnly(task.dueDate) : null,
    id: task.id,
    imageContentType: task.imageContentType,
    imageSize: task.imageSize,
    imageUrl: task.imageKey ? await createSignedTaskImageUrl(task.imageKey) : null,
    priority: task.priority,
    title: task.title,
    updatedAt: task.updatedAt.toISOString(),
  };
}

function formatDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}
