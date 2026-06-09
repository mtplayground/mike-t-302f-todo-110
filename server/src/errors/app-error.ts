export interface AppErrorOptions {
  readonly cause?: unknown;
  readonly code?: string;
  readonly details?: unknown;
  readonly expose?: boolean;
  readonly statusCode?: number;
}

export class AppError extends Error {
  readonly code: string;
  readonly details?: unknown;
  readonly expose: boolean;
  readonly statusCode: number;

  constructor(message: string, options: AppErrorOptions = {}) {
    super(message, { cause: options.cause });
    this.name = "AppError";
    this.code = options.code ?? "INTERNAL_SERVER_ERROR";
    this.details = options.details;
    this.expose = options.expose ?? (options.statusCode ?? 500) < 500;
    this.statusCode = options.statusCode ?? 500;
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}
