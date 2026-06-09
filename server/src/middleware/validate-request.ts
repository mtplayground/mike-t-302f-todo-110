import type { RequestHandler } from "express";
import type { ZodType } from "zod";

interface RequestSchemas {
  readonly body?: ZodType;
  readonly params?: ZodType;
  readonly query?: ZodType;
}

export function validateRequest(schemas: RequestSchemas): RequestHandler {
  return (request, _response, next) => {
    try {
      if (schemas.body) {
        request.body = schemas.body.parse(request.body);
      }

      if (schemas.params) {
        request.params = schemas.params.parse(request.params) as typeof request.params;
      }

      if (schemas.query) {
        schemas.query.parse(request.query);
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}
