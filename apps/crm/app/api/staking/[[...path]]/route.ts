import { NextResponse, type NextRequest } from "next/server";
import { staking } from "@/lib/staking";
import { sameOrigin, sessionUser } from "@/lib/trading";

// Staking (Earn) BFF. Browser -> /api/staking/<route> (same origin) -> staking service /v1/staking/me/…
// The client is resolved from the HttpOnly gateway session cookie; the service gets that user id in
// X-Ezymex-User-Id. A user id sent by the browser is never used. Mutations must be same-origin JSON. The module
// switch (staking, off by default) is enforced by the proxy (lib/modules.ts). Routes (services/staking/README.md):
//
//   GET   plans                     plans on sale, own principal per plan, past settled rates
//   GET   portfolio                 summary, positions, monthly returns
//   GET   history?page=&limit=      subscriptions, returns, principal back
//   GET   positions · positions/{id}
//   POST  positions                 {planId, amount, idempotencyKey, acceptTerms, acceptRisk}

type Ctx = { params: Promise<{ path?: string[] }> };
const NO_STORE = { "cache-control": "no-store" };

function error(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status, headers: NO_STORE });
}

const GET_ROUTES = [/^plans$/, /^portfolio$/, /^history$/, /^positions$/, /^positions\/\d{1,18}$/];
const POST_ROUTES = [/^positions$/];
const QUERY_KEYS = ["page", "limit"];

async function handle(req: NextRequest, ctx: Ctx, method: "GET" | "POST") {
  const path = ((await ctx.params).path ?? []).join("/");
  const allowed = (method === "GET" ? GET_ROUTES : POST_ROUTES).some((r) => r.test(path));
  if (!allowed) return error(404, "not_found", "Not found.");
  let body: unknown;
  if (method !== "GET") {
    if (!sameOrigin(req)) return error(403, "forbidden", "Cross-site request blocked.");
    if (!req.headers.get("content-type")?.includes("application/json")) return error(415, "bad_request", "Expected JSON.");
    body = await req.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) return error(400, "bad_request", "Invalid request body.");
  }
  const user = await sessionUser(req);
  if (user === "unavailable") return error(503, "unavailable", "Sign-in service is unavailable. Please try again shortly.");
  if (!user) return error(401, "unauthorized", "Please sign in.");

  const q = new URLSearchParams();
  for (const k of QUERY_KEYS) {
    const v = req.nextUrl.searchParams.get(k);
    if (v && /^\d{1,4}$/.test(v)) q.set(k, v);
  }
  const target = `/v1/staking/me/${path}${method === "GET" && q.size ? `?${q}` : ""}`;
  const r = await staking<Record<string, unknown>>(target, { method, body, user });
  return NextResponse.json(r.data, { status: r.status, headers: NO_STORE });
}

export const GET = (req: NextRequest, ctx: Ctx) => handle(req, ctx, "GET");
export const POST = (req: NextRequest, ctx: Ctx) => handle(req, ctx, "POST");
