import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, clientIp, gateway, sameOrigin } from "@/lib/gateway";

// POST /api/auth/impersonation {action: "end"}: the staff member ends a staff session from its banner. The gateway
// signs the session out and audits the end with the staff id; only staff sessions can be ended here.
export const dynamic = "force-dynamic";

const STAFF_PREFIXES = ["i.", "s."];

export async function POST(req: NextRequest) {
  if (!sameOrigin(req.headers)) return NextResponse.json({ error: { code: "forbidden", message: "Cross-site request blocked." } }, { status: 403 });
  const body = (await req.json().catch(() => null)) as { action?: unknown } | null;
  if (body?.action !== "end") return NextResponse.json({ error: { code: "bad_request", message: "Unknown action." } }, { status: 400 });
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token || !STAFF_PREFIXES.some((p) => token.startsWith(p))) return NextResponse.json({ error: { code: "not_staff_session", message: "This isn't a staff session." } }, { status: 400 });
  await gateway("/v1/auth/logout", { method: "POST", body: {}, token, ip: clientIp(req.headers), userAgent: req.headers.get("user-agent") });
  const res = NextResponse.json({ status: "ok" }, { headers: { "cache-control": "no-store" } });
  res.cookies.delete(SESSION_COOKIE);
  return res;
}
