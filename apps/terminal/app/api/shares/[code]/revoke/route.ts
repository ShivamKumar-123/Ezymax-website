/** POST /api/shares/:code/revoke — disable a share link (manage key in X-Share-Key). */
import type { NextRequest } from "next/server";
import { CODE_RE, clientIp, gateway, guard, jsonError, relay } from "@/lib/gateway";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const blocked = guard(req, false);
  if (blocked) return blocked;
  const { code } = await params;
  if (!CODE_RE.test(code)) return jsonError(404, "not_found", "Not found.");
  return relay(await gateway(`/v1/shares/${code}/revoke`, { method: "POST", shareKey: req.headers.get("x-share-key"), ip: clientIp(req.headers), userAgent: req.headers.get("user-agent") }));
}
