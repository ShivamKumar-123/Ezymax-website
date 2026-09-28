/** POST /api/shares — create a trade share link (proxied to gateway POST /v1/shares). */
import type { NextRequest } from "next/server";
import { clientIp, gateway, guard, jsonError, relay } from "@/lib/gateway";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const blocked = guard(req);
  if (blocked) return blocked;
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return jsonError(400, "bad_request", "Invalid request body.");
  return relay(await gateway("/v1/shares", { body, ip: clientIp(req.headers), userAgent: req.headers.get("user-agent") }));
}
