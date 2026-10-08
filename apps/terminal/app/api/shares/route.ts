/**
 * POST /api/shares — create a trade share link (proxied to gateway POST /v1/shares).
 * Live builds: the trades are rebuilt from the trading engine for the logged-in account first.
 */
import type { NextRequest } from "next/server";
import { IS_LIVE } from "@ezymex/mock";
import { clientIp, gateway, guard, jsonError, relay } from "@/lib/gateway";
import { verifyShareRows } from "@/lib/engine/share-verify";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const blocked = guard(req);
  if (blocked) return blocked;
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return jsonError(400, "bad_request", "Invalid request body.");
  if (IS_LIVE) {
    const v = await verifyShareRows(req, String((body as { login?: unknown }).login ?? ""), (body as { trades?: unknown }).trades);
    if (!v.ok) return jsonError(v.status, v.code, v.message);
    if (!v.rows.length) return jsonError(422, "validation", "None of the selected trades were found on this account.");
    (body as { trades: unknown }).trades = v.rows;
  }
  return relay(await gateway("/v1/shares", { body, ip: clientIp(req.headers), userAgent: req.headers.get("user-agent") }));
}
