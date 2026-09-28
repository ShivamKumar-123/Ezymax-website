import { NextResponse, type NextRequest } from "next/server";
import { ib, ibFor } from "@/lib/ib";
import { sameOrigin, sessionUser } from "@/lib/trading";

// Partner (IB programme) BFF. Browser -> /api/partner/<route> (same origin) -> IB service /v1/ib/me/…
// The client is resolved from the HttpOnly gateway session cookie; the IB service gets that user id in
// X-Kalks-User-Id. A user id sent by the browser is never used. Mutations must be same-origin JSON.
//
//   GET   (root)                     dashboard: member, level + progress, earnings, funnel, series, top clients, recent
//                                    + linkBase (this app's public origin, for referral links)
//   GET   programme                  levels, rate card, tiers, CPA, rules, payout schedule
//   GET   campaigns                  campaign links with click → sign-up → FTD funnel
//   POST  campaigns                  {name, slug?, landing?, utmSource?, utmMedium?, utmCampaign?}
//   PATCH campaigns/{id}             {active?, name?}
//   GET   clients?tier=&q=           network clients (details per the broker's visibility setting)
//   GET   clients/{id}/trades        a client's closed trades (full visibility only)
//   GET   network                    tree nodes (flat, with parentId)
//   GET   commissions?status&kind&page&limit
//   GET   payouts
//   PUT   settings                   {rebatePct, splitPct}

type Ctx = { params: Promise<{ path?: string[] }> };
const NO_STORE = { "cache-control": "no-store" };

function error(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status, headers: NO_STORE });
}

const GET_ROUTES = [/^$/, /^programme$/, /^campaigns$/, /^clients$/, /^clients\/\d{1,18}\/trades$/, /^network$/, /^commissions$/, /^payouts$/];
const WRITE_ROUTES: { method: string; re: RegExp }[] = [
  { method: "POST", re: /^campaigns$/ },
  { method: "PATCH", re: /^campaigns\/\d{1,18}$/ },
  { method: "PUT", re: /^settings$/ },
];
const QUERY_KEYS = ["tier", "q", "status", "kind", "page", "limit"];

/** Public origin of this app (referral links point here: /r/CODE[/campaign]). */
function publicOrigin(req: NextRequest): string {
  const env = process.env.NEXT_PUBLIC_APP_URL;
  if (env) return env.replace(/\/+$/, "");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? req.nextUrl.host;
  const proto = req.headers.get("x-forwarded-proto") ?? req.nextUrl.protocol.replace(":", "");
  return `${proto}://${host}`;
}

async function handle(req: NextRequest, ctx: Ctx, method: "GET" | "POST" | "PUT" | "PATCH") {
  const path = ((await ctx.params).path ?? []).join("/");
  const allowed = method === "GET" ? GET_ROUTES.some((r) => r.test(path)) : WRITE_ROUTES.some((r) => r.method === method && r.re.test(path));
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
    if (v && v.length <= 60) q.set(k, v);
  }
  const target = `/v1/ib/me${path ? `/${path}` : ""}${method === "GET" && q.size ? `?${q}` : ""}`;
  const r = await ib<Record<string, unknown>>(target, { method, body, ...ibFor(user) });
  const withLinks = path === "" || path === "campaigns" || path === "clients";
  const data = withLinks && r.status === 200 ? { ...r.data, linkBase: publicOrigin(req) } : r.data;
  return NextResponse.json(data, { status: r.status, headers: NO_STORE });
}

export const GET = (req: NextRequest, ctx: Ctx) => handle(req, ctx, "GET");
export const POST = (req: NextRequest, ctx: Ctx) => handle(req, ctx, "POST");
export const PUT = (req: NextRequest, ctx: Ctx) => handle(req, ctx, "PUT");
export const PATCH = (req: NextRequest, ctx: Ctx) => handle(req, ctx, "PATCH");
