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

export type ApiFile = { bytes: Uint8Array; contentType: string; filename: string | null };

/**
 * A file from the BFF (statements, exports): the same headers, bearer session and error handling as api(), with the
 * body as bytes plus its type and the server's file name (Content-Disposition). Errors are the JSON error body in
 * the reader's language; a 401 ends the session.
 */
export async function apiFile(path: string, opts: { timeoutMs?: number; signal?: AbortSignal } = {}): Promise<ApiResult<ApiFile>> {
  const url = `${API_BASE}/api/mobile/${path.replace(/^\/+/, "")}`;
  const headers: Record<string, string> = { accept: "*/*", "x-kalks-device": await deviceId(), "x-kalks-locale": i18n.locale, "x-kalks-platform": PLATFORM, "x-kalks-app-version": APP_VERSION };
  const withAuth = !!sessionToken;
  if (withAuth) headers.authorization = `Bearer ${sessionToken}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 90_000);
  const abort = () => ctrl.abort();
  opts.signal?.addEventListener("abort", abort);
  try {
    const res = await fetch(url, { method: "GET", headers, credentials: "omit", signal: ctrl.signal });
    if (res.ok) {
      const bytes = new Uint8Array(await res.arrayBuffer());
      const name = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(res.headers.get("content-disposition") ?? "")?.[1];
      return { ok: true, status: res.status, data: { bytes, contentType: res.headers.get("content-type") ?? "application/octet-stream", filename: name ? decodeURIComponent(name) : null } };
    }
    let data: unknown = {};
    try {
      data = JSON.parse(await res.text());
    } catch {
      data = {};
    }
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

/**
 * Multipart upload (KYC documents, attachments) with progress: the same headers, bearer session and error handling
 * as api(). XMLHttpRequest, because fetch has no upload progress. The file part is `{ uri, name, type }` on the
 * phone and a Blob on the web preview.
 */
export async function apiUpload<T = Record<string, unknown>>(path: string, form: FormData, opts: { onProgress?: (pct: number) => void; timeoutMs?: number; signal?: AbortSignal } = {}): Promise<ApiResult<T>> {
  const url = `${API_BASE}/api/mobile/${path.replace(/^\/+/, "")}`;
  const headers: Record<string, string> = { accept: "application/json", "x-kalks-device": await deviceId(), "x-kalks-locale": i18n.locale, "x-kalks-platform": PLATFORM, "x-kalks-app-version": APP_VERSION };
  const withAuth = !!sessionToken;
  if (withAuth) headers.authorization = `Bearer ${sessionToken}`;
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    let settled = false;
    const abort = () => xhr.abort();
    const done = (r: ApiResult<T>) => {
      if (settled) return;
      settled = true;
      opts.signal?.removeEventListener("abort", abort);
      resolve(r);
    };
    const fail = () => done({ ok: false, status: 0, error: localizeError({ code: opts.signal?.aborted ? "aborted" : "network", message: i18n.t("auth.apiError.network") }) });
    xhr.open("POST", url);
    for (const [k, v] of Object.entries(headers)) xhr.setRequestHeader(k, v);
    xhr.timeout = opts.timeoutMs ?? 120_000;
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && e.total > 0) opts.onProgress?.(Math.min(100, Math.round((e.loaded / e.total) * 100)));
    };
    xhr.onload = () => {
      let data: unknown = {};
      try {
        data = xhr.responseText ? JSON.parse(xhr.responseText) : {};
      } catch {
        data = {};
      }
      if (xhr.status >= 200 && xhr.status < 300) return done({ ok: true, status: xhr.status, data: data as T });
      const raw = (data as { error?: ApiError }).error ?? { code: xhr.status === 503 ? "unavailable" : "unknown", message: i18n.t("common.errorRetry") };
      if (xhr.status === 401 && withAuth) unauthorized?.();
      done({ ok: false, status: xhr.status, error: localizeError({ ...raw, status: xhr.status }) });
    };
    xhr.onerror = fail;
    xhr.ontimeout = fail;
    xhr.onabort = fail;
    opts.signal?.addEventListener("abort", abort);
    xhr.send(form);
  });
}

/** Absolute URL of a mobile BFF path (for an image source that loads a signed-in file). */
export function apiUrl(path: string): string {
  return `${API_BASE}/api/mobile/${path.replace(/^\/+/, "")}`;
}

/** The headers api() sends (session, device, language, platform, version), for an image source that loads a
 *  signed-in file (expo-image `source.headers`, e.g. support chat attachments). */
export async function apiHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = { "x-kalks-device": await deviceId(), "x-kalks-locale": i18n.locale, "x-kalks-platform": PLATFORM, "x-kalks-app-version": APP_VERSION };
  if (sessionToken) headers.authorization = `Bearer ${sessionToken}`;
  return headers;
}

/**
 * Raw-body upload: the file itself is the request body, with its type and extra headers (support chat attachments:
 * `X-File-Name`). The same session, error handling and progress as apiUpload().
 */
export async function apiUploadRaw<T = Record<string, unknown>>(
  path: string,
  body: Blob,
  opts: { contentType: string; headers?: Record<string, string>; onProgress?: (pct: number) => void; timeoutMs?: number; signal?: AbortSignal },
): Promise<ApiResult<T>> {
  const headers: Record<string, string> = { accept: "application/json", ...(await apiHeaders()), ...opts.headers, "content-type": opts.contentType };
  const withAuth = !!headers.authorization;
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    let settled = false;
    const abort = () => xhr.abort();
    const done = (r: ApiResult<T>) => {
      if (settled) return;
      settled = true;
      opts.signal?.removeEventListener("abort", abort);
      resolve(r);
    };
    const fail = () => done({ ok: false, status: 0, error: localizeError({ code: opts.signal?.aborted ? "aborted" : "network", message: i18n.t("auth.apiError.network") }) });
    xhr.open("POST", apiUrl(path));
    for (const [k, v] of Object.entries(headers)) xhr.setRequestHeader(k, v);
    xhr.timeout = opts.timeoutMs ?? 120_000;
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && e.total > 0) opts.onProgress?.(Math.min(100, Math.round((e.loaded / e.total) * 100)));
    };
    xhr.onload = () => {
      let data: unknown = {};
      try {
        data = xhr.responseText ? JSON.parse(xhr.responseText) : {};
      } catch {
        data = {};
      }
      if (xhr.status >= 200 && xhr.status < 300) return done({ ok: true, status: xhr.status, data: data as T });
      const raw = (data as { error?: ApiError }).error ?? { code: xhr.status === 503 ? "unavailable" : "unknown", message: i18n.t("common.errorRetry") };
      if (xhr.status === 401 && withAuth) unauthorized?.();
      done({ ok: false, status: xhr.status, error: localizeError({ ...raw, status: xhr.status }) });
    };
    xhr.onerror = fail;
    xhr.ontimeout = fail;
    xhr.onabort = fail;
    if (opts.signal?.aborted) return fail();
    opts.signal?.addEventListener("abort", abort);
    xhr.send(body);
  });
}
