// Server-only client for the Kalks reports service (services/reports, 127.0.0.1:8102): analytics, monthly
// statement list and statement files. The browser never sees the service or its token: /api/reports resolves the
// signed-in client from the gateway session and forwards the gateway user id as X-Kalks-User-Id.
// Contract: services/reports/README.md ("Client routes").

import type { GatewayUser } from "@/lib/gateway";

const REPORTS_URL = (process.env.REPORTS_URL ?? "http://127.0.0.1:8102").replace(/\/+$/, "");
const REPORTS_TOKEN = process.env.REPORTS_INTERNAL_TOKEN ?? "";

/** Raw call; the caller decides whether the body is JSON or a file. null = service unreachable. */
export async function reportsFetch(path: string, user: GatewayUser, timeoutMs = 60_000): Promise<Response | null> {
  try {
    return await fetch(`${REPORTS_URL}${path}`, {
      headers: { "x-kalks-internal": REPORTS_TOKEN, "x-kalks-tenant": user.tenant?.slug || "kalks", "x-kalks-user-id": String(user.id) },
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch {
    return null;
  }
}
