// Server-only helper for talking to the Kalks Academy service (services/academy, 127.0.0.1:8098).
// The browser never sees the service or its internal token: /api/academy route handlers resolve the signed-in
// client from the gateway session cookie and forward the gateway user id (X-Kalks-User-Id), the tenant and,
// for exams, the learner's name for the certificate.

import type { GatewayUser } from "@/lib/gateway";

const ACADEMY_URL = process.env.ACADEMY_URL ?? "http://127.0.0.1:8098";
const ACADEMY_TOKEN = process.env.ACADEMY_INTERNAL_TOKEN ?? "";

export type AcademyResult = { status: number; data: unknown; contentType?: string; text?: string };

export async function academy(path: string, init: { method?: "GET" | "POST"; body?: unknown; user?: GatewayUser | null; raw?: boolean } = {}): Promise<AcademyResult> {
  const headers: Record<string, string> = { "x-kalks-internal": ACADEMY_TOKEN, "x-kalks-tenant": init.user?.tenant?.slug || "kalks" };
  if (init.user) {
    headers["x-kalks-user-id"] = String(init.user.id);
    headers["x-kalks-user-name"] = encodeURIComponent(init.user.name || `${init.user.first_name} ${init.user.last_name}`.trim());
    headers["x-kalks-tenant-name"] = encodeURIComponent(init.user.tenant?.name || "Kalks");
  }
  if (init.body !== undefined) headers["content-type"] = "application/json";
  try {
    const res = await fetch(`${ACADEMY_URL}${path}`, {
      method: init.method ?? (init.body !== undefined ? "POST" : "GET"),
      headers,
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      cache: "no-store",
    });
    if (init.raw) return { status: res.status, data: null, contentType: res.headers.get("content-type") ?? "", text: await res.text() };
    return { status: res.status, data: await res.json().catch(() => ({})) };
  } catch {
    return { status: 503, data: { error: { code: "unavailable", message: "The Academy is unavailable. Please try again shortly." } } };
  }
}
