import { NextResponse, type NextRequest } from "next/server";
import { newsService, publicNews } from "@/lib/news";
import { sameOrigin, sessionUser } from "@/lib/trading";
import { SESSION_COOKIE } from "@/lib/gateway";

// Client Area news + economic calendar BFF. Browser -> /api/news/<route> (same origin) -> services/news /v1/…
// Headlines, the map, the calendar and the daily brief are public reads (no sign-in needed; a signed-in
// client gets their broker's pinned / hidden stories). Reminders are per client and need the session.
//
//   GET    feed?symbol&currency&country&category&sentiment&q&before&limit&minImportance&hours
//   GET    feed/{id} · map?hours · sources · brief?day
//   GET    calendar?from&to&currency&impact · calendar/next?impact · calendar/{id}
//   GET    me/calendar                        my reminders + alert subscription
//   POST   me/calendar/reminders              {eventId, minutes?}
//   DELETE me/calendar/reminders/{eventId}
//   PUT    me/calendar/alerts                 {highImpact, currencies[], minutes}
//   DELETE me/calendar/alerts

type Ctx = { params: Promise<{ path: string[] }> };

const ID = /^\d{1,15}$/;
const PUBLIC_CACHE = { "cache-control": "private, max-age=30" };
const NO_STORE = { "cache-control": "no-store" };

function error(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status, headers: NO_STORE });
}

function reply(r: { status: number; data: unknown }, cache = false) {
  return NextResponse.json(r.data, { status: r.status, headers: cache && r.status === 200 ? PUBLIC_CACHE : NO_STORE });
}

function query(req: NextRequest, keys: string[]) {
  const out = new URLSearchParams();
  for (const k of keys) {
    const v = req.nextUrl.searchParams.get(k);
    if (v) out.set(k, v.slice(0, 80));
  }
  const s = out.toString();
  return s ? `?${s}` : "";
}

/** Signed-in client when there is a session (for tenant overrides); reads never fail on a missing session. */
async function optionalUser(req: NextRequest) {
  if (!req.cookies.get(SESSION_COOKIE)?.value) return null;
  const u = await sessionUser(req);
  return u && u !== "unavailable" ? u : null;
}

async function requireUser(req: NextRequest) {
  const user = await sessionUser(req);
  if (user === "unavailable") return error(503, "unavailable", "Sign-in service is unavailable. Please try again shortly.");
  if (!user) return error(401, "unauthorized", "Please sign in.");
  return user;
}

export async function GET(req: NextRequest, { params }: Ctx) {
  const path = (await params).path;
  const [a, b] = path;
  if (a === "me" && b === "calendar" && path.length === 2) {
    const user = await requireUser(req);
    if (user instanceof NextResponse) return user;
    return reply(await newsService("/v1/me/calendar", { user }));
  }
  const user = await optionalUser(req);
  if (a === "feed" && path.length === 1) return reply(await publicNews(`/v1/news${query(req, ["symbol", "currency", "country", "category", "sentiment", "q", "before", "limit", "minImportance", "hours"])}`, user), true);
  if (a === "feed" && path.length === 2 && ID.test(b!)) return reply(await publicNews(`/v1/news/${b}`, user), true);
  if (a === "map" && path.length === 1) return reply(await publicNews(`/v1/news/map${query(req, ["hours"])}`, user), true);
  if (a === "sources" && path.length === 1) return reply(await publicNews("/v1/news/sources", user), true);
  if (a === "brief" && path.length === 1) return reply(await publicNews(`/v1/brief${query(req, ["day"])}`, user), true);
  if (a === "calendar" && path.length === 1) return reply(await publicNews(`/v1/calendar${query(req, ["from", "to", "currency", "impact"])}`, user), true);
  if (a === "calendar" && path.length === 2 && b === "next") return reply(await publicNews(`/v1/calendar/next${query(req, ["impact"])}`, user), true);
  if (a === "calendar" && path.length === 2 && ID.test(b!)) return reply(await publicNews(`/v1/calendar/${b}`, user), true);
  return error(404, "not_found", "Not found.");
}

async function jsonBody(req: NextRequest) {
  if (!sameOrigin(req)) return error(403, "forbidden", "Cross-site request blocked.");
  if (!req.headers.get("content-type")?.includes("application/json")) return error(415, "bad_request", "Expected JSON.");
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body !== "object" || Array.isArray(body)) return error(400, "bad_request", "Invalid JSON body.");
  return body;
}

export async function POST(req: NextRequest, { params }: Ctx) {
  const path = (await params).path;
  if (path.join("/") !== "me/calendar/reminders") return error(404, "not_found", "Not found.");
  const body = await jsonBody(req);
  if (body instanceof NextResponse) return body;
  const user = await requireUser(req);
  if (user instanceof NextResponse) return user;
  const eventId = Number(body.eventId);
  if (!Number.isInteger(eventId) || eventId <= 0) return error(400, "bad_request", "Invalid eventId.");
  const minutes = body.minutes === undefined ? undefined : Number(body.minutes);
  return reply(await newsService("/v1/me/calendar/reminders", { user, body: { eventId, ...(minutes !== undefined ? { minutes } : {}) } }));
}

export async function PUT(req: NextRequest, { params }: Ctx) {
  const path = (await params).path;
  if (path.join("/") !== "me/calendar/alerts") return error(404, "not_found", "Not found.");
  const body = await jsonBody(req);
  if (body instanceof NextResponse) return body;
  const user = await requireUser(req);
  if (user instanceof NextResponse) return user;
  const currencies = Array.isArray(body.currencies) ? body.currencies.filter((c): c is string => typeof c === "string").slice(0, 12) : [];
  return reply(await newsService("/v1/me/calendar/alerts", { method: "PUT", user, body: { highImpact: body.highImpact !== false, currencies, minutes: Number(body.minutes ?? 15) } }));
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  const path = (await params).path;
  if (!sameOrigin(req)) return error(403, "forbidden", "Cross-site request blocked.");
  const user = await requireUser(req);
  if (user instanceof NextResponse) return user;
  if (path.length === 4 && path.slice(0, 3).join("/") === "me/calendar/reminders" && ID.test(path[3]!)) return reply(await newsService(`/v1/me/calendar/reminders/${path[3]}`, { method: "DELETE", user }));
  if (path.join("/") === "me/calendar/alerts") return reply(await newsService("/v1/me/calendar/alerts", { method: "DELETE", user }));
  return error(404, "not_found", "Not found.");
}
