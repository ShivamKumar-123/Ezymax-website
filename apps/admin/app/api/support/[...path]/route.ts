import { NextResponse, type NextRequest } from "next/server";
import { apiError, mutationAllowed, requireStaff } from "@/lib/bff";
import { SUPPORT_STREAM_URL, support, supportConfigured } from "@/lib/support";
import { supportAllow, supportPerms, type SupportPerm } from "@/lib/support-perms";

// Support inbox + notifications BFF: browser -> /api/support/<path> (same origin, staff cookie) -> services/support.
// The staff session is verified with the gateway on every call and the route's permission is checked here
// (lib/support-perms.ts); the service checks it again and writes the audit log.
//
//   me                                  GET   caller's support permissions
//   stream-ticket                       POST  {ticket, url} for the realtime stream (inbox + bell)
//   conversations[/…]                   inbox (support.read / support.write)  -> /v1/support/admin/conversations…
//   attachments/{id}                    GET   file                            -> /v1/support/admin/attachments/{id}
//   agents | me/status | canned[/…] | kb[/…] | stats | settings | audit      -> /v1/support/admin/…
//   notifications[/read|/clear]         the caller's staff bell               -> /v1/notifications/staff/me…
//   broadcasts[/preview] | types        composer (notifications.write)        -> /v1/notifications/admin/…

type Method = "GET" | "POST" | "PUT" | "DELETE";
type Route = { method: Method; re: RegExp; perm: SupportPerm | null; target: (p: string) => string };

const ID = "(\\d{1,18})";
const admin = (p: string) => `/v1/support/admin/${p}`;
const ROUTES: Route[] = [
  { method: "GET", re: /^conversations$/, perm: "support.read", target: admin },
  { method: "GET", re: new RegExp(`^conversations/${ID}(/context)?$`), perm: "support.read", target: admin },
  { method: "POST", re: new RegExp(`^conversations/${ID}/read$`), perm: "support.read", target: admin },
  { method: "POST", re: new RegExp(`^conversations/${ID}/(messages|assign|takeover|resolve|reopen|typing)$`), perm: "support.write", target: admin },
  { method: "PUT", re: new RegExp(`^conversations/${ID}/tags$`), perm: "support.write", target: admin },
  { method: "GET", re: /^(agents|canned|kb|stats|settings|audit)$/, perm: "support.read", target: admin },
  { method: "GET", re: new RegExp(`^kb/${ID}$`), perm: "support.read", target: admin },
  { method: "POST", re: /^kb\/test$/, perm: "support.read", target: admin },
  { method: "PUT", re: /^me\/status$/, perm: "support.read", target: admin },
  { method: "POST", re: new RegExp(`^canned/${ID}/use$`), perm: "support.read", target: admin },
  { method: "POST", re: /^(canned|kb)$/, perm: "support.write", target: admin },
  { method: "PUT", re: new RegExp(`^(canned|kb)/${ID}$`), perm: "support.write", target: admin },
  { method: "DELETE", re: new RegExp(`^(canned|kb)/${ID}$`), perm: "support.write", target: admin },
  { method: "PUT", re: /^settings$/, perm: "support.write", target: admin },
  { method: "GET", re: /^notifications$/, perm: null, target: () => "/v1/notifications/staff/me" },
  { method: "POST", re: /^notifications\/(read|clear)$/, perm: null, target: (p) => `/v1/notifications/staff/me/${p.split("/")[1]}` },
  { method: "GET", re: /^broadcasts$/, perm: "notifications.write", target: () => "/v1/notifications/admin/broadcasts" },
  { method: "POST", re: /^broadcasts(\/preview)?$/, perm: "notifications.write", target: (p) => `/v1/notifications/admin/${p}` },
];

const QUERY_KEYS = ["queue", "q", "limit", "user_id", "category", "source", "days", "before", "action", "unread"];
const MAX_UPLOAD = 10 * 1024 * 1024;

