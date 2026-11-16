/**
 * HTTP client for the OneRoboLab API, shared by the student app and the admin
 * console. The browser only ever talks to the API — never to the database;
 * no database URL or secret is part of the web bundle. Auth is
 * `Authorization: Bearer <token>`.
 */

/** An error answered by the API (`{error: {code, message, details}}`) or a network failure (status 0). */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: unknown;
  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }

  /** Field-level problems from a 400 VALIDATION_FAILED, keyed by path. */
  fieldErrors(): Record<string, string> {
    if (!Array.isArray(this.details)) return {};
    const out: Record<string, string> = {};
    for (const d of this.details as { path?: unknown; message?: unknown }[]) {
      if (typeof d?.path === 'string' && typeof d.message === 'string' && !(d.path in out)) out[d.path] = d.message;
    }
    return out;
  }

  /** Readable list of problems (422 details such as LEVEL_NOT_READY). */
  problems(): string[] {
    if (!Array.isArray(this.details)) return [];
    return (this.details as unknown[]).flatMap((d) => (typeof d === 'string' ? [d] : typeof (d as { message?: unknown })?.message === 'string' ? [(d as { message: string }).message] : []));
  }
}

export type QueryValue = string | number | boolean | null | undefined;
export type Query = Readonly<Record<string, QueryValue>>;

export interface ApiClientOptions {
  /** '' = same origin (Vite proxies /api in dev); otherwise the API's origin, e.g. https://api.example.com */
  readonly baseUrl: string;
  readonly getToken: () => string | null;
  /** Called when a signed-in request gets 401 (session expired or revoked). */
  readonly onUnauthorized: () => void;
  /** Reachability after every request: false on a network failure, true on any answer. */
  readonly onConnectivity?: (online: boolean) => void;
  readonly fetch?: typeof fetch;
}

export interface ApiClient {
  get<T>(path: string, query?: Query): Promise<T>;
  post<T>(path: string, body?: unknown): Promise<T>;
  put<T>(path: string, body?: unknown): Promise<T>;
  patch<T>(path: string, body?: unknown): Promise<T>;
  del<T = void>(path: string): Promise<T>;
}

/** `?a=1&b=x` from a query object; empty values are left out. */
export function toQueryString(query: Query | undefined): string {
  if (!query) return '';
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) if (v !== undefined && v !== null && v !== '') params.set(k, String(v));
  const s = params.toString();
  return s ? `?${s}` : '';
}

export function createApiClient(options: ApiClientOptions): ApiClient {
  const doFetch = options.fetch ?? ((...args: Parameters<typeof fetch>) => fetch(...args));
  const base = options.baseUrl.replace(/\/+$/, '');

  async function request<T>(method: string, path: string, body?: unknown, query?: Query): Promise<T> {
    const headers: Record<string, string> = { accept: 'application/json' };
    const token = options.getToken();
    if (token) headers.authorization = `Bearer ${token}`;
    if (body !== undefined) headers['content-type'] = 'application/json';
    let res: Response;
    try {
      res = await doFetch(`${base}${path}${toQueryString(query)}`, {
        method,
        headers,
        ...(body !== undefined && { body: JSON.stringify(body) }),
        credentials: 'omit',
      });
    } catch {
      options.onConnectivity?.(false);
      throw new ApiError(0, 'NETWORK_ERROR', 'Cannot reach the server. Check your connection and try again.');
    }
    // A gateway error means the API itself is unreachable (e.g. the dev proxy with the API down).
    options.onConnectivity?.(res.status !== 502 && res.status !== 503 && res.status !== 504);
    if (res.status === 204) return undefined as T;
    let payload: unknown = null;
    const text = await res.text();
    if (text) {
      try {
        payload = JSON.parse(text);
      } catch {
        payload = null;
      }
    }
    if (!res.ok) {
      const err = (payload as { error?: { code?: unknown; message?: unknown; details?: unknown } } | null)?.error;
      const apiError = new ApiError(
        res.status,
        typeof err?.code === 'string' ? err.code : `HTTP_${res.status}`,
        typeof err?.message === 'string' ? err.message : `The server answered ${res.status}.`,
        err?.details,
      );
      if (res.status === 401 && token && path !== '/api/auth/login') options.onUnauthorized();
      throw apiError;
    }
    return payload as T;
  }

  return {
    get: (path, query) => request('GET', path, undefined, query),
    post: (path, body) => request('POST', path, body ?? {}),
    put: (path, body) => request('PUT', path, body ?? {}),
    patch: (path, body) => request('PATCH', path, body ?? {}),
    del: (path) => request('DELETE', path),
  };
}

/** True for failures that mean "offline / server unreachable" rather than a refused request. */
export const isNetworkError = (e: unknown): boolean => e instanceof ApiError && (e.status === 0 || e.status === 502 || e.status === 503 || e.status === 504);

/** Human message for any thrown value. */
export function errorMessage(e: unknown): string {
  if (e instanceof ApiError) {
    const problems = e.problems();
    return problems.length ? `${e.message} ${problems.join(' ')}` : e.message;
  }
  return e instanceof Error ? e.message : 'Something went wrong.';
}
