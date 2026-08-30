const API_URL: string = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

type ApiFetchOptions = {
  method?: string;
  body?: unknown;
  token?: string | null;
};

type ZodIssue = { message?: string };

function extractErrorMessage(error: unknown): string {
  if (typeof error === "string") return error;
  if (Array.isArray(error) && error.length > 0) {
    const messages = (error as ZodIssue[])
      .map((issue) => issue.message)
      .filter((message): message is string => typeof message === "string");
    if (messages.length > 0) return messages.join(", ");
  }
  return "Ocurrió un error inesperado";
}

const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1000;
const REQUEST_TIMEOUT_MS = 15000;
const RETRYABLE_STATUSES = new Set([502, 503, 504]);

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

async function fetchWithRetry(url: string, init: RequestInit): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    try {
      const response = await fetchWithTimeout(url, init);
      if (RETRYABLE_STATUSES.has(response.status) && attempt < MAX_RETRIES) {
        await sleep(RETRY_DELAY_MS * (attempt + 1));
        continue;
      }
      return response;
    } catch (error) {
      if (attempt < MAX_RETRIES) {
        await sleep(RETRY_DELAY_MS * (attempt + 1));
        continue;
      }
      throw error;
    }
  }
}

export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`;
  }

  const response = await fetchWithRetry(`${API_URL}${path}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const data: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const errorField =
      data && typeof data === "object" && "error" in data
        ? (data as { error: unknown }).error
        : null;
    throw new ApiError(extractErrorMessage(errorField), response.status);
  }

  return data as T;
}