async function handle(req: NextRequest, parts: string[], method: Method) {
  const path = parts.map((p) => decodeURIComponent(p)).join("/");
  if (!supportConfigured()) return apiError(503, "not_configured", "The support service is not configured for the Back Office.");

  if (method === "GET" && path === "me") {
    const who = await requireStaff(req);
    if (who instanceof NextResponse) return who;
    return NextResponse.json({ id: String(who.staff.id), name: who.staff.name, perms: supportPerms(who.staff) }, { headers: { "cache-control": "no-store" } });
  }
  if (method === "POST" && path === "stream-ticket") {
    const who = await requireStaff(req);
    if (who instanceof NextResponse) return who;
    const r = await support<{ ticket?: string }>("/v1/stream/ticket", { method: "POST", staff: who.staff });
    return NextResponse.json(r.status === 200 ? { ticket: r.data.ticket, url: SUPPORT_STREAM_URL || null } : r.data, { status: r.status, headers: { "cache-control": "no-store" } });
  }
  const att = /^attachments\/(\d{1,18})$/.exec(path);
  if (method === "GET" && att) {
    const who = await requireStaff(req);
    if (who instanceof NextResponse) return who;
    if (!supportAllow(who.staff, "support.read")) return apiError(403, "forbidden", "Your role doesn't allow this.");
    const r = await support(`/v1/support/admin/attachments/${att[1]}`, { staff: who.staff, binary: true });
    if (!r.bytes) return NextResponse.json(r.data, { status: r.status, headers: { "cache-control": "no-store" } });
    const h = new Headers({ "cache-control": "private, no-store" });
    for (const k of ["content-type", "content-disposition", "x-content-type-options", "content-security-policy"]) {
      const v = r.headers?.get(k);
      if (v) h.set(k, v);
    }
    return new NextResponse(r.bytes, { status: 200, headers: h });
  }
  const up = /^conversations\/(\d{1,18})\/attachments$/.exec(path);
  if (method === "POST" && up) {
    const origin = req.headers.get("origin");
    const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
    if (!origin || new URL(origin).host !== host) return apiError(403, "forbidden", "Cross-site request blocked.");
    const who = await requireStaff(req);
    if (who instanceof NextResponse) return who;
    if (!supportAllow(who.staff, "support.write")) return apiError(403, "forbidden", "Your role doesn't allow this.");
    const bytes = await req.arrayBuffer();
    if (bytes.byteLength > MAX_UPLOAD) return apiError(413, "too_large", "Files can be up to 10 MB.");
    const name = decodeURIComponent(req.headers.get("x-file-name") ?? "file").slice(0, 200);
    const r = await support(`/v1/support/admin/conversations/${up[1]}/attachments`, { staff: who.staff, raw: { bytes, name, type: req.headers.get("content-type") ?? "" }, timeoutMs: 60_000 });
    return NextResponse.json(r.data, { status: r.status, headers: { "cache-control": "no-store" } });
  }

  const route = ROUTES.find((r) => r.method === method && r.re.test(path));
  if (!route) return apiError(404, "not_found", "Not found.");
  let body: unknown;
  if (method === "POST" || method === "PUT") {
    const blocked = mutationAllowed(req);
    if (blocked) return blocked;
    body = await req.json().catch(() => null);
    if (body === null || typeof body !== "object" || Array.isArray(body)) return apiError(400, "bad_request", "Invalid request body.");
  } else if (method === "DELETE") {
    const origin = req.headers.get("origin");
    const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
    if (origin && new URL(origin).host !== host) return apiError(403, "forbidden", "Cross-site request blocked.");
  }
  const who = await requireStaff(req);
  if (who instanceof NextResponse) return who;
  if (route.perm && !supportAllow(who.staff, route.perm)) return apiError(403, "forbidden", "Your role doesn't allow this.");
  const q = new URLSearchParams();
  for (const k of QUERY_KEYS) {
    const v = req.nextUrl.searchParams.get(k);
    if (v && v.length <= 100) q.set(k, v);
  }
  const target = `${route.target(path)}${method === "GET" && q.size ? `?${q}` : ""}`;
  const r = await support(target, { method, body, staff: who.staff, timeoutMs: path === "kb/test" ? 90_000 : 30_000 });
  return NextResponse.json(r.data, { status: r.status, headers: { "cache-control": "no-store" } });
}

type Ctx = { params: Promise<{ path: string[] }> };
export const GET = async (req: NextRequest, { params }: Ctx) => handle(req, (await params).path, "GET");
export const POST = async (req: NextRequest, { params }: Ctx) => handle(req, (await params).path, "POST");
export const PUT = async (req: NextRequest, { params }: Ctx) => handle(req, (await params).path, "PUT");
export const DELETE = async (req: NextRequest, { params }: Ctx) => handle(req, (await params).path, "DELETE");
