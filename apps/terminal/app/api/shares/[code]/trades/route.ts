/** PATCH /api/shares/:code/trades — refresh the snapshot of a shared link (manage key in X-Share-Key). */
import type { NextRequest } from "next/server";
import { CODE_RE, clientIp, gateway, guard, jsonError, relay } from "@/lib/gateway";

export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const blocked = guard(req);
  if (blocked) return blocked;
  const { code } = await params;
  if (!CODE_RE.test(code)) return jsonError(404, "not_found", "Not found.");
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return jsonError(400, "bad_request", "Invalid request body.");
  return relay(await gateway(`/v1/shares/${code}/trades`, { method: "PATCH", body, shareKey: req.headers.get("x-share-key"), ip: clientIp(req.headers), userAgent: req.headers.get("user-agent") }));
}
