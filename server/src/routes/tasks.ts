import { Router, type NextFunction, type Request, type Response } from "express";
import multer from "multer";

import { env } from "../config/env.js";
import { AppError } from "../errors/app-error.js";
import { validateRequest } from "../middleware/validate-request.js";
import { createTask, deleteTask, listTasks, updateTask } from "../services/tasks.js";
import {
  deleteTaskImage,
  uploadTaskImage,
  type UploadedImageMetadata,
} from "../services/storage.js";
import {
  createTaskBodySchema,
  listTasksQuerySchema,
  taskParamsSchema,
  updateTaskBodySchema,
  type CreateTaskBody,
  type ListTasksQuery,
  type TaskParams,
  type UpdateTaskBody,
} from "../validation/tasks.js";

export const tasksRouter = Router();
const imageUpload = multer({
  limits: {
    fileSize: env.MAX_IMAGE_BYTES,
    files: 1,
  },
  storage: multer.memoryStorage(),
});

tasksRouter.get(
  "/",
  validateRequest({ query: listTasksQuerySchema }),
  async (request, response) => {
    const query = listTasksQuerySchema.parse(request.query) as ListTasksQuery;
    const tasks = await listTasks(query);

    response.status(200).json({ tasks });
  }
);

tasksRouter.post(
  "/",
  parseOptionalImageUpload,
  validateRequest({ body: createTaskBodySchema }),
  async (request, response) => {
    const body = request.body as CreateTaskBody;
    const image = await uploadRequestImage(request.file);

    try {
      const task = await createTask({
        ...body,
        image,
      });

      response.status(201).json({ task });
    } catch (error) {
      await deleteTaskImage(image?.imageKey);
      throw error;
    }
  }
);

tasksRouter.patch(
  "/:id",
  parseOptionalImageUpload,
  validateRequest({ body: updateTaskBodySchema, params: taskParamsSchema }),
  async (request, response) => {
    const params = request.params as TaskParams;
    const body = request.body as UpdateTaskBody;
    const image = await uploadRequestImage(request.file);

    try {
      const task = await updateTask(params.id, {
        ...body,
        ...(image ? { image } : {}),
      });

      response.status(200).json({ task });
    } catch (error) {
      await deleteTaskImage(image?.imageKey);
      throw error;
    }
  }
);

tasksRouter.delete(
  "/:id",
  validateRequest({ params: taskParamsSchema }),
  async (request, response) => {
    const params = request.params as TaskParams;
    await deleteTask(params.id);

    response.status(204).send();
  }
);

function parseOptionalImageUpload(request: Request, response: Response, next: NextFunction): void {
  if (!request.is("multipart/form-data")) {
    next();
    return;
  }

  imageUpload.single("image")(request, response, (error: unknown) => {
    if (!error) {
      next();
      return;
    }

    if (error instanceof multer.MulterError) {
      next(toUploadParseError(error));
      return;
    }

    next(error);
  });
}

async function uploadRequestImage(
  file: Express.Multer.File | undefined
): Promise<UploadedImageMetadata | null> {
  if (!file) {
    return null;
  }

  return uploadTaskImage({
    buffer: file.buffer,
    contentType: file.mimetype,
    size: file.size,
  });
}

function toUploadParseError(error: multer.MulterError): AppError {
  if (error.code === "LIMIT_FILE_SIZE") {
    return new AppError("Image exceeds maximum allowed size", {
      code: "IMAGE_TOO_LARGE",
      details: {
        maxImageBytes: env.MAX_IMAGE_BYTES,
      },
      statusCode: 413,
    });
  }

  return new AppError("Image upload request is invalid", {
    code: "INVALID_IMAGE_UPLOAD",
    details: {
      reason: error.code,
    },
    statusCode: 400,
  });
}
