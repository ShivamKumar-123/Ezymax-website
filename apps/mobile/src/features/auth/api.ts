// Auth calls (App -> /api/mobile/auth/<action> -> gateway). The session token comes back in the body.
import { apiGet, apiPost, type ApiResult } from "@/lib/api";
import { adoptDeviceId } from "@/lib/device";
import type { Me } from "@/session";

export type OtpChallenge = {
  status: "otp_required";
  challenge: string;
  purpose: "verify_email" | "login" | "reset_password" | "confirm";
  email_masked: string;
  expires_in: number;
  resend_in: number;
  action?: string;
  target?: string;
  /** development servers only (no SMTP): the code, for the dev hint */
  dev_code?: string;
};

export type SessionAnswer = { status: "ok"; user?: Me; session?: { token: string; expires_at: string }; device?: string };

export async function authPost<T>(action: string, body: unknown = {}): Promise<ApiResult<T>> {
  const r = await apiPost<T & { device?: string }>(`auth/${action}`, body);
  if (r.ok) await adoptDeviceId(r.data.device);
  return r as ApiResult<T>;
}

export const authMe = () => apiGet<{ user?: Me }>("auth/me");
