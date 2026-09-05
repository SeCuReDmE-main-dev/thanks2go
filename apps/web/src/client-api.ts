type PublicApiError = { code?: unknown; message?: unknown };

export class ApiError extends Error {
  constructor(message: string, readonly code: string | undefined, readonly status: number) {
    super(message);
  }
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, init);
  const text = await response.text();
  let body: unknown;
  try {
    body = text ? JSON.parse(text) : undefined;
  } catch {
    if (!response.ok) throw new ApiError("Request failed", undefined, response.status);
    throw new ApiError("The server returned an invalid response.", undefined, response.status);
  }
  if (!response.ok) {
    const error = body && typeof body === "object" && !Array.isArray(body) ? body as PublicApiError : undefined;
    throw new ApiError(typeof error?.message === "string" ? error.message : "Request failed", typeof error?.code === "string" ? error.code : undefined, response.status);
  }
  return body as T;
}
