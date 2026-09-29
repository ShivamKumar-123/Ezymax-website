import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, clientIp, gateway, sameOrigin } from "@/lib/gateway";

// The client's marketing-email switch (gateway users.marketing_consent). Journey and campaign emails honour it;
// account emails never do. Browser -> /api/auth/marketing -> gateway /v1/auth/marketing.
const NO_STORE = { "cache-control": "no-store" };

async function call(req: NextRequest, method: "GET" | "PUT", body?: unknown) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return NextResponse.json({ error: { code: "unauthorized", message: "Please sign in." } }, { status: 401 });
  // the gateway takes the change as POST (same handler as PUT)
  const r = await gateway(`/v1/auth/marketing`, { method: method === "PUT" ? "POST" : "GET", body, token, ip: clientIp(req.headers), userAgent: req.headers.get("user-agent") });
  return NextResponse.json(r.data, { status: r.status, headers: NO_STORE });
}

export const GET = (req: NextRequest) => call(req, "GET");

export async function PUT(req: NextRequest) {
  if (!sameOrigin(req.headers)) return NextResponse.json({ error: { code: "forbidden", message: "Cross-site request blocked." } }, { status: 403 });
  const b = (await req.json().catch(() => null)) as { consent?: unknown } | null;
  if (typeof b?.consent !== "boolean") return NextResponse.json({ error: { code: "bad_request", message: "consent must be true or false." } }, { status: 400 });
  return call(req, "PUT", { consent: b.consent });
}
