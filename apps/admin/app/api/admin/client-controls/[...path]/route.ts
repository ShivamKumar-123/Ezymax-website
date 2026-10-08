import { NextResponse, type NextRequest } from "next/server";
import { clientIp, gateway } from "@/lib/gateway";
import { apiError, mutationAllowed, requireStaff } from "@/lib/bff";
import { engine } from "@/lib/trading";

// Client controls BFF (Back Office): who is online, restrictions, staff sessions as the client.
// Browser -> /api/admin/client-controls/<path> (same origin, staff cookie) -> gateway /v1/admin/... (the gateway
// checks the staff session, IP allow-list and permission: clients.read / clients.restrict / clients.block /
// clients.impersonate / clients.impersonate_full) and, where the engine is involved, the trading engine:
//
//   GET  presence                                  Online now / Away lists and counts
//   GET  users/{id}                                presence + devices, restrictions, history, staff sessions
//   GET  users/{id}/accounts                       the client's trading accounts (Ezymex Trader staff session picker)
//   PUT  users/{id}/restrictions/{kind}            {reason, expires_at?}   then the engine reloads the client
//   POST users/{id}/restrictions/{kind}/lift       {reason}
//   POST bulk                                      {user_ids[], kind, action: set|lift, reason, expires_at?}
//   POST users/{id}/impersonate                    {reason, mode, confirm?} -> {url} (Client Area, one-time, 60 s)
//   POST users/{id}/impersonate/trader             {login, reason, mode, confirm?} -> {url} (Ezymex Trader, one-time)
//   POST impersonations/{sessionId}/end

type Method = "GET" | "POST" | "PUT";
const ID = /^\d{1,18}$/;
const KIND = /^(login|trading|close_only|deposits|withdrawals|transfers|ib|social|freeze)$/;

/** Client Area and Ezymex Trader origins of this broker: env override, else the Back Office host's sibling
 *  (admin.<domain> -> app.<domain> / trade.<domain>; localhost:3001 -> :3000 / :3002). */
function appOrigins(req: NextRequest): { app: string; trade: string } {
  const envApp = process.env.CLIENT_AREA_URL ?? process.env.NEXT_PUBLIC_CRM_URL;
  const envTrade = process.env.TRADER_URL ?? process.env.NEXT_PUBLIC_TRADE_URL;
  const host = (req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "localhost:3001").split(",")[0]!.trim().toLowerCase();
  const proto = (req.headers.get("x-forwarded-proto") ?? req.nextUrl.protocol.replace(":", "")).split(",")[0]!.trim() || "https";
  const sibling = (sub: "app" | "trade", port: string) => {
    if (host.startsWith("admin.")) return `${proto}://${sub}.${host.slice(6)}`;
    const [name] = host.split(":");
    return `${proto}://${name}:${port}`;
  };
  return { app: (envApp ?? sibling("app", "3000")).replace(/\/$/, ""), trade: (envTrade ?? sibling("trade", "3002")).replace(/\/$/, "") };
}

function reply(status: number, data: unknown) {
  return NextResponse.json(data, { status, headers: { "cache-control": "no-store" } });
}

/** The engine reloads a client's restrictions right away (it also reloads every 10 s on its own). */
async function refreshEngine(userIds: number[]) {
  await Promise.all(userIds.map((id) => engine("/v1/internal/restrictions/refresh", { method: "POST", body: { userId: id }, timeoutMs: 5_000 }).catch(() => null)));
}

