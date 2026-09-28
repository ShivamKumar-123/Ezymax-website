/**
 * PATCH /api/shares/:code/trades — refresh the snapshot of a shared link (manage key in X-Share-Key).
 * Live builds: the trades are rebuilt from the trading engine for the account in X-Kalks-Login first.
 */
import type { NextRequest } from "next/server";
import { IS_LIVE } from "@kalks/mock";
import { CODE_RE, clientIp, gateway, guard, jsonError, relay } from "@/lib/gateway";
import { verifyShareRows } from "@/lib/engine/share-verify";

export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const blocked = guard(req);
  if (blocked) return blocked;
  const { code } = await params;
  if (!CODE_RE.test(code)) return jsonError(404, "not_found", "Not found.");
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return jsonError(400, "bad_request", "Invalid request body.");
  if (IS_LIVE) {
    const v = await verifyShareRows(req, req.headers.get("x-kalks-login") ?? "", (body as { trades?: unknown }).trades);
    if (!v.ok) return jsonError(v.status, v.code, v.message);
    (body as { trades: unknown }).trades = v.rows;
  }
  return relay(await gateway(`/v1/shares/${code}/trades`, { method: "PATCH", body, shareKey: req.headers.get("x-share-key"), ip: clientIp(req.headers), userAgent: req.headers.get("user-agent") }));
}
