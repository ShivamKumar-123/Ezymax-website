// Server-only client for services/academy. The browser never sees the service or its internal token.

import type { GatewayStaff } from "@/lib/gateway";

const ACADEMY_URL = process.env.ACADEMY_URL ?? "http://127.0.0.1:8098";
const ACADEMY_TOKEN = process.env.ACADEMY_INTERNAL_TOKEN ?? "";

export async function academyAdmin(path: string, init: { method?: "GET" | "POST" | "PUT" | "DELETE"; body?: unknown; staff: GatewayStaff }): Promise<{ status: number; data: unknown }> {
  const headers: Record<string, string> = {
    "x-kalks-internal": ACADEMY_TOKEN,
    "x-kalks-tenant": init.staff.tenant?.slug || "kalks",
    "x-kalks-staff": init.staff.email,
  };
  if (init.body !== undefined) headers["content-type"] = "application/json";
  try {
    const res = await fetch(`${ACADEMY_URL}${path}`, {
      method: init.method ?? (init.body !== undefined ? "POST" : "GET"),
      headers,
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      cache: "no-store",
    });
    return { status: res.status, data: await res.json().catch(() => ({})) };
  } catch {
    return { status: 503, data: { error: { code: "unavailable", message: "The Academy service is unavailable. Please try again shortly." } } };
  }
}
