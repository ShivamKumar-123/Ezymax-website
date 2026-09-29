import { NextResponse, type NextRequest } from "next/server";
import { STAFF_COOKIE, clientIp, gateway } from "@/lib/gateway";
import { apiError, mutationAllowed, requireStaff, withInviteUrl } from "@/lib/bff";
import { probeAll } from "@/lib/system-health";

// Platform Owner BFF: browser -> /api/owner/<path> -> gateway /v1/owner/<path> (owner.* permissions, checked by
// the gateway). `system` is answered here: server-side /health probes of every service (owner.system).

type Method = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
const ID = "\\d{1,18}";
const FLAG = "[a-z][a-z0-9_]{1,47}";
const PATHS: Record<Method, RegExp[]> = {
  GET: [/^dashboard$/, /^tenants$/, new RegExp(`^tenants/${ID}$`), /^features$/, /^billing$/, /^invoices$/],
  POST: [/^tenants$/, new RegExp(`^tenants/${ID}/(suspend|activate|invite-admin)$`), /^features$/, /^invoices$/, new RegExp(`^invoices/${ID}/status$`)],
  PATCH: [new RegExp(`^tenants/${ID}$`), new RegExp(`^features/${FLAG}$`)],
  PUT: [new RegExp(`^tenants/${ID}/(features|billing)$`)],
  DELETE: [new RegExp(`^features/${FLAG}$`)],
};

async function forward(req: NextRequest, parts: string[], method: Method) {
  const path = parts.join("/");
  if (method === "GET" && path === "system") {
    const who = await requireStaff(req, "owner.system");
    if (who instanceof NextResponse) return who;
    const services = await probeAll();
    return NextResponse.json({ checked_at: new Date().toISOString(), services }, { headers: { "cache-control": "no-store" } });
  }
  if (!PATHS[method].some((re) => re.test(path))) return apiError(404, "not_found", "Not found.");
  const token = req.cookies.get(STAFF_COOKIE)?.value;
  if (!token) return apiError(401, "unauthorized", "Please sign in.");
  let body: unknown;
  if (method !== "GET") {
    const blocked = mutationAllowed(req);
    if (blocked) return blocked;
    body = await req.json().catch(() => ({}));
    if (body === null || typeof body !== "object") return apiError(400, "bad_request", "Invalid request body.");
  }
  const qs = method === "GET" ? req.nextUrl.search : "";
  const r = await gateway(`/v1/owner/${path}${qs}`, { method, body, token, ip: clientIp(req.headers), userAgent: req.headers.get("user-agent") });
  return NextResponse.json(withInviteUrl(req, r.data), { status: r.status, headers: { "cache-control": "no-store" } });
}

type Ctx = { params: Promise<{ path: string[] }> };
export const GET = async (req: NextRequest, { params }: Ctx) => forward(req, (await params).path, "GET");
export const POST = async (req: NextRequest, { params }: Ctx) => forward(req, (await params).path, "POST");
export const PATCH = async (req: NextRequest, { params }: Ctx) => forward(req, (await params).path, "PATCH");
export const PUT = async (req: NextRequest, { params }: Ctx) => forward(req, (await params).path, "PUT");
export const DELETE = async (req: NextRequest, { params }: Ctx) => forward(req, (await params).path, "DELETE");
