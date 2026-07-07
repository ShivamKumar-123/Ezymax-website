'use client';

/**
 * Central fetch helper for the IB portal. Owns the sessionStorage Bearer
 * token, querystring building, and 401 handling — every page imports from here.
 */

export const IB_TOKEN_KEY = 'ib_portal_token';
export const IB_NAME_KEY = 'ib_portal_name';

export function ibToken(): string | null {
  return typeof window !== 'undefined' ? sessionStorage.getItem(IB_TOKEN_KEY) : null;
}
export function ibName(): string {
  return typeof window !== 'undefined' ? sessionStorage.getItem(IB_NAME_KEY) || '' : '';
}
export function setSession(token: string, name: string) {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(IB_TOKEN_KEY, token);
  sessionStorage.setItem(IB_NAME_KEY, name || '');
}
export function clearSession() {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(IB_TOKEN_KEY);
  sessionStorage.removeItem(IB_NAME_KEY);
}

export class UnauthorizedError extends Error {
  constructor() {
    super('unauthorized');
    this.name = 'UnauthorizedError';
  }
}

type Params = Record<string, string | number | boolean | null | undefined>;

function qs(params?: Params): string {
  if (!params) return '';
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === null || v === undefined || v === '') continue;
    sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : '';
}

async function handle<T>(res: Response): Promise<T> {
  if (res.status === 401) {
    clearSession();
    throw new UnauthorizedError();
  }
  if (!res.ok) {
    let detail = `Request failed (${res.status})`;
    try {
      const j = await res.json();
      if (typeof j?.detail === 'string') detail = j.detail;
    } catch {
      /* non-JSON */
    }
    throw new Error(detail);
  }
  return res.json();
}

export async function ibGet<T = any>(path: string, params?: Params): Promise<T> {
  const t = ibToken();
  const res = await fetch(`/api/v1${path}${qs(params)}`, {
    headers: t ? { Authorization: `Bearer ${t}` } : {},
    cache: 'no-store',
  });
  return handle<T>(res);
}

export async function ibPost<T = any>(path: string, body?: unknown): Promise<T> {
  const t = ibToken();
  const res = await fetch(`/api/v1${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(t ? { Authorization: `Bearer ${t}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return handle<T>(res);
}

/* ── formatters ─────────────────────────────────────────────── */
export function fmt(n: number | string | null | undefined): string {
  return (Number(n) || 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
export function fmtDate(d: string | null | undefined): string {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString();
  } catch {
    return d;
  }
}
export function fmtDateTime(d: string | null | undefined): string {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleString();
  } catch {
    return d;
  }
}
