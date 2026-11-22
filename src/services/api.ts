const API_BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') || '';

let memoryToken: string | null = null;
let tokenRefreshFn: (() => Promise<string | null>) | null = null;

export function setApiAccessToken(token: string | null) {
  memoryToken = token;
}

export function setTokenRefresher(fn: (() => Promise<string | null>) | null) {
  tokenRefreshFn = fn;
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit & { skipAuth?: boolean } = {}
): Promise<T> {
  const { skipAuth, headers, ...rest } = options;
  let token = memoryToken;

  if (!skipAuth && !token && tokenRefreshFn) {
    token = await tokenRefreshFn();
  }

  const requestHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(headers as Record<string, string>),
  };

  if (!skipAuth && token) {
    requestHeaders.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...rest,
    headers: requestHeaders,
  });

  if (res.status === 401 && !skipAuth && tokenRefreshFn) {
    const freshToken = await tokenRefreshFn();
    if (freshToken && freshToken !== token) {
      requestHeaders.Authorization = `Bearer ${freshToken}`;
      const retry = await fetch(`${API_BASE}${path}`, {
        ...rest,
        headers: requestHeaders,
      });
      const retryData = await retry.json().catch(() => ({}));
      if (!retry.ok) {
        throw new ApiError(retryData.error || 'Request failed', retry.status);
      }
      return retryData as T;
    }
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(data.error || `Request failed (${res.status})`, res.status);
  }
  return data as T;
}
