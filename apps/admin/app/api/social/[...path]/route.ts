import { NextResponse, type NextRequest } from "next/server";
import { clientIp } from "@/lib/gateway";
import { apiError, mutationAllowed, requireStaff } from "@/lib/bff";
import { engine, tradingConfigured } from "@/lib/trading";
import { socialAllows, type SocialPerm } from "@/lib/social-perms";

// Social BFF: browser -> /api/social/<path> (same origin, staff cookie) -> trading engine /v1/social/<path>.
// The staff session is verified with the gateway on every call; the permission for the route is checked here
// (lib/social-perms.ts), then the engine is called with TRADING_INTERNAL_TOKEN and the staff identity headers
// built from that verified session. The engine checks the role again and writes the social.* audit entries.

type Method = "GET" | "POST" | "PUT";
type Route = { method: Method; re: RegExp; perm: SocialPerm };

const ID = "(\\d{1,18})";
const ROUTES: Route[] = [
  // reads
  { method: "GET", re: /^admin\/(overview|masters|subscriptions|funds|settings|fees|audit)$/, perm: "social.read" },
  { method: "GET", re: /^leaderboard$/, perm: "social.read" },
  { method: "GET", re: new RegExp(`^masters/${ID}$`), perm: "social.read" },
  { method: "GET", re: new RegExp(`^funds/${ID}$`), perm: "social.read" },
  // approvals
  { method: "POST", re: new RegExp(`^admin/masters/${ID}/review$`), perm: "social.approve" },
  { method: "POST", re: new RegExp(`^admin/fees/${ID}/review$`), perm: "social.approve" },
  // risk / operations
  { method: "POST", re: new RegExp(`^admin/masters/${ID}/(status|emergency)$`), perm: "social.write" },
  { method: "POST", re: new RegExp(`^admin/subscriptions/${ID}/stop$`), perm: "social.write" },
  { method: "POST", re: new RegExp(`^admin/funds/${ID}/(freeze|rollover)$`), perm: "social.write" },
  { method: "POST", re: /^admin\/(rollover|snapshots)$/, perm: "social.write" },
  { method: "PUT", re: /^admin\/settings$/, perm: "social.write" },
];

const json = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { "cache-control": "no-store" } });

async function handle(req: NextRequest, parts: string[], method: Method) {
  const path = parts.map((p) => decodeURIComponent(p)).join("/");
  if (!tradingConfigured()) return apiError(503, "not_configured", "The trading engine is not configured for the Back Office.");

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
  if (!socialAllows(who.staff, route.perm)) return apiError(403, "forbidden", "Your role doesn't allow this.");

  const target = `/v1/social/${path}${method === "GET" ? req.nextUrl.search : ""}`;
  const r = await engine(target, { method, body, staff: who.staff, ip: clientIp(req.headers), userAgent: req.headers.get("user-agent") });
  return json(r.data, r.status);
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
