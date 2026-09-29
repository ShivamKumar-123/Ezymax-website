import { NextResponse, type NextRequest } from "next/server";
import { clientIp, gateway, sameOrigin } from "@/lib/gateway";

// Marketing-email unsubscribe (link in every journey / campaign email footer). Public: the signed link is the
// credential (gateway checks the HMAC). POST only, so mail scanners that prefetch links never unsubscribe anyone.
export async function POST(req: NextRequest) {
  if (!sameOrigin(req.headers)) return NextResponse.json({ error: { code: "forbidden", message: "Cross-site request blocked." } }, { status: 403 });
  const b = (await req.json().catch(() => null)) as { u?: unknown; s?: unknown } | null;
  const u = Number(b?.u);
  const s = typeof b?.s === "string" ? b.s : "";
  if (!Number.isSafeInteger(u) || u <= 0 || !/^[0-9a-f]{32}$/.test(s)) {
    return NextResponse.json({ error: { code: "invalid_link", message: "This unsubscribe link isn't valid." } }, { status: 400 });
  }
  const r = await gateway("/v1/public/unsubscribe", { body: { u, s }, ip: clientIp(req.headers), userAgent: req.headers.get("user-agent") });
  return NextResponse.json(r.data, { status: r.status, headers: { "cache-control": "no-store" } });
}
