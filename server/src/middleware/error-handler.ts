import type { ErrorRequestHandler, NextFunction, Request, Response } from "express";
import { ZodError } from "zod";

import { AppError, isAppError } from "../errors/app-error.js";

interface ErrorPayload {
  readonly error: {
    readonly code: string;
    readonly details?: unknown;
    readonly message: string;
  };
}

export function notFoundHandler(request: Request, _response: Response, next: NextFunction): void {
  next(
    new AppError(`Route ${request.method} ${request.path} was not found`, {
      code: "ROUTE_NOT_FOUND",
      statusCode: 404,
    })
  );
}

export const errorHandler: ErrorRequestHandler = (error, _request, response, next) => {
  if (response.headersSent) {
    next(error);
    return;
  }

  const payload = toErrorPayload(error);

  if (payload.statusCode >= 500) {
    console.error(error);
  }

  response.status(payload.statusCode).json(payload.body);
};

function toErrorPayload(error: unknown): {
  readonly body: ErrorPayload;
  readonly statusCode: number;
} {
  if (error instanceof ZodError) {
    return {
      statusCode: 400,
      body: {
        error: {
          code: "VALIDATION_ERROR",
          details: error.issues.map((issue) => ({
            code: issue.code,
            message: issue.message,
            path: issue.path,
          })),
          message: "Request validation failed",
        },
      },
    };
  }

  if (isAppError(error)) {
    return {
      statusCode: error.statusCode,
      body: {
        error: {
          code: error.code,
          details: error.details,
          message: error.expose ? error.message : "Internal server error",
        },
      },
    };
  }

  return {
    statusCode: 500,
    body: {
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Internal server error",
      },
    },
  };
}
