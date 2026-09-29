import { NextResponse, type NextRequest } from "next/server";
import { alertsClient, alertsError, alertsService, reply } from "@/lib/alerts";

// Triggered price alerts of the signed-in client (lib/alerts.ts), newest first.
//   GET    /api/mobile/alerts/history?before=<id>&limit=<1-100>&symbol=   {items, next}
//   DELETE /api/mobile/alerts/history                                    {ok, cleared}: hidden from the history
//          (a trigger still waiting to be delivered is delivered all the same)

export const dynamic = "force-dynamic";

const SYMBOL_RE = /^[A-Z0-9._]{2,20}$/;

export async function GET(req: NextRequest) {
  const user = await alertsClient(req, false);
  if (user instanceof NextResponse) return user;
  const sp = req.nextUrl.searchParams;
  const out = new URLSearchParams();
  const before = sp.get("before");
  if (before !== null) {
    if (!/^[1-9]\d{0,17}$/.test(before)) return alertsError(400, "bad_request", "Invalid before.");
    out.set("before", before);
  }
  const limit = sp.get("limit");
  if (limit !== null) {
    const n = Number(limit);
    if (!Number.isInteger(n) || n < 1 || n > 100) return alertsError(400, "bad_request", "Invalid limit.");
    out.set("limit", String(n));
  }
  const symbol = sp.get("symbol")?.trim().toUpperCase();
  if (symbol) {
    if (!SYMBOL_RE.test(symbol)) return alertsError(400, "bad_request", "Invalid symbol.");
    out.set("symbol", symbol);
  }
  const qs = out.toString();
  const r = await alertsService(`/v1/internal/alerts/history${qs ? `?${qs}` : ""}`, user);
  return reply(r.status, r.data);
}

export async function DELETE(req: NextRequest) {
  const user = await alertsClient(req, true);
  if (user instanceof NextResponse) return user;
  const r = await alertsService("/v1/internal/alerts/history", user, { method: "DELETE" });
  return reply(r.status, r.data);
}
