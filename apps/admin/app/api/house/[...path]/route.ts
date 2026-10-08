import { NextResponse, type NextRequest } from "next/server";
import { clientIp, type GatewayStaff } from "@/lib/gateway";
import { apiError, mutationAllowed, requireStaff } from "@/lib/bff";
import { socialAllows, type SocialPerm } from "@/lib/social-perms";

// House accounts BFF: browser -> /api/house/<path> (same origin, staff cookie) -> algo service /v1/admin/house/<path>.
// House accounts are part of Social & Algo, so the social permissions apply: social.read to view, social.write for
// every change (provision, seed, on/off, visibility, capital, delete, master switch). The staff session is verified
// with the gateway on every call; the algo service checks the role again and the trading engine checks it a third
// time for its own writes. Every write needs a note (audit log).

const ALGO_URL = (process.env.ALGO_URL ?? "http://127.0.0.1:8099").replace(/\/+$/, "");
const ALGO_TOKEN = process.env.ALGO_INTERNAL_TOKEN ?? "";

type Method = "GET" | "POST" | "PUT";
const ID = "(\\d{1,18})";
const ROUTES: { method: Method; re: RegExp; perm: SocialPerm; target: (m: RegExpMatchArray) => string }[] = [
  { method: "GET", re: /^list$/, perm: "social.read", target: () => "" },
  { method: "GET", re: new RegExp(`^${ID}$`), perm: "social.read", target: (m) => `/${m[1]}` },
  { method: "POST", re: /^provision$/, perm: "social.write", target: () => "" },
  { method: "POST", re: /^seed$/, perm: "social.write", target: () => "/seed" },
  { method: "PUT", re: /^settings$/, perm: "social.write", target: () => "/settings" },
  { method: "POST", re: new RegExp(`^${ID}/(retry|switch|visibility|capital|delete)$`), perm: "social.write", target: (m) => `/${m[1]}/${m[2]}` },
];

async function forward(path: string, method: Method, body: unknown, staff: GatewayStaff, req: NextRequest) {
  const headers: Record<string, string> = {
    "x-ezymex-internal": ALGO_TOKEN,
    "x-ezymex-tenant": staff.tenant?.slug || "ezymex",
    "x-ezymex-staff-id": String(staff.id),
    "x-ezymex-staff-name": encodeURIComponent(staff.name || staff.email),
    "x-ezymex-staff-role": staff.role,
    "x-forwarded-for": clientIp(req.headers),
  };
  if (body !== undefined) headers["content-type"] = "application/json";
  try {
    // provisioning all ten presets talks to the gateway, the engine and the runtime for each: allow time
    const r = await fetch(`${ALGO_URL}/v1/admin/house${path}`, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined, cache: "no-store", signal: AbortSignal.timeout(180_000) });
    return { status: r.status, data: await r.json().catch(() => ({})) };
  } catch {
    return { status: 503, data: { error: { code: "unavailable", message: "The ALGO service is unavailable. Please try again shortly." } } };
  }
}

async function handle(req: NextRequest, parts: string[], method: Method) {
  const path = parts.map((p) => decodeURIComponent(p)).join("/");
  if (!ALGO_TOKEN) return apiError(503, "not_configured", "The ALGO service is not configured for the Back Office.");
  let match: RegExpMatchArray | null = null;
  const route = ROUTES.find((r) => r.method === method && (match = path.match(r.re)) !== null);
  if (!route || !match) return apiError(404, "not_found", "Not found.");
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
  if (!socialAllows(who.staff, route.perm)) return apiError(403, "forbidden", "Your role doesn't allow this.");
  const r = await forward(route.target(match), method, body, who.staff, req);
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
