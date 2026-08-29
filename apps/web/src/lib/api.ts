const API_URL: string = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export class ApiError extends Error {}

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

export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`;
  }

  const response = await fetch(`${API_URL}${path}`, {
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
    throw new ApiError(extractErrorMessage(errorField));
  }

  return data as T;
}
