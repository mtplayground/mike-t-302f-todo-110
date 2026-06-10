import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

test("creates, completes, filters, and deletes a task", async ({ page, request }) => {
  const title = `E2E task ${Date.now()}`;

  await deleteE2eTasks(request);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "todomvc-030" })).toBeVisible();

  await page.getByLabel("Title").fill(title);
  await page.getByLabel("Description").fill("Created by the happy-path E2E flow");
  await page.getByLabel("Due date").fill("2026-12-31");
  await page.getByLabel("Priority").selectOption("HIGH");
  const createResponsePromise = page.waitForResponse(
    (response) => response.url().includes("/tasks") && response.request().method() === "POST"
  );
  await page.getByRole("button", { name: "Add task" }).click();
  const createResponse = await createResponsePromise;
  expect(createResponse.ok()).toBe(true);

  const createdTask = page.locator("li").filter({ hasText: title });
  await expect(createdTask).toBeVisible();
  await expect(createdTask.getByText("High")).toBeVisible();
  await expect(createdTask.getByText("Dec 31, 2026")).toBeVisible();

  await createdTask.getByRole("checkbox", { name: `Mark completed: ${title}` }).click();
  await expect(createdTask.getByText("Completed")).toBeVisible();

  await page.getByRole("tab", { name: "Completed" }).click();
  await expect(page.locator("li").filter({ hasText: title })).toBeVisible();

  await page.getByRole("tab", { name: "Active" }).click();
  await expect(page.locator("li").filter({ hasText: title })).toHaveCount(0);

  await page.getByRole("tab", { name: "Completed" }).click();
  const completedTask = page.locator("li").filter({ hasText: title });
  await completedTask.getByRole("button", { name: "Delete" }).click();
  await expect(page.locator("li").filter({ hasText: title })).toHaveCount(0);

  await page.getByRole("tab", { name: "All" }).click();
  await expect(page.locator("li").filter({ hasText: title })).toHaveCount(0);
});

test("uploads, validates, replaces, removes, and deletes task images", async ({
  page,
  request,
}) => {
  const title = `E2E image task ${Date.now()}`;
  const deleteTitle = `E2E image delete ${Date.now()}`;
  const validImage = createPngFile("task-image.png");
  const replacementImage = createPngFile("replacement-image.png", "replacement-image");

  await deleteE2eTasks(request);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "todomvc-030" })).toBeVisible();

  await page.getByLabel("Title").fill(`E2E invalid image ${Date.now()}`);
  await setTaskImageFile(page, {
    buffer: Buffer.from("not an image"),
    mimeType: "text/plain",
    name: "invalid.txt",
  });
  const invalidResponsePromise = waitForTaskResponse(page, "POST");
  await page.getByRole("button", { name: "Add task" }).click();
  const invalidResponse = await invalidResponsePromise;
  expect(invalidResponse.status()).toBe(400);
  await expect(page.getByText("400 Bad Request")).toBeVisible();

  await page.reload();
  await page.getByLabel("Title").fill(`E2E oversized image ${Date.now()}`);
  await setTaskImageFile(page, {
    buffer: Buffer.alloc(5_242_881, 0),
    mimeType: "image/png",
    name: "oversized.png",
  });
  const oversizedResponsePromise = waitForTaskResponse(page, "POST");
  await page.getByRole("button", { name: "Add task" }).click();
  const oversizedResponse = await oversizedResponsePromise;
  expect(oversizedResponse.status()).toBe(413);
  await expect(page.getByText("413 Payload Too Large")).toBeVisible();

  await page.reload();
  await page.getByLabel("Title").fill(title);
  await page.getByLabel("Description").fill("Task with an uploaded image");
  await page.getByLabel("Priority").selectOption("HIGH");
  await setTaskImageFile(page, validImage);
  await expect(page.getByRole("img", { name: "Selected task image preview" })).toBeVisible();
  const createResponsePromise = waitForTaskResponse(page, "POST");
  await page.getByRole("button", { name: "Add task" }).click();
  const createResponse = await createResponsePromise;
  expect(createResponse.ok()).toBe(true);
  const createdTaskBody = (await createResponse.json()) as TaskResponseBody;
  expect(createdTaskBody.task.imageContentType).toBe("image/png");
  expect(createdTaskBody.task.imageSize).toBe(validImage.buffer.length);
  expect(createdTaskBody.task.imageUrl).toEqual(expect.any(String));

  const uploadedTask = page.locator("li").filter({ hasText: title });
  await expect(uploadedTask).toBeVisible();
  await expect(uploadedTask.getByRole("img", { name: `${title} image preview` })).toBeVisible();

  await uploadedTask.getByRole("button", { name: "Edit" }).click();
  await setTaskImageFile(page, replacementImage);
  await expect(page.getByRole("img", { name: "Selected task image preview" })).toBeVisible();
  const replaceResponsePromise = waitForTaskResponse(page, "PATCH");
  await page.getByRole("button", { name: "Save changes" }).click();
  const replaceResponse = await replaceResponsePromise;
  expect(replaceResponse.ok()).toBe(true);
  const replacedTaskBody = (await replaceResponse.json()) as TaskResponseBody;
  expect(replacedTaskBody.task.imageSize).toBe(replacementImage.buffer.length);
  await expect(uploadedTask.getByRole("img", { name: `${title} image preview` })).toBeVisible();

  await uploadedTask.getByRole("button", { name: "Edit" }).click();
  await page.getByLabel("Remove current image").check();
  const removeResponsePromise = waitForTaskResponse(page, "PATCH");
  await page.getByRole("button", { name: "Save changes" }).click();
  const removeResponse = await removeResponsePromise;
  expect(removeResponse.ok()).toBe(true);
  const removedTaskBody = (await removeResponse.json()) as TaskResponseBody;
  expect(removedTaskBody.task.imageUrl).toBeNull();
  await expect(uploadedTask.getByRole("img", { name: `${title} image preview` })).toHaveCount(0);

  await page.getByLabel("Title").fill(deleteTitle);
  await setTaskImageFile(page, validImage);
  const deleteCreateResponsePromise = waitForTaskResponse(page, "POST");
  await page.getByRole("button", { name: "Add task" }).click();
  const deleteCreateResponse = await deleteCreateResponsePromise;
  expect(deleteCreateResponse.ok()).toBe(true);

  const deleteTask = page.locator("li").filter({ hasText: deleteTitle });
  await expect(deleteTask.getByRole("img", { name: `${deleteTitle} image preview` })).toBeVisible();
  const deleteResponsePromise = waitForTaskResponse(page, "DELETE");
  await deleteTask.getByRole("button", { name: "Delete" }).click();
  const deleteResponse = await deleteResponsePromise;
  expect(deleteResponse.status()).toBe(204);
  await expect(page.locator("li").filter({ hasText: deleteTitle })).toHaveCount(0);
});

