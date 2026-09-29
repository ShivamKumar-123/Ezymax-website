// Server-only client for the reports service (services/reports, 127.0.0.1:8102). REPORTS_INTERNAL_TOKEN never
// leaves the server; the staff identity and the caller's reports.* permissions are built from the staff session
// the gateway verified (lib/bff.ts requireStaff), never from anything the browser sends.

import type { GatewayStaff } from "@/lib/gateway";
import { reportsPermsOf } from "@/lib/reports-perms";

const REPORTS_URL = (process.env.REPORTS_URL ?? "http://127.0.0.1:8102").replace(/\/$/, "");
const TOKEN = process.env.REPORTS_INTERNAL_TOKEN ?? "";

export const reportsConfigured = () => TOKEN.length > 0 || process.env.NODE_ENV !== "production";

export async function reportsFetch(path: string, init: { method?: "GET" | "POST" | "PUT" | "DELETE"; body?: unknown; staff: GatewayStaff; timeoutMs?: number }): Promise<Response | null> {
  const headers: Record<string, string> = {
    "x-kalks-internal": TOKEN,
    "x-kalks-tenant": init.staff.tenant?.slug || "kalks",
    "x-kalks-staff-id": String(init.staff.id),
    "x-kalks-staff-name": encodeURIComponent(init.staff.name || init.staff.email),
    "x-kalks-staff-role": init.staff.role,
    "x-kalks-staff-perms": reportsPermsOf(init.staff).join(","),
  };
  if (init.body !== undefined) headers["content-type"] = "application/json";
  try {
    return await fetch(`${REPORTS_URL}${path}`, {
      method: init.method ?? "GET",
      headers,
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(init.timeoutMs ?? 120_000),
    });
  } catch {
    return null;
  }
}
