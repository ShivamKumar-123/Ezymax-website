import { NextResponse, type NextRequest } from "next/server";
import { growth, growthImage } from "@/lib/growth";

const IMMUTABLE = "public, max-age=31536000, immutable";
import { sameOrigin, sessionUser } from "@/lib/trading";

// Rewards & marketing BFF. Browser -> /api/growth/<route> (same origin) -> growth service /v1/growth/me/…
// The client is resolved from the HttpOnly gateway session cookie; the service gets that user id in
// X-Ezymex-User-Id plus the segment headers (country, KYC, sign-up date, name, referral code). A user id sent by
// the browser is never used. Mutations must be same-origin JSON. Routes (services/growth/README.md):
//
//   GET   rewards                         points, tier, tiers, earn rules, catalogue, recent, series
//   GET   points?kind=&page=&limit=       points history
//   POST  redeem                          {itemId, login?}
//   GET   redemptions · vouchers
//   GET   cashback                        programmes, totals, accruals, payouts, series
//   POST  cashback/{programmeId}/enrol    {}
//   GET   promotions                      campaigns, grants, promo history
//   POST  bonuses/{campaignId}/claim      {login?}
//   POST  promo                           {code, login?}
//   GET   contests · contests/{id}
//   POST  contests/{id}/join              {login?} (demo: credentials returned once, passed through)
//   GET   banners?placement=              banner slot items (+ hero items on the dashboard)
//   POST  banners/{id}/events             {kind}
//   GET   posts?kind=&page=&limit=        Events & updates (events and brand posts targeted at the client)
//   GET   posts/{id}                      an event / post page (markdown body)
//   GET   shares · POST shares            {kind, login, dealId | from/to, showAmounts}
//   GET   media/{id}                      an uploaded image: public (no session; the app and <img> load it), immutable

type Ctx = { params: Promise<{ path?: string[] }> };
const NO_STORE = { "cache-control": "no-store" };

function error(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status, headers: NO_STORE });
}

const ID = String.raw`[A-Za-z0-9_-]{1,64}`;
const GET_ROUTES = [/^rewards$/, /^points$/, /^redemptions$/, /^vouchers$/, /^cashback$/, /^promotions$/, /^contests$/, new RegExp(`^contests/${ID}$`), /^banners$/, /^posts$/, /^posts\/\d{1,18}$/, /^shares$/];
/** Uploaded images: 24 hex characters (services/growth src/media.rs). */
const MEDIA = /^media\/([0-9a-f]{24})$/;
const POST_ROUTES = [
  /^redeem$/,
  new RegExp(`^cashback/${ID}/enrol$`),
  new RegExp(`^bonuses/${ID}/claim$`),
  /^promo$/,
  new RegExp(`^contests/${ID}/join$`),
  new RegExp(`^banners/${ID}/events$`),
  /^shares$/,
];
const QUERY_KEYS = ["placement", "kind", "page", "limit"];

async function handle(req: NextRequest, ctx: Ctx, method: "GET" | "POST") {
  const path = ((await ctx.params).path ?? []).join("/");
  const media = method === "GET" ? MEDIA.exec(path) : null;
  if (media) return image(req, media[1]!);
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
    if (v && v.length <= 60) q.set(k, v);
  }
  const target = `/v1/growth/me/${path}${method === "GET" && q.size ? `?${q}` : ""}`;
  const r = await growth<Record<string, unknown>>(target, { method, body, user });
  return NextResponse.json(r.data, { status: r.status, headers: NO_STORE });
}

/** An uploaded banner / event / post image. Public like the share card images: ids are random and an id never changes
 *  content, so it is cached for a year (browsers, Cloudflare); 304 on a revalidation. */
async function image(req: NextRequest, id: string) {
  const r = await growthImage(id, req.headers.get("if-none-match"));
  if (r.status === 304) return new NextResponse(null, { status: 304, headers: { "cache-control": IMMUTABLE, ...(r.etag ? { etag: r.etag } : {}) } });
  if (r.status !== 200 || !r.bytes) return error(r.status === 404 ? 404 : 503, r.status === 404 ? "not_found" : "unavailable", r.status === 404 ? "Not found." : "Images are unavailable right now.");
  return new NextResponse(r.bytes, {
    status: 200,
    headers: {
      "content-type": r.type,
      "cache-control": IMMUTABLE,
      "x-content-type-options": "nosniff",
      "content-security-policy": "default-src 'none'",
      ...(r.etag ? { etag: r.etag } : {}),
    },
  });
}

export const GET = (req: NextRequest, ctx: Ctx) => handle(req, ctx, "GET");
export const POST = (req: NextRequest, ctx: Ctx) => handle(req, ctx, "POST");
