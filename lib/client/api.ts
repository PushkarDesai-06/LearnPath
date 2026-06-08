/**
 * Tiny client-side fetch helper. Same-origin requests send the session cookie
 * automatically. Throws an Error (with the server's message) on non-2xx, with a
 * `status` property so callers can special-case 401.
 */
export class ApiClientError extends Error {
  status: number;
  details?: unknown;
  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export async function api<T = unknown>(
  path: string,
  options: { method?: string; body?: unknown } = {},
): Promise<T> {
  const res = await fetch(path, {
    method: options.method ?? (options.body ? "POST" : "GET"),
    headers: options.body ? { "content-type": "application/json" } : undefined,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  let data: unknown = null;
  const text = await res.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { error: text };
    }
  }

  if (!res.ok) {
    const message =
      (data as { error?: string })?.error ?? `Request failed (${res.status})`;
    throw new ApiClientError(
      res.status,
      message,
      (data as { details?: unknown })?.details,
    );
  }
  return data as T;
}
