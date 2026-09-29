import { NextResponse, type NextRequest } from "next/server";
import { support } from "@/lib/support";
import { sameOrigin, sessionUser } from "@/lib/trading";

// Notifications BFF (bell + preferences). Browser -> /api/notifications[/route] -> services/support /v1/notifications/me…
//
//   GET  (root)?before&limit&unread     inbox page {items, unread, next}
//   POST read                           {ids?: number[], all?: true}
//   POST clear                          hide everything from the bell
//   GET  prefs                          {catalog, prefs}
//   PUT  prefs                          {prefs: {key: {inApp?, email?}}}

type Ctx = { params: Promise<{ path?: string[] }> };
const NO_STORE = { "cache-control": "no-store" };

function error(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status, headers: NO_STORE });
}

async function handle(req: NextRequest, ctx: Ctx, method: "GET" | "POST" | "PUT") {
  const path = ((await ctx.params).path ?? []).join("/");
  const allowed = (method === "GET" && (path === "" || path === "prefs")) || (method === "POST" && (path === "read" || path === "clear")) || (method === "PUT" && path === "prefs");
  if (!allowed) return error(404, "not_found", "Not found.");
  let body: unknown;
  if (method !== "GET") {
    if (!sameOrigin(req)) return error(403, "forbidden", "Cross-site request blocked.");
    body = await req.json().catch(() => ({}));
    if (!body || typeof body !== "object" || Array.isArray(body)) return error(400, "bad_request", "Invalid request body.");
  }
  const user = await sessionUser(req);
  if (user === "unavailable") return error(503, "unavailable", "Sign-in service is unavailable. Please try again shortly.");
  if (!user) return error(401, "unauthorized", "Please sign in.");
  const q = new URLSearchParams();
  for (const k of ["before", "limit", "unread"]) {
    const v = req.nextUrl.searchParams.get(k);
    if (v && /^[\w]{1,20}$/.test(v)) q.set(k, v);
  }
  const target = `/v1/notifications/me${path ? `/${path}` : ""}${method === "GET" && q.size ? `?${q}` : ""}`;
  const r = await support(target, { method, body, user });
  return NextResponse.json(r.data, { status: r.status, headers: NO_STORE });
}

export const GET = (req: NextRequest, ctx: Ctx) => handle(req, ctx, "GET");
export const POST = (req: NextRequest, ctx: Ctx) => handle(req, ctx, "POST");
export const PUT = (req: NextRequest, ctx: Ctx) => handle(req, ctx, "PUT");
