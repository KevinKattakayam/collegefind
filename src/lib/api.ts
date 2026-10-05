/**
 * Browser-side fetch helpers. All API calls are same-origin relative paths.
 * `apiJson` throws ApiClientError on non-2xx so callers cannot silently treat
 * an error body as data.
 */
export class ApiClientError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly details?: Record<string, string>,
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

export function apiFetch(path: string, init?: RequestInit) {
  return fetch(path, { credentials: 'same-origin', ...init });
}

export async function apiJson<T = Record<string, unknown>>(path: string, init?: RequestInit): Promise<T> {
  const res = await apiFetch(path, init);
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    /* non-JSON body */
  }
  if (!res.ok) {
    const b = (body ?? {}) as { error?: string; details?: Record<string, string> };
    throw new ApiClientError(res.status, b.error ?? `Request failed (${res.status})`, b.details);
  }
  return body as T;
}

export function postJson<T = Record<string, unknown>>(path: string, data: unknown, method = 'POST') {
  return apiJson<T>(path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}
