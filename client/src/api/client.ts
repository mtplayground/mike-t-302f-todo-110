export interface ApiRequestOptions extends Omit<RequestInit, "body"> {
  readonly body?: unknown;
}

export class ApiError extends Error {
  readonly body: unknown;
  readonly status: number;
  readonly statusText: string;

  constructor(message: string, response: Response, body: unknown) {
    super(message);
    this.name = "ApiError";
    this.body = body;
    this.status = response.status;
    this.statusText = response.statusText;
  }
}

export async function apiRequest<TResponse>(
  path: string,
  options: ApiRequestOptions = {}
): Promise<TResponse> {
  const response = await fetch(buildApiUrl(path), {
    ...options,
    headers: buildHeaders(options),
    body: serializeBody(options.body),
  });

  const body = await parseResponseBody(response);

  if (!response.ok) {
    throw new ApiError("API request failed", response, body);
  }

  return body as TResponse;
}

function buildApiUrl(path: string): string {
  const baseUrl = import.meta.env.VITE_API_BASE_URL;

  if (!baseUrl) {
    return path;
  }

  return new URL(path, baseUrl).toString();
}

function buildHeaders(options: ApiRequestOptions): Headers {
  const headers = new Headers(options.headers);

  if (
    options.body !== undefined &&
    !(options.body instanceof FormData) &&
    !headers.has("Content-Type")
  ) {
    headers.set("Content-Type", "application/json");
  }

  headers.set("Accept", "application/json");

  return headers;
}

function serializeBody(body: unknown): BodyInit | null | undefined {
  if (body === undefined || body === null || body instanceof FormData) {
    return body;
  }

  if (typeof body === "string" || body instanceof Blob || body instanceof URLSearchParams) {
    return body;
  }

  return JSON.stringify(body);
}

async function parseResponseBody(response: Response): Promise<unknown> {
  if (response.status === 204) {
    return undefined;
  }

  const contentType = response.headers.get("Content-Type");

  if (!contentType?.includes("application/json")) {
    return response.text();
  }

  return response.json();
}
