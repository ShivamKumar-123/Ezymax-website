// Browser-side calls to this app's /api/auth route handlers (same origin, HttpOnly cookies).

export type ApiError = { code: string; message: string; field?: string; retry_after?: number; attempts_left?: number };

export type OtpChallenge = {
  status: "otp_required";
  challenge: string;
  purpose: "verify_email" | "login" | "reset_password";
  email_masked: string;
  expires_in: number;
  resend_in: number;
  /** Development only: SMTP is not configured, so the gateway returns the code for the dev hint. */
  dev_code?: string;
};

export type AuthResult<T> = { ok: true; data: T } | { ok: false; error: ApiError };

export async function authPost<T = Record<string, unknown>>(action: string, body: unknown = {}): Promise<AuthResult<T>> {
  try {
    const res = await fetch(`/api/auth/${action}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      credentials: "same-origin",
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) return { ok: true, data: data as T };
    return { ok: false, error: (data?.error as ApiError) ?? { code: "unknown", message: "Something went wrong. Please try again." } };
  } catch {
    return { ok: false, error: { code: "network", message: "Can't reach Kalks. Check your connection and try again." } };
  }
}

export async function authGet<T = Record<string, unknown>>(action: string): Promise<AuthResult<T>> {
  try {
    const res = await fetch(`/api/auth/${action}`, { credentials: "same-origin", cache: "no-store" });
    const data = await res.json().catch(() => ({}));
    if (res.ok) return { ok: true, data: data as T };
    return { ok: false, error: (data?.error as ApiError) ?? { code: "unknown", message: "Something went wrong. Please try again." } };
  } catch {
    return { ok: false, error: { code: "network", message: "Can't reach Kalks. Check your connection and try again." } };
  }
}

/** Where to go after sign-in: the ?next= page if it is a safe same-app path, else the dashboard. */
export function nextPath(): string {
  if (typeof window === "undefined") return "/";
  const n = new URLSearchParams(window.location.search).get("next");
  return n && n.startsWith("/") && !n.startsWith("//") && !n.startsWith("/\\") && !n.startsWith("/api/") ? n : "/";
}
