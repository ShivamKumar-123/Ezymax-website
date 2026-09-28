/** GET /api/shares/public/:code — public share data for the share page's periodic refresh (does not count a view). */
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { clientIp, fetchPublicShare, jsonError } from "@/lib/gateway";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const r = await fetchPublicShare(code, { ip: clientIp(req.headers), userAgent: req.headers.get("user-agent") });
  if (r.status === 429) return jsonError(429, "rate_limited", "Too many requests.");
  if (!r.data) return jsonError(r.status === 503 ? 503 : 404, r.status === 503 ? "unavailable" : "not_found", "This link is no longer available.");
  return NextResponse.json(r.data, { headers: { "cache-control": "no-store" } });
}
