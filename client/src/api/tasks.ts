import { apiRequest } from "./client.js";

export type TaskPriority = "HIGH" | "LOW" | "MEDIUM";
export type TaskStatusFilter = "active" | "all" | "completed";

export interface Task {
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

export interface TaskFormInput {
  readonly description: string | null;
  readonly dueDate: string | null;
  readonly imageFile?: File;
  readonly priority: TaskPriority;
  readonly removeImage?: boolean;
  readonly title: string;
}

export interface TaskUpdateInput {
  readonly completed?: boolean;
  readonly description?: string | null;
  readonly dueDate?: string | null;
  readonly imageFile?: File;
  readonly priority?: TaskPriority;
  readonly removeImage?: boolean;
  readonly title?: string;
}

interface ListTasksResponse {
  readonly tasks: Task[];
}

interface TaskResponse {
  readonly task: Task;
}

export async function createTask(input: TaskFormInput): Promise<Task> {
  const response = await apiRequest<TaskResponse>("/tasks", {
    body: toTaskRequestBody(input),
    method: "POST",
  });

  return response.task;
}

export async function getTasks(
  status: TaskStatusFilter,
  options: { readonly search?: string; readonly signal?: AbortSignal } = {}
): Promise<Task[]> {
  const params = new URLSearchParams({ status });
  const search = options.search?.trim();

  if (search) {
    params.set("search", search);
  }

  const response = await apiRequest<ListTasksResponse>(`/tasks?${params.toString()}`, {
    signal: options.signal,
  });

  return response.tasks;
}

export async function updateTask(id: string, input: TaskUpdateInput): Promise<Task> {
  const response = await apiRequest<TaskResponse>(`/tasks/${id}`, {
    body: toTaskRequestBody(input),
    method: "PATCH",
  });

  return response.task;
}

export async function deleteTask(id: string): Promise<void> {
  await apiRequest<void>(`/tasks/${id}`, {
    method: "DELETE",
  });
}

function toTaskRequestBody(input: TaskFormInput | TaskUpdateInput): FormData | object {
  if (!input.imageFile) {
    return toJsonTaskPayload(input);
  }

  const formData = new FormData();

  appendFormField(formData, "title", input.title);
  appendFormField(formData, "description", input.description);
  appendFormField(formData, "dueDate", input.dueDate);
  appendFormField(formData, "priority", input.priority);
  appendFormField(formData, "completed", "completed" in input ? input.completed : undefined);
  appendFormField(formData, "removeImage", input.removeImage);
  formData.append("image", input.imageFile);

  return formData;
}

function toJsonTaskPayload(input: TaskFormInput | TaskUpdateInput): object {
  const { imageFile: _imageFile, ...payload } = input;

  return payload;
}

function appendFormField(formData: FormData, key: string, value: unknown): void {
  if (value === undefined) {
    return;
  }

  formData.append(key, value === null ? "" : String(value));
}
