import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, clientIp, gateway, sameOrigin } from "@/lib/gateway";
import { engine, sessionUser } from "@/lib/trading";

// Client Area security BFF (D32, D90, D93, D94). Browser -> /api/security/<route> (same origin) -> gateway
// /v1/auth/<route> with the HttpOnly session cookie as bearer. The gateway checks the session on every call and
// refuses every change made with a view-only session (403 viewer_read_only).
//
//   GET   sessions                         live sessions of this client (current one marked)
//   POST  sessions/{id}/revoke             sign one device out
//   POST  sessions/revoke-others           sign every other device out
//   GET   logins                           sign-in history (90 days)
//   GET   viewers                          view-only logins + activity
//   POST  viewers                          {label, username?, accounts[], sections[], expires_at?, stepup_token}
//   PATCH viewers/{id}                     {label?, accounts?, sections?, expires_at?}
//   POST  viewers/{id}/password            {stepup_token}  -> new password, shown once
//   POST  viewers/{id}/revoke
//   POST  viewer-activity                  {path}  (viewer sessions: page views for the owner's log)
//   GET   requests                         closure / data-export requests
//   POST  requests                         {kind: closure|data_export, reason?}
//   POST  requests/{id}/cancel
//   GET   requests/{id}/export             personal data (JSON download) once staff completed the export

type Obj = Record<string, unknown>;
type Ctx = { params: Promise<{ path: string[] }> };

const NO_STORE = { "cache-control": "no-store" };
const ID = /^\d{1,18}$/;

function error(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status, headers: NO_STORE });
}

async function forward(req: NextRequest, path: string, method: "GET" | "POST" | "PATCH", body?: unknown) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return error(401, "unauthorized", "Please sign in.");
  const r = await gateway(path, { method, body, token, ip: clientIp(req.headers), userAgent: req.headers.get("user-agent") });
  return NextResponse.json(r.data, { status: r.status, headers: NO_STORE });
}

export async function GET(req: NextRequest, { params }: Ctx) {
  const p = (await params).path;
  if (p.length === 1 && ["sessions", "logins", "viewers", "requests"].includes(p[0]!)) return forward(req, `/v1/auth/${p[0]}`, "GET");
  if (p.length === 3 && p[0] === "requests" && ID.test(p[1]!) && p[2] === "export") {
    const token = req.cookies.get(SESSION_COOKIE)?.value;
    if (!token) return error(401, "unauthorized", "Please sign in.");
    const r = await gateway(`/v1/auth/requests/${p[1]}/export`, { token, ip: clientIp(req.headers), userAgent: req.headers.get("user-agent") });
    if (r.status !== 200) return NextResponse.json(r.data, { status: r.status, headers: NO_STORE });
    return new NextResponse(JSON.stringify(r.data, null, 2), {
      status: 200,
      headers: { ...NO_STORE, "content-type": "application/json; charset=utf-8", "content-disposition": `attachment; filename="ezymex-personal-data-${p[1]}.json"`, "x-content-type-options": "nosniff" },
    });
  }
  return error(404, "not_found", "Not found.");
}

async function readBody(req: NextRequest): Promise<Obj | NextResponse> {
  if (!sameOrigin(req.headers)) return error(403, "forbidden", "Cross-site request blocked.");
  if (!req.headers.get("content-type")?.includes("application/json")) return error(415, "bad_request", "Expected JSON.");
  const body = (await req.json().catch(() => null)) as Obj | null;
  if (body === null || typeof body !== "object" || Array.isArray(body)) return error(400, "bad_request", "Invalid request body.");
  return body;
}

/** The accounts a viewer is given must be this client's own trading accounts (checked with the engine). */
async function ownAccounts(req: NextRequest, accounts: unknown): Promise<NextResponse | null> {
  if (accounts === undefined) return null;
  if (!Array.isArray(accounts) || accounts.some((a) => typeof a !== "string" || !/^\d{1,20}$/.test(a))) return error(422, "validation", "Invalid trading account.");
  if (accounts.length === 0) return null;
  const user = await sessionUser(req);
  if (user === "unavailable") return error(503, "unavailable", "Sign-in service is unavailable. Please try again shortly.");
  if (!user) return error(401, "unauthorized", "Please sign in.");
  const r = await engine<{ accounts?: { login?: number | string }[] }>("/v1/accounts", { user, req });
  if (r.status !== 200) return NextResponse.json(r.data, { status: r.status, headers: NO_STORE });
  const own = new Set((r.data.accounts ?? []).map((a) => String(a.login)));
  if (accounts.some((a) => !own.has(a))) return NextResponse.json({ error: { code: "validation", field: "accounts", message: "Choose from your own trading accounts." } }, { status: 422, headers: NO_STORE });
  return null;
}

export async function POST(req: NextRequest, { params }: Ctx) {
  const p = (await params).path;
  const body = await readBody(req);
  if (body instanceof NextResponse) return body;

  if (p.length === 2 && p[0] === "sessions" && p[1] === "revoke-others") return forward(req, "/v1/auth/sessions/revoke-others", "POST", {});
  if (p.length === 3 && p[0] === "sessions" && ID.test(p[1]!) && p[2] === "revoke") return forward(req, `/v1/auth/sessions/${p[1]}/revoke`, "POST", {});
  if (p.length === 1 && p[0] === "viewer-activity") return forward(req, "/v1/auth/viewer/activity", "POST", { path: typeof body.path === "string" ? body.path : "" });
  if (p.length === 1 && p[0] === "viewers") {
    const bad = await ownAccounts(req, body.accounts ?? []);
    if (bad) return bad;
    return forward(req, "/v1/auth/viewers", "POST", body);
  }
  if (p.length === 3 && p[0] === "viewers" && ID.test(p[1]!) && (p[2] === "password" || p[2] === "revoke")) {
    return forward(req, `/v1/auth/viewers/${p[1]}/${p[2]}`, "POST", p[2] === "password" ? { stepup_token: body.stepup_token } : {});
  }
  if (p.length === 1 && p[0] === "requests") return forward(req, "/v1/auth/requests", "POST", { kind: body.kind, reason: body.reason });
  if (p.length === 3 && p[0] === "requests" && ID.test(p[1]!) && p[2] === "cancel") return forward(req, `/v1/auth/requests/${p[1]}/cancel`, "POST", {});
  return error(404, "not_found", "Not found.");
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const p = (await params).path;
  const body = await readBody(req);
  if (body instanceof NextResponse) return body;
  if (p.length === 2 && p[0] === "viewers" && ID.test(p[1]!)) {
    const bad = await ownAccounts(req, body.accounts);
    if (bad) return bad;
    const patch: Obj = {};
    for (const k of ["label", "accounts", "sections", "expires_at"]) if (k in body) patch[k] = body[k];
    return forward(req, `/v1/auth/viewers/${p[1]}`, "PATCH", patch);
  }
  return error(404, "not_found", "Not found.");
}
