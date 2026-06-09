import { apiRequest } from "./client.js";

export interface HealthResponse {
  readonly status: "ok";
}

export function getHealth(options: { readonly signal?: AbortSignal } = {}) {
  return apiRequest<HealthResponse>("/health", {
    signal: options.signal,
  });
}