async function handle(req: NextRequest, parts: string[], method: Method) {
  const auth = await requireStaff(req);
  if (auth instanceof NextResponse) return auth;
  const { staff, token } = auth;
  let body: Record<string, unknown> = {};
  if (method !== "GET") {
    const blocked = mutationAllowed(req);
    if (blocked) return blocked;
    const b = await req.json().catch(() => null);
    if (!b || typeof b !== "object" || Array.isArray(b)) return apiError(400, "bad_request", "Invalid request body.");
    body = b as Record<string, unknown>;
  }
  const fwd = { token, ip: clientIp(req.headers), userAgent: req.headers.get("user-agent") };
  const gw = (path: string, m: Method = method, b?: unknown) => gateway(path, { method: m, body: m === "GET" ? undefined : (b ?? body), ...fwd });
  const [a, id, c, kind, e] = parts;

  if (method === "GET" && a === "presence" && parts.length === 1) {
    const r = await gw("/v1/admin/presence");
    return reply(r.status, r.data);
  }
  if (a === "users" && ID.test(id ?? "")) {
    if (method === "GET" && parts.length === 2) {
      const r = await gw(`/v1/admin/users/${id}/controls`);
      return reply(r.status, r.data);
    }
    if (method === "GET" && c === "accounts" && parts.length === 3) {
      // clients.read is enough to see which accounts a staff session could open (the engine has no such key)
      const me = await gw(`/v1/admin/users/${id}/controls`);
      if (me.status !== 200) return reply(me.status, me.data);
      const r = await engine<{ items?: Record<string, unknown>[] }>(`/v1/admin/accounts?user_id=${id}&limit=100`, { staff, ip: fwd.ip, userAgent: fwd.userAgent });
      if (r.status !== 200) return reply(r.status, r.data);
      const items = (r.data.items ?? []).map((x) => ({ login: x.login, type: x.type, group: x.group, groupName: x.groupName, currency: x.currency, status: x.status, equity: x.equity, balance: x.balance }));
      return reply(200, { items });
    }
    if (c === "restrictions" && KIND.test(kind ?? "")) {
      if (method === "PUT" && parts.length === 4) {
        const r = await gw(`/v1/admin/users/${id}/restrictions/${kind}`, "PUT", { reason: body.reason, expires_at: body.expires_at ?? null });
        if (r.status === 200) await refreshEngine([Number(id)]);
        return reply(r.status, r.data);
      }
      if (method === "POST" && e === "lift" && parts.length === 5) {
        const r = await gw(`/v1/admin/users/${id}/restrictions/${kind}/lift`, "POST", { reason: body.reason });
        if (r.status === 200) await refreshEngine([Number(id)]);
        return reply(r.status, r.data);
      }
    }
    if (method === "POST" && c === "impersonate" && parts.length === 3) {
      const r = await gw(`/v1/admin/users/${id}/impersonate`, "POST", { reason: body.reason, mode: body.mode, confirm: body.confirm === true });
      if (r.status !== 200) return reply(r.status, r.data);
      const d = r.data as { ticket?: string; mode?: string; client?: unknown; minutes?: number };
      if (!d.ticket) return apiError(502, "bad_gateway", "The sign-in service returned no link.");
      const url = `${appOrigins(req).app}/api/auth/impersonate?ticket=${encodeURIComponent(d.ticket)}`;
      return reply(200, { url, mode: d.mode, client: d.client, minutes: d.minutes, expires_in: 60 });
    }
    if (method === "POST" && c === "impersonate" && kind === "trader" && parts.length === 4) {
      const login = Number(body.login);
      if (!Number.isInteger(login) || login <= 0) return apiError(422, "validation", "Choose a trading account.");
      const r = await gw(`/v1/admin/users/${id}/impersonate/trader`, "POST", { login, reason: body.reason, mode: body.mode, confirm: body.confirm === true });
      if (r.status !== 200) return reply(r.status, r.data);
      const d = r.data as { read_only: boolean; minutes: number; staff: { id: number; name: string } };
      const s = await engine<{ token?: string; error?: unknown }>(`/v1/admin/accounts/${login}/staff-sso`, {
        method: "POST",
        staff: { ...staff, name: d.staff.name || staff.name },
        body: { userId: Number(id), readOnly: d.read_only, minutes: d.minutes },
        ip: fwd.ip,
        userAgent: fwd.userAgent,
      });
      if (s.status !== 200 || !s.data.token) return reply(s.status === 200 ? 502 : s.status, s.data);
      return reply(200, { url: `${appOrigins(req).trade}/sso?token=${encodeURIComponent(s.data.token)}`, login, read_only: d.read_only, minutes: d.minutes });
    }
  }
  if (method === "POST" && a === "bulk" && parts.length === 1) {
    const r = await gw("/v1/admin/restrictions/bulk", "POST", body);
    const done = (r.data as { done?: number[] }).done;
    if (r.status === 200 && Array.isArray(done)) await refreshEngine(done);
    return reply(r.status, r.data);
  }
  if (method === "POST" && a === "impersonations" && ID.test(id ?? "") && c === "end" && parts.length === 3) {
    const r = await gw(`/v1/admin/impersonations/${id}/end`, "POST", {});
    return reply(r.status, r.data);
  }
  return apiError(404, "not_found", "Not found.");
}

type Ctx = { params: Promise<{ path: string[] }> };
export const dynamic = "force-dynamic";
export const GET = async (req: NextRequest, { params }: Ctx) => handle(req, (await params).path, "GET");
export const POST = async (req: NextRequest, { params }: Ctx) => handle(req, (await params).path, "POST");
export const PUT = async (req: NextRequest, { params }: Ctx) => handle(req, (await params).path, "PUT");
