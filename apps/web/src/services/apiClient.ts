import type { ApiErrorBody, ApiErrorDetail } from '@neo/shared-types';

const BASE_URL = import.meta.env.VITE_API_URL ?? '/api/v1';
/** El backend exige este header en peticiones que modifican estado (protección CSRF con cookies). */
const CSRF_HEADERS = { 'X-Requested-With': 'neo-web' } as const;

export class ApiError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly details: ApiErrorDetail[] = [],
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  /** Objeto → JSON. Un FormData se envía tal cual (el navegador fija el Content-Type con su boundary). */
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined>;
  signal?: AbortSignal;
}

let onSessionLost: (() => void) | undefined;

/** La sesión registra aquí qué hacer cuando ya no se puede renovar el acceso. */
export function setSessionLostHandler(handler: (() => void) | undefined): void {
  onSessionLost = handler;
}

// Una sola renovación a la vez: varias peticiones que fallan juntas comparten la misma promesa.
// Es necesario porque el refresh token rota; usarlo dos veces dispararía la detección de reutilización.
let refreshing: Promise<boolean> | null = null;

function refreshSession(): Promise<boolean> {
  refreshing ??= fetch(new URL(`${BASE_URL}/auth/refresh`, window.location.origin), {
    method: 'POST',
    credentials: 'include',
    headers: CSRF_HEADERS,
  })
    .then((res) => res.ok)
    .catch(() => false)
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

async function send(path: string, { method = 'GET', body, query, signal }: RequestOptions): Promise<Response> {
  const url = new URL(`${BASE_URL}${path}`, window.location.origin);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }
  const headers: Record<string, string> = { ...CSRF_HEADERS };
  const isForm = typeof FormData !== 'undefined' && body instanceof FormData;
  if (body !== undefined && !isForm) headers['Content-Type'] = 'application/json';
  return fetch(url, {
    method,
    credentials: 'include',
    headers,
    body: body === undefined ? undefined : isForm ? (body as FormData) : JSON.stringify(body),
    signal,
  });
}

/** Cliente HTTP: cookies HttpOnly (sin tokens en localStorage, §10.1) y errores con el contrato de §8. */
export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  let res = await send(path, options);

  // Access token vencido: se renueva una vez y se reintenta. Las rutas /auth/* no se reintentan.
  if (res.status === 401 && !path.startsWith('/auth/')) {
    if (await refreshSession()) {
      res = await send(path, options);
    } else {
      onSessionLost?.();
    }
  }

  if (!res.ok) {
    const err = (await res.json().catch(() => null)) as ApiErrorBody | null;
    throw new ApiError(res.status, err?.message ?? 'Error de red', err?.details ?? []);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