test("searches tasks and clears back to the unfiltered list", async ({ page, request }) => {
  const timestamp = Date.now();
  const titleMatch = `E2E search launch ${timestamp}`;
  const descriptionMatch = `E2E search budget ${timestamp}`;
  const nonMatch = `E2E search unrelated ${timestamp}`;

  await deleteE2eTasks(request);
  await createE2eTask(request, {
    title: titleMatch,
    description: "Prepare release notes",
  });
  await createE2eTask(request, {
    title: descriptionMatch,
    description: "Needs invoice reconciliation",
  });
  await createE2eTask(request, {
    title: nonMatch,
    description: "No matching text",
  });

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "todomvc-030" })).toBeVisible();
  await expect(page.locator("li").filter({ hasText: titleMatch })).toBeVisible();
  await expect(page.locator("li").filter({ hasText: descriptionMatch })).toBeVisible();
  await expect(page.locator("li").filter({ hasText: nonMatch })).toBeVisible();

  await page.getByRole("searchbox", { name: "Search tasks" }).fill("launch");
  await expect(page.locator("li").filter({ hasText: titleMatch })).toBeVisible();
  await expect(page.locator("li").filter({ hasText: descriptionMatch })).toHaveCount(0);
  await expect(page.locator("li").filter({ hasText: nonMatch })).toHaveCount(0);

  await page.getByRole("searchbox", { name: "Search tasks" }).fill("invoice");
  await expect(page.locator("li").filter({ hasText: descriptionMatch })).toBeVisible();
  await expect(page.locator("li").filter({ hasText: titleMatch })).toHaveCount(0);
  await expect(page.locator("li").filter({ hasText: nonMatch })).toHaveCount(0);

  await page.getByRole("button", { name: "Clear" }).click();
  await expect(page.locator("li").filter({ hasText: titleMatch })).toBeVisible();
  await expect(page.locator("li").filter({ hasText: descriptionMatch })).toBeVisible();
  await expect(page.locator("li").filter({ hasText: nonMatch })).toBeVisible();
});

async function deleteE2eTasks(request: APIRequestContext): Promise<void> {
  const apiBaseUrl = process.env.E2E_API_BASE_URL ?? "http://127.0.0.1:8080";
  const response = await request.get(new URL("/tasks?status=all", apiBaseUrl).toString());
  expect(response.ok()).toBe(true);

  const body = (await response.json()) as {
    readonly tasks: ReadonlyArray<{ readonly id: string; readonly title: string }>;
  };

  await Promise.all(
    body.tasks
      .filter((task) => task.title.startsWith("E2E "))
      .map((task) => request.delete(new URL(`/tasks/${task.id}`, apiBaseUrl).toString()))
  );
}

async function createE2eTask(
  request: APIRequestContext,
  input: {
    readonly description: string;
    readonly title: string;
  }
): Promise<void> {
  const apiBaseUrl = process.env.E2E_API_BASE_URL ?? "http://127.0.0.1:8080";
  const response = await request.post(new URL("/tasks", apiBaseUrl).toString(), {
    data: {
      description: input.description,
      priority: "MEDIUM",
      title: input.title,
    },
  });

  expect(response.ok()).toBe(true);
}

function waitForTaskResponse(page: Page, method: string) {
  return page.waitForResponse(
    (response) => response.url().includes("/tasks") && response.request().method() === method
  );
}

function createPngFile(name: string, label = name) {
  return {
    buffer: Buffer.concat([
      Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/luz0uwAAAABJRU5ErkJggg==",
        "base64"
      ),
      Buffer.from(label),
    ]),
    mimeType: "image/png",
    name,
  };
}

async function setTaskImageFile(page: Page, file: ReturnType<typeof createPngFile>): Promise<void> {
  await page.locator('input[type="file"]').setInputFiles(file);
}

interface TaskResponseBody {
  readonly task: {
    readonly imageContentType: string | null;
    readonly imageSize: number | null;
    readonly imageUrl: string | null;
  };
}
