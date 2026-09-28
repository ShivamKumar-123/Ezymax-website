import { NextResponse, type NextRequest } from "next/server";
import type { GatewayUser } from "@/lib/gateway";
import { prop } from "@/lib/prop";
import { sameOrigin, sessionUser } from "@/lib/trading";

// Client Area prop BFF. Browser -> /api/prop/<route> (same origin) -> prop service /v1/…
// The client is resolved from the HttpOnly gateway session cookie (gateway /v1/auth/me) and forwarded as
// X-Kalks-User-Id / X-Kalks-User-Name / X-Kalks-User-Kyc; ids sent by the browser are never used, and the
// service returns 404 for challenges the user doesn't own. CSRF: cookies are SameSite=Lax, POSTs must be JSON
// with a same-origin Origin.
//
//   GET  plans                                 -> GET  /v1/plans
//   GET  challenges                            -> GET  /v1/challenges
//   POST challenges    {planId,size,idempotencyKey} -> POST /v1/challenges (credentials returned once)
//   GET  challenges/{id}                       -> GET  /v1/challenges/{id}  (+ payout quote, events, certificates)
//   GET  challenges/{id}/equity?phase&limit    -> GET  /v1/challenges/{id}/equity
//   GET  challenges/{id}/events?limit          -> GET  /v1/challenges/{id}/events
//   GET  challenges/{id}/trades?phase          -> GET  /v1/challenges/{id}/trades
//   POST challenges/{id}/payouts               -> POST /v1/challenges/{id}/payouts
//   GET  payouts                               -> GET  /v1/payouts
//   GET  certificates                          -> GET  /v1/certificates
//   GET  notifications                         -> GET  /v1/notifications
//   POST notifications/read                    -> POST /v1/notifications/read

type Obj = Record<string, unknown>;
type Ctx = { params: Promise<{ path: string[] }> };

const NO_STORE = { "cache-control": "no-store" };
const ID_RE = /^\d{1,12}$/;
const KEY_RE = /^[A-Za-z0-9_-]{1,80}$/;
const PLAN_RE = /^[a-z0-9][a-z0-9_-]{0,63}$/i;

function error(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status, headers: NO_STORE });
}

function reply(status: number, data: unknown) {
  return NextResponse.json(data, { status, headers: NO_STORE });
}

async function auth(req: NextRequest): Promise<GatewayUser | NextResponse> {
  const user = await sessionUser(req);
  if (user === "unavailable") return error(503, "unavailable", "Sign-in service is unavailable. Please try again shortly.");
  if (!user) return error(401, "unauthorized", "Please sign in.");
  return user;
}

/** phase (0–9) / limit (1–max), validated before they reach the service. */
function phaseQuery(req: NextRequest, allow: { phase?: boolean; limit?: number }): string | NextResponse {
  const sp = req.nextUrl.searchParams;
  const out = new URLSearchParams();
  const phase = sp.get("phase");
  if (allow.phase && phase !== null && phase !== "") {
    const n = Number(phase);
    if (!Number.isInteger(n) || n < 0 || n > 9) return error(400, "bad_request", "Invalid phase.");
    out.set("phase", String(n));
  }
  const limit = sp.get("limit");
  if (allow.limit && limit !== null && limit !== "") {
    const n = Number(limit);
    if (!Number.isInteger(n) || n < 1 || n > allow.limit) return error(400, "bad_request", "Invalid limit.");
    out.set("limit", String(n));
  }
  const s = out.toString();
  return s ? `?${s}` : "";
}

export async function GET(req: NextRequest, { params }: Ctx) {
  const path = (await params).path;
  const user = await auth(req);
  if (user instanceof NextResponse) return user;

  if (path.length === 1 && ["plans", "challenges", "payouts", "certificates", "notifications"].includes(path[0]!)) {
    const r = await prop(`/v1/${path[0]}`, { user, req });
    return reply(r.status, r.data);
  }

  const id = path[1];
  if (path[0] !== "challenges" || !id || !ID_RE.test(id)) return error(404, "not_found", "Not found.");

  if (path.length === 2) {
    const r = await prop(`/v1/challenges/${id}`, { user, req });
    return reply(r.status, r.data);
  }

  if (path.length === 3) {
    const allow = path[2] === "equity" ? { phase: true, limit: 5000 } : path[2] === "events" ? { limit: 500 } : path[2] === "trades" ? { phase: true } : null;
    if (!allow) return error(404, "not_found", "Not found.");
    const q = phaseQuery(req, allow);
    if (q instanceof NextResponse) return q;
    const r = await prop(`/v1/challenges/${id}/${path[2]}${q}`, { user, req });
    return reply(r.status, r.data);
  }

  return error(404, "not_found", "Not found.");
}

export async function POST(req: NextRequest, { params }: Ctx) {
  const path = (await params).path;
  if (!sameOrigin(req)) return error(403, "forbidden", "Cross-site request blocked.");
  if (!req.headers.get("content-type")?.includes("application/json")) return error(415, "bad_request", "Expected JSON.");
  const body = (await req.json().catch(() => null)) as Obj | null;
  if (body === null || typeof body !== "object" || Array.isArray(body)) return error(400, "bad_request", "Invalid request body.");
  const user = await auth(req);
  if (user instanceof NextResponse) return user;

  if (path.length === 1 && path[0] === "challenges") {
    if (typeof body.planId !== "string" || !PLAN_RE.test(body.planId)) return error(422, "validation", "Choose a challenge plan.");
    if (typeof body.size !== "number" || !Number.isFinite(body.size) || body.size <= 0) return error(422, "validation", "Choose an account size.");
    if (typeof body.idempotencyKey !== "string" || !KEY_RE.test(body.idempotencyKey)) return error(422, "validation", "Invalid request key. Reload the page and try again.");
    // Trading passwords come back exactly once, here; they are not stored anywhere by the Client Area.
    const r = await prop("/v1/challenges", { user, req, body: { planId: body.planId, size: body.size, idempotencyKey: body.idempotencyKey } });
    return reply(r.status, r.data);
  }

  if (path.length === 2 && path[0] === "notifications" && path[1] === "read") {
    const r = await prop("/v1/notifications/read", { user, req, body: {} });
    return reply(r.status, r.data);
  }

  if (path.length === 3 && path[0] === "challenges" && ID_RE.test(path[1] ?? "") && path[2] === "payouts") {
    const r = await prop(`/v1/challenges/${path[1]}/payouts`, { user, req, body: {} });
    return reply(r.status, r.data);
  }

  return error(404, "not_found", "Not found.");
}
