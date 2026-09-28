// Server-only helpers for talking to the Kalks prop service (services/prop, 127.0.0.1:8097).
// The browser never sees the service or its internal token: route handlers under /api/prop resolve the signed-in
// client from the gateway session cookie and forward X-Kalks-User-Id / -Name / -Kyc. The public certificate
// page (/verify/<code>) calls the public routes server-side with the same token.
// Contract: services/prop/README.md ("Client routes", "Public routes").

import type { NextRequest } from "next/server";
import { clientIp, type GatewayUser } from "@/lib/gateway";

const PROP_URL = (process.env.PROP_URL ?? "http://127.0.0.1:8097").replace(/\/+$/, "");
const PROP_TOKEN = process.env.PROP_INTERNAL_TOKEN ?? "";

export type PropResult<T = Record<string, unknown>> = { status: number; data: T };

function displayName(u: GatewayUser): string {
  const n = (u.name || `${u.first_name ?? ""} ${u.last_name ?? ""}`).trim();
  return n || `Trader ${u.id}`;
}

export async function prop<T = Record<string, unknown>>(
  path: string,
  init: { method?: "GET" | "POST"; body?: unknown; user?: GatewayUser; req?: NextRequest } = {},
): Promise<PropResult<T>> {
  const headers: Record<string, string> = {
    "x-kalks-internal": PROP_TOKEN,
    "x-kalks-tenant": init.user?.tenant?.slug || "kalks",
  };
  if (init.user) {
    headers["x-kalks-user-id"] = String(init.user.id);
    headers["x-kalks-user-name"] = encodeURIComponent(displayName(init.user));
    if (init.user.kyc_status) headers["x-kalks-user-kyc"] = init.user.kyc_status;
  }
  if (init.req) {
    headers["x-forwarded-for"] = clientIp(init.req.headers);
    const ua = init.req.headers.get("user-agent");
    if (ua) headers["user-agent"] = ua;
  }
  const method = init.method ?? (init.body !== undefined ? "POST" : "GET");
  if (method === "POST") headers["content-type"] = "application/json";
  try {
    const res = await fetch(`${PROP_URL}${path}`, {
      method,
      headers,
      body: method === "POST" ? JSON.stringify(init.body ?? {}) : undefined,
      cache: "no-store",
    });
    const data = (await res.json().catch(() => ({}))) as T;
    return { status: res.status, data };
  } catch {
    return { status: 503, data: { error: { code: "unavailable", message: "Prop challenges are unavailable right now. Please try again shortly." } } as T };
  }
}

/* ------------------------------------------------------------------ */
/* Public certificates (no sign-in)                                    */
/* ------------------------------------------------------------------ */

export interface PublicCertificate {
  code: string;
  kind: "pass" | "funded" | "payout";
  title: string;
  traderName: string;
  planName: string;
  size: number;
  amount: number | null;
  phase: string | null;
  issuedAt: string;
  valid: boolean;
  verifyUrl: string;
}

/** Certificate codes: 4–32 of [A-Z0-9] (the service issues 10 characters). */
export const CERT_CODE_RE = /^[A-Za-z0-9]{4,32}$/;

/** null = not found; "unavailable" = service down. */
export async function publicCertificate(code: string): Promise<PublicCertificate | null | "unavailable"> {
  if (!CERT_CODE_RE.test(code)) return null;
  const r = await prop<PublicCertificate>(`/v1/public/certificates/${encodeURIComponent(code.toUpperCase())}`);
  if (r.status === 404) return null;
  if (r.status !== 200 || !r.data?.code) return "unavailable";
  return r.data;
}

/** "$100,000" / "$1,234.56" (same as the service's certificate text). */
export function certMoney(v: number): string {
  const whole = Math.abs(v - Math.round(v)) < 0.005;
  return `${v < 0 ? "-" : ""}$${Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: whole ? 0 : 2 })}`;
}

export function certHeadline(kind: PublicCertificate["kind"]): string {
  return kind === "payout" ? "Certificate of Payout" : kind === "funded" ? "Funded Trader" : "Certificate of Achievement";
}

export function certBig(c: Pick<PublicCertificate, "kind" | "amount" | "size">): string {
  return c.kind === "payout" && c.amount !== null ? certMoney(c.amount) : certMoney(c.size);
}

export function certSub(c: Pick<PublicCertificate, "kind" | "size" | "planName" | "phase">): string {
  if (c.kind === "payout") return `paid out on a ${certMoney(c.size)} ${c.planName} account`;
  if (c.kind === "funded") return `${certMoney(c.size)} funded account · ${c.planName}`;
  return `passed ${c.phase ?? "evaluation"} · ${certMoney(c.size)} account · ${c.planName}`;
}

export function certDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const m = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][d.getUTCMonth()];
  return `${String(d.getUTCDate()).padStart(2, "0")} ${m} ${d.getUTCFullYear()}`;
}
