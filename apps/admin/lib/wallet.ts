// Server-only client for the wallet service (services/wallet, 127.0.0.1:8095).
// WALLET_INTERNAL_TOKEN never leaves the server. The staff identity headers are built here from the staff
// session the gateway verified (lib/bff.ts requireStaff), never from anything the browser sends.

import type { GatewayStaff } from "@/lib/gateway";
import { financePerms } from "@/lib/wallet-perms";

const WALLET_URL = (process.env.WALLET_URL ?? "http://127.0.0.1:8095").replace(/\/$/, "");
const INTERNAL_TOKEN = process.env.WALLET_INTERNAL_TOKEN ?? "";

export const walletConfigured = () => INTERNAL_TOKEN.length > 0;

type Method = "GET" | "POST" | "PUT";

type Identity = { staff: GatewayStaff; ip?: string | null; userAgent?: string | null };

/** The service token and the staff identity headers of a call (JSON or raw). */
function identity(init: Identity): Record<string, string> {
  const headers: Record<string, string> = {
    "x-ezymex-internal": INTERNAL_TOKEN,
    "x-ezymex-tenant": init.staff.tenant.slug || "ezymex",
    "x-ezymex-service": "admin",
    "x-ezymex-staff-id": String(init.staff.id),
    "x-ezymex-staff-name": encodeURIComponent(init.staff.name || init.staff.email),
    "x-ezymex-staff-role": init.staff.role,
    // exact finance.* keys: the wallet enforces finance.adjust / credit / adjust_approve / adjust_force itself
    // ("-" when none: an empty header would fall back to the role check)
    "x-ezymex-staff-perms": financePerms(init.staff).join(",") || "-",
  };
  if (init.ip) headers["x-forwarded-for"] = init.ip;
  if (init.userAgent) headers["user-agent"] = init.userAgent;
  return headers;
}

export async function walletService<T = unknown>(
  path: string,
  init: Identity & { method?: Method; body?: unknown; timeoutMs?: number },
): Promise<{ status: number; data: T }> {
  const headers = identity(init);
  if (init.body !== undefined) headers["content-type"] = "application/json";
  try {
    const res = await fetch(`${WALLET_URL}${path}`, {
      method: init.method ?? (init.body !== undefined ? "POST" : "GET"),
      headers,
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(init.timeoutMs ?? 30_000),
    });
    const text = await res.text();
    let data: unknown = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { error: { code: "bad_gateway", message: "The wallet service returned an unexpected response." } };
    }
    return { status: res.status, data: data as T };
  } catch {
    return { status: 503, data: { error: { code: "unavailable", message: "The wallet service is unavailable. Please try again shortly." } } as T };
  }
}

/**
 * A call whose body isn't JSON (manual payments: a QR image upload, an image read, the CSV export): the same identity
 * headers, the raw response handed back for the route to stream. `raw` = an image upload (the service sniffs the type);
 * `headers` = extra request headers (If-None-Match). `null` when the service can't be reached.
 */
export async function walletRaw(
  path: string,
  init: Identity & { method?: "GET" | "POST"; raw?: ArrayBuffer; headers?: Record<string, string>; timeoutMs?: number },
): Promise<Response | null> {
  const headers = { ...identity(init), ...(init.headers ?? {}) };
  if (init.raw !== undefined) headers["content-type"] = "application/octet-stream";
  try {
    return await fetch(`${WALLET_URL}${path}`, {
      method: init.method ?? (init.raw !== undefined ? "POST" : "GET"),
      headers,
      body: init.raw,
      cache: "no-store",
      signal: AbortSignal.timeout(init.timeoutMs ?? 30_000),
    });
  } catch {
    return null;
  }
}
