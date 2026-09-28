import { NextResponse, type NextRequest } from "next/server";
import { clientIp, type GatewayStaff } from "@/lib/gateway";
import { apiError, mutationAllowed, requireStaff } from "@/lib/bff";
import { algoAllows, type AlgoPerm } from "@/lib/algo-perms";

// ALGO BFF: browser -> /api/algo/<path> (same origin, staff cookie) -> algo service /v1/admin/<path>.
// The staff session is verified with the gateway on every call and the permission for the route is checked here
// (lib/algo-perms.ts); the service gets ALGO_INTERNAL_TOKEN plus the staff identity built from that session,
// checks the role again and writes the audit log. Every write needs a note.

const ALGO_URL = (process.env.ALGO_URL ?? "http://127.0.0.1:8099").replace(/\/+$/, "");
const ALGO_TOKEN = process.env.ALGO_INTERNAL_TOKEN ?? "";

type Method = "GET" | "POST" | "PUT";
const ID = "(\\d{1,18})";
const ROUTES: { method: Method; re: RegExp; perm: AlgoPerm }[] = [
  { method: "GET", re: /^(overview|strategies|deployments|listings|keys|webhooks|subscriptions|audit|settings)$/, perm: "algo.read" },
  { method: "POST", re: new RegExp(`^deployments/${ID}/kill$`), perm: "algo.write" },
  { method: "POST", re: new RegExp(`^users/${ID}/kill$`), perm: "algo.write" },
  { method: "POST", re: new RegExp(`^listings/${ID}/moderate$`), perm: "algo.write" },
  { method: "POST", re: new RegExp(`^keys/${ID}/revoke$`), perm: "algo.write" },
  { method: "PUT", re: /^settings$/, perm: "algo.settings" },
];
const QUERY = ["q", "status", "user_id", "limit"];

async function forward(path: string, method: Method, body: unknown, staff: GatewayStaff, req: NextRequest) {
  const headers: Record<string, string> = {
    "x-kalks-internal": ALGO_TOKEN,
    "x-kalks-tenant": staff.tenant?.slug || "kalks",
    "x-kalks-staff-id": String(staff.id),
    "x-kalks-staff-name": encodeURIComponent(staff.name || staff.email),
    "x-kalks-staff-role": staff.role,
    "x-forwarded-for": clientIp(req.headers),
  };
  if (body !== undefined) headers["content-type"] = "application/json";
  try {
    const r = await fetch(`${ALGO_URL}${path}`, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined, cache: "no-store", signal: AbortSignal.timeout(120_000) });
    return { status: r.status, data: await r.json().catch(() => ({})) };
  } catch {
    return { status: 503, data: { error: { code: "unavailable", message: "The ALGO service is unavailable. Please try again shortly." } } };
  }
}

async function handle(req: NextRequest, parts: string[], method: Method) {
  const path = parts.map((p) => decodeURIComponent(p)).join("/");
  if (!ALGO_TOKEN) return apiError(503, "not_configured", "The ALGO service is not configured for the Back Office.");
  const route = ROUTES.find((r) => r.method === method && r.re.test(path));
  if (!route) return apiError(404, "not_found", "Not found.");
  let body: unknown;
  if (method !== "GET") {
    const blocked = mutationAllowed(req);
    if (blocked) return blocked;
    body = await req.json().catch(() => null);
    if (body === null || typeof body !== "object" || Array.isArray(body)) return apiError(400, "bad_request", "Invalid request body.");
    const note = (body as { note?: unknown }).note;
    if (typeof note !== "string" || !note.trim()) return apiError(422, "validation", "Add a note for the audit log.");
  }
  const who = await requireStaff(req);
  if (who instanceof NextResponse) return who;
  if (!algoAllows(who.staff, route.perm)) return apiError(403, "forbidden", "Your role doesn't allow this.");
  const q = new URLSearchParams();
  for (const k of QUERY) {
    const v = req.nextUrl.searchParams.get(k);
    if (v !== null && v.length <= 80) q.set(k, v);
  }
  const target = `/v1/admin/${path}${method === "GET" && q.toString() ? `?${q}` : ""}`;
  const r = await forward(target, method, body, who.staff, req);
  return NextResponse.json(r.data, { status: r.status, headers: { "cache-control": "no-store" } });
}

type Ctx = { params: Promise<{ path: string[] }> };
export async function GET(req: NextRequest, { params }: Ctx) {
  return handle(req, (await params).path, "GET");
}
export async function POST(req: NextRequest, { params }: Ctx) {
  return handle(req, (await params).path, "POST");
}
export async function PUT(req: NextRequest, { params }: Ctx) {
  return handle(req, (await params).path, "PUT");
}
