import { NextResponse, type NextRequest } from "next/server";
import { STAFF_COOKIE, clientIp, gateway } from "@/lib/gateway";
import { apiError, mutationAllowed } from "@/lib/bff";

// Back Office admin reads BFF: browser -> /api/admin/<path> (same origin, staff cookie) -> gateway /v1/admin/<path>.
// The gateway checks the staff session and the role's permission on every call; this layer only forwards.

const GET_PATHS = [/^stats$/, /^users$/, /^users\/\d{1,18}$/, /^audit$/, /^staff$/, /^sessions$/];
const POST_PATHS = [/^sessions\/\d{1,18}\/revoke$/];

async function forward(req: NextRequest, parts: string[], method: "GET" | "POST") {
  const path = parts.join("/");
  const allowed = (method === "GET" ? GET_PATHS : POST_PATHS).some((re) => re.test(path));
  if (!allowed) return apiError(404, "not_found", "Not found.");
  const token = req.cookies.get(STAFF_COOKIE)?.value;
  if (!token) return apiError(401, "unauthorized", "Please sign in.");
  let body: unknown;
  if (method === "POST") {
    const blocked = mutationAllowed(req);
    if (blocked) return blocked;
    body = await req.json().catch(() => ({}));
    if (body === null || typeof body !== "object") return apiError(400, "bad_request", "Invalid request body.");
  }
  const qs = method === "GET" ? req.nextUrl.search : "";
  const r = await gateway(`/v1/admin/${path}${qs}`, { method, body, token, ip: clientIp(req.headers), userAgent: req.headers.get("user-agent") });
  return NextResponse.json(r.data, { status: r.status, headers: { "cache-control": "no-store" } });
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return forward(req, (await params).path, "GET");
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return forward(req, (await params).path, "POST");
}
