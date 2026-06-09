import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

import type { AllowedImageContentType, UploadedImageMetadata } from "../services/storage.js";
import type * as StorageService from "../services/storage.js";

vi.mock("../services/storage.js", async () => {
  const actual = await vi.importActual<typeof StorageService>("../services/storage.js");

  return {
    ...actual,
    createSignedTaskImageUrl: vi.fn(async (imageKey: string) => `https://signed.test/${imageKey}`),
    deleteTaskImage: vi.fn(async () => undefined),
    uploadTaskImage: vi.fn(),
  };
});

import { createApp } from "../app.js";
import { prisma } from "../db/prisma.js";
import { deleteTaskImage, uploadTaskImage } from "../services/storage.js";
import { cleanupTasks, routeTestPrefix } from "../test/task-test-utils.js";

const app = createApp();
const uploadTaskImageMock = vi.mocked(uploadTaskImage);
const deleteTaskImageMock = vi.mocked(deleteTaskImage);
let uploadedImageCount = 0;

describe("task routes", () => {
  beforeEach(async () => {
    await cleanupTasks(routeTestPrefix);
    uploadedImageCount = 0;
    deleteTaskImageMock.mockClear();
    uploadTaskImageMock.mockImplementation(async (input) => {
      uploadedImageCount += 1;
      const imageKey = `tasks/images/mock-${uploadedImageCount}.png`;

      return {
        imageContentType: input.contentType as AllowedImageContentType,
        imageKey,
        imageSize: input.size,
        imageUrl: `https://public.test/${imageKey}`,
      } satisfies UploadedImageMetadata;
    });
  });

  afterAll(async () => {
    await cleanupTasks(routeTestPrefix);
    await prisma.$disconnect();
  });

  it("supports task CRUD and status filtering", async () => {
    const createResponse = await request(app)
      .post("/tasks")
      .send({
        title: `${routeTestPrefix}created`,
        description: "created through the API",
        dueDate: "2026-11-03",
        priority: "LOW",
      })
      .expect(201);

    const createdTask = createResponse.body.task;
    expect(createdTask).toMatchObject({
      title: `${routeTestPrefix}created`,
      description: "created through the API",
      priority: "LOW",
      completed: false,
    });
    expect(createdTask.id).toEqual(expect.any(String));

    const activeResponse = await request(app).get("/tasks").query({ status: "active" }).expect(200);
    expect(
      activeResponse.body.tasks.some((task: { id: string }) => task.id === createdTask.id)
    ).toBe(true);

    const patchResponse = await request(app)
      .patch(`/tasks/${createdTask.id}`)
      .send({
        title: `${routeTestPrefix}updated`,
        description: null,
        dueDate: null,
        priority: "HIGH",
        completed: true,
      })
      .expect(200);

    expect(patchResponse.body.task).toMatchObject({
      id: createdTask.id,
      title: `${routeTestPrefix}updated`,
      description: null,
      dueDate: null,
      priority: "HIGH",
      completed: true,
    });

    const completedResponse = await request(app)
      .get("/tasks")
      .query({ status: "completed" })
      .expect(200);
    expect(
      completedResponse.body.tasks.some((task: { id: string }) => task.id === createdTask.id)
    ).toBe(true);

    await request(app).delete(`/tasks/${createdTask.id}`).expect(204);

    const notFoundResponse = await request(app)
      .patch(`/tasks/${createdTask.id}`)
      .send({ completed: false })
      .expect(404);
    expect(notFoundResponse.body.error).toMatchObject({
      code: "TASK_NOT_FOUND",
    });
  });

  it("returns validation errors for invalid task requests", async () => {
    const invalidCreateResponse = await request(app)
      .post("/tasks")
      .send({ title: "", priority: "LOW" })
      .expect(400);
    expect(invalidCreateResponse.body.error).toMatchObject({
      code: "VALIDATION_ERROR",
    });

    const invalidListResponse = await request(app)
      .get("/tasks")
      .query({ status: "done" })
      .expect(400);
    expect(invalidListResponse.body.error).toMatchObject({
      code: "VALIDATION_ERROR",
    });

    const invalidDeleteResponse = await request(app).delete("/tasks/not-a-uuid").expect(400);
    expect(invalidDeleteResponse.body.error).toMatchObject({
      code: "VALIDATION_ERROR",
    });

    const invalidPatchResponse = await request(app)
      .patch("/tasks/11111111-1111-4111-8111-111111111111")
      .send({})
      .expect(400);
    expect(invalidPatchResponse.body.error).toMatchObject({
      code: "VALIDATION_ERROR",
    });
  });

  it("accepts multipart image uploads and cleans up replaced or removed images", async () => {
    const createResponse = await request(app)
      .post("/tasks")
      .field("title", `${routeTestPrefix}image-create`)
      .field("description", "created with an image")
      .field("dueDate", "2026-11-04")
      .field("priority", "HIGH")
      .attach("image", Buffer.from("first-image"), {
        contentType: "image/png",
        filename: "user-filename.png",
      })
      .expect(201);

    const createdTask = createResponse.body.task;
    expect(createdTask).toMatchObject({
      imageContentType: "image/png",
      imageSize: Buffer.byteLength("first-image"),
      imageUrl: "https://signed.test/tasks/images/mock-1.png",
      title: `${routeTestPrefix}image-create`,
    });
    expect(uploadTaskImageMock).toHaveBeenCalledWith({
      buffer: expect.any(Buffer),
      contentType: "image/png",
      size: Buffer.byteLength("first-image"),
    });

    const replaceResponse = await request(app)
      .patch(`/tasks/${createdTask.id}`)
      .field("title", `${routeTestPrefix}image-replaced`)
      .attach("image", Buffer.from("second-image"), {
        contentType: "image/webp",
        filename: "another-user-filename.webp",
      })
      .expect(200);

    expect(replaceResponse.body.task).toMatchObject({
      imageContentType: "image/webp",
      imageSize: Buffer.byteLength("second-image"),
      imageUrl: "https://signed.test/tasks/images/mock-2.png",
      title: `${routeTestPrefix}image-replaced`,
    });
    expect(deleteTaskImageMock).toHaveBeenCalledWith("tasks/images/mock-1.png");

    const removeResponse = await request(app)
      .patch(`/tasks/${createdTask.id}`)
      .field("remove-image", "true")
      .expect(200);

    expect(removeResponse.body.task).toMatchObject({
      imageContentType: null,
      imageSize: null,
      imageUrl: null,
    });
    expect(deleteTaskImageMock).toHaveBeenCalledWith("tasks/images/mock-2.png");
  });

  it("deletes a task image object when deleting the task", async () => {
    const createResponse = await request(app)
      .post("/tasks")
      .field("title", `${routeTestPrefix}image-delete`)
      .attach("image", Buffer.from("delete-image"), {
        contentType: "image/gif",
        filename: "delete.gif",
      })
      .expect(201);

    await request(app).delete(`/tasks/${createResponse.body.task.id}`).expect(204);

    expect(deleteTaskImageMock).toHaveBeenCalledWith("tasks/images/mock-1.png");
  });
});
