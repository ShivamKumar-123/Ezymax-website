import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, clientIp, gateway, sameOrigin } from "@/lib/gateway";

// POST /api/auth/heartbeat: an open Client Area tab (components/account-notices.tsx, every 45 s while visible).
// Keeps the client's presence (Online in the Back Office) and returns the account's current restrictions so the
// banner follows changes without a reload. Staff and view-only sessions never count as the client being online.
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!sameOrigin(req.headers)) return NextResponse.json({ error: { code: "forbidden", message: "Cross-site request blocked." } }, { status: 403 });
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return NextResponse.json({ error: { code: "unauthorized", message: "Please sign in." } }, { status: 401 });
  const r = await gateway("/v1/auth/heartbeat", { method: "POST", body: {}, token, ip: clientIp(req.headers), userAgent: req.headers.get("user-agent") });
  return NextResponse.json(r.data, { status: r.status, headers: { "cache-control": "no-store" } });
}
