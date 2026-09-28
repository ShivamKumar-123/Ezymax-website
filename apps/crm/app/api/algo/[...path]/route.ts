import { NextResponse, type NextRequest } from "next/server";
import type { GatewayUser } from "@/lib/gateway";
import { algo, type AlgoMethod } from "@/lib/algo";
import { sameOrigin, sessionUser } from "@/lib/trading";

// ALGO BFF: browser -> /api/algo/<path> (same origin, session cookie) -> algo service /v1/<path>.
// The client is resolved from the HttpOnly gateway session (never from the request); only the client routes
// listed below are forwarded (the Back Office routes of the service are never reachable from here).
// Mutations must be same-origin JSON (cookies are SameSite=Lax).

type Ctx = { params: Promise<{ path: string[] }> };
type Rule = { method: AlgoMethod; re: RegExp; timeoutMs?: number };

const ID = "\\d{1,18}";
const RULES: Rule[] = [
  { method: "GET", re: /^meta$/ },
  { method: "POST", re: /^validate$/ },
  { method: "POST", re: /^ai\/strategy$/, timeoutMs: 240_000 },
  { method: "GET", re: /^strategies$/ },
  { method: "POST", re: /^strategies$/ },
  { method: "GET", re: new RegExp(`^strategies/${ID}$`) },
  { method: "PATCH", re: new RegExp(`^strategies/${ID}$`) },
  { method: "POST", re: new RegExp(`^strategies/${ID}/versions$`) },
  { method: "GET", re: new RegExp(`^strategies/${ID}/versions/${ID}$`) },
  { method: "GET", re: /^backtests$/ },
  { method: "POST", re: /^backtests$/ },
  { method: "GET", re: new RegExp(`^backtests/${ID}$`) },
  { method: "POST", re: new RegExp(`^backtests/${ID}/cancel$`) },
  { method: "GET", re: /^accounts$/ },
  { method: "GET", re: /^deployments$/ },
  { method: "POST", re: /^deployments$/ },
  { method: "GET", re: new RegExp(`^deployments/${ID}$`) },
  { method: "POST", re: new RegExp(`^deployments/${ID}/(pause|resume|stop|kill|close-positions)$`) },
  { method: "GET", re: /^controls$/ },
  { method: "POST", re: /^controls\/kill$/, timeoutMs: 120_000 },
  { method: "GET", re: /^webhooks$/ },
  { method: "POST", re: /^webhooks$/ },
  { method: "GET", re: new RegExp(`^webhooks/${ID}$`) },
  { method: "PATCH", re: new RegExp(`^webhooks/${ID}$`) },
  { method: "DELETE", re: new RegExp(`^webhooks/${ID}$`) },
  { method: "POST", re: new RegExp(`^webhooks/${ID}/(rotate|test)$`) },
  { method: "PUT", re: new RegExp(`^webhooks/${ID}/routes$`) },
  { method: "GET", re: /^keys$/ },
  { method: "POST", re: /^keys$/ },
  { method: "PATCH", re: new RegExp(`^keys/${ID}$`) },
  { method: "POST", re: new RegExp(`^keys/${ID}/revoke$`) },
  { method: "GET", re: new RegExp(`^keys/${ID}/activity$`) },
  { method: "GET", re: /^market\/listings$/ },
  { method: "POST", re: /^market\/listings$/ },
  { method: "GET", re: new RegExp(`^market/listings/${ID}$`) },
  { method: "PATCH", re: new RegExp(`^market/listings/${ID}$`) },
  { method: "POST", re: new RegExp(`^market/listings/${ID}/(subscribe|reviews)$`) },
  { method: "GET", re: /^market\/(mine|subscriptions)$/ },
  { method: "POST", re: new RegExp(`^market/subscriptions/${ID}/cancel$`) },
];

const NO_STORE = { "cache-control": "no-store" };
const QUERY_KEYS = ["strategy_id", "limit", "before", "q", "sort", "symbol", "price"];

function error(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status, headers: NO_STORE });
}

async function handle(req: NextRequest, parts: string[], method: AlgoMethod) {
  const path = parts.map((p) => decodeURIComponent(p)).join("/");
  const rule = RULES.find((r) => r.method === method && r.re.test(path));
  if (!rule) return error(404, "not_found", "Not found.");
  let body: unknown;
  if (method !== "GET") {
    if (!sameOrigin(req)) return error(403, "forbidden", "Cross-site request blocked.");
    if (method !== "DELETE") {
      if (!req.headers.get("content-type")?.includes("application/json")) return error(415, "bad_request", "Expected JSON.");
      const text = await req.text();
      if (text.length > 200_000) return error(413, "too_large", "Request body is too large.");
      try {
        body = text ? JSON.parse(text) : {};
      } catch {
        return error(400, "bad_request", "Invalid JSON.");
      }
      if (body === null || typeof body !== "object" || Array.isArray(body)) return error(400, "bad_request", "Invalid request body.");
    }
  }
  const user = await sessionUser(req);
  if (user === "unavailable") return error(503, "unavailable", "Sign-in service is unavailable. Please try again shortly.");
  if (!user) return error(401, "unauthorized", "Please sign in.");
  const q = new URLSearchParams();
  for (const k of QUERY_KEYS) {
    const v = req.nextUrl.searchParams.get(k);
    if (v !== null && v.length <= 80) q.set(k, v);
  }
  const qs = method === "GET" && q.toString() ? `?${q}` : "";
  const r = await algo(`/v1/${path}${qs}`, { method, body, user: user as GatewayUser, req, timeoutMs: rule.timeoutMs });
  return NextResponse.json(r.data, { status: r.status, headers: NO_STORE });
}

export async function GET(req: NextRequest, { params }: Ctx) {
  return handle(req, (await params).path, "GET");
}
export async function POST(req: NextRequest, { params }: Ctx) {
  return handle(req, (await params).path, "POST");
}
export async function PATCH(req: NextRequest, { params }: Ctx) {
  return handle(req, (await params).path, "PATCH");
}
export async function PUT(req: NextRequest, { params }: Ctx) {
  return handle(req, (await params).path, "PUT");
}
export async function DELETE(req: NextRequest, { params }: Ctx) {
  return handle(req, (await params).path, "DELETE");
}
