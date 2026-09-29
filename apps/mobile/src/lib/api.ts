// The app's only way to the server: the Client Area BFF under /api/mobile/* (see apps/crm/lib/mobile.ts).
// Every request carries the session as `Authorization: Bearer <token>` (never a cookie), the device id, the
// language and the platform. Internal service tokens never exist in the app.
import { API_BASE, APP_VERSION, PLATFORM } from "./config";
import { deviceId } from "./device";
import { localizeError, type ApiError } from "./errors";
import { i18n } from "@/i18n";

export type { ApiError };
export type ApiResult<T> = { ok: true; status: number; data: T } | { ok: false; status: number; error: ApiError };

type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
export type ApiOptions = {
  method?: Method;
  body?: unknown;
  headers?: Record<string, string>;
  /** send the session token (default true) */
  auth?: boolean;
  timeoutMs?: number;
  signal?: AbortSignal;
};

let sessionToken: string | null = null;
let unauthorized: (() => void) | null = null;

/** Set by the session module (src/session). */
export function setApiSession(token: string | null) {
  sessionToken = token;
}
/** Called when the server says the session is gone (401 on an authenticated call). */
export function onApiUnauthorized(fn: () => void) {
  unauthorized = fn;
}

export async function api<T = Record<string, unknown>>(path: string, opts: ApiOptions = {}): Promise<ApiResult<T>> {
  const url = /^https?:\/\//.test(path) ? path : `${API_BASE}/api/mobile/${path.replace(/^\/+/, "")}`;
  const method = opts.method ?? (opts.body !== undefined ? "POST" : "GET");
  const headers: Record<string, string> = {
    accept: "application/json",
    "x-kalks-device": await deviceId(),
    "x-kalks-locale": i18n.locale,
    "x-kalks-platform": PLATFORM,
    "x-kalks-app-version": APP_VERSION,
    ...opts.headers,
  };
  const withAuth = opts.auth !== false && !!sessionToken;
  if (withAuth) headers.authorization = `Bearer ${sessionToken}`;
  // writes always carry a JSON body (the BFF rejects anything else)
  const body = opts.body !== undefined ? JSON.stringify(opts.body) : method === "GET" || method === "DELETE" ? undefined : "{}";
  if (body !== undefined) headers["content-type"] = "application/json";
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 20_000);
  const abort = () => ctrl.abort();
  opts.signal?.addEventListener("abort", abort);
  try {
    const res = await fetch(url, { method, headers, body, credentials: "omit", signal: ctrl.signal });
    const text = await res.text();
    let data: unknown = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = {};
    }
    if (res.ok) return { ok: true, status: res.status, data: data as T };
    const raw = (data as { error?: ApiError }).error ?? { code: res.status === 503 ? "unavailable" : "unknown", message: i18n.t("common.errorRetry") };
    if (res.status === 401 && withAuth) unauthorized?.();
    return { ok: false, status: res.status, error: localizeError({ ...raw, status: res.status }) };
  } catch {
    const aborted = opts.signal?.aborted;
    return { ok: false, status: 0, error: localizeError({ code: aborted ? "aborted" : "network", message: i18n.t("auth.apiError.network") }) };
  } finally {
    clearTimeout(timer);
    opts.signal?.removeEventListener("abort", abort);
  }
}

export const apiGet = <T = Record<string, unknown>>(path: string, opts?: Omit<ApiOptions, "method" | "body">) => api<T>(path, { ...opts, method: "GET" });
export const apiPost = <T = Record<string, unknown>>(path: string, body: unknown = {}, opts?: Omit<ApiOptions, "method" | "body">) => api<T>(path, { ...opts, method: "POST", body });
