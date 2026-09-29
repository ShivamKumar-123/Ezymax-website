import { NextResponse, type NextRequest } from "next/server";
import { alertInput, alertsBody, alertsClient, alertsError, alertsService, reply } from "@/lib/alerts";

// Price alerts of the signed-in client (apps/mobile › /alerts), kept and evaluated by market-data (lib/alerts.ts).
//   GET  /api/mobile/alerts?symbol=   {items, limit, live}: live alerts (newest first), then triggered / expired ones
//   POST /api/mobile/alerts           {symbol, condition: above|below|change_up|change_down, value, basis?: bid|ask,
//                                      group?, repeat?, expiresAt? (ISO, null = never), note?} -> 201 {alert}
// The client is always the bearer session's user; a level already reached, a missing price or the per-client limit
// come back from the service as 409 with a code (level_reached, no_price, limit).

export const dynamic = "force-dynamic";

const SYMBOL_RE = /^[A-Z0-9._]{2,20}$/;

export async function GET(req: NextRequest) {
  const user = await alertsClient(req, false);
  if (user instanceof NextResponse) return user;
  const symbol = req.nextUrl.searchParams.get("symbol")?.trim().toUpperCase();
  if (symbol && !SYMBOL_RE.test(symbol)) return alertsError(400, "bad_request", "Invalid symbol.");
  const r = await alertsService(`/v1/internal/alerts${symbol ? `?symbol=${encodeURIComponent(symbol)}` : ""}`, user);
  return reply(r.status, r.data);
}

export async function POST(req: NextRequest) {
  const body = await alertsBody(req);
  if (body instanceof NextResponse) return body;
  const user = await alertsClient(req, true);
  if (user instanceof NextResponse) return user;
  const input = alertInput(body, true);
  if (!input.ok) return alertsError(422, "validation", input.message, input.field);
  const r = await alertsService("/v1/internal/alerts", user, { method: "POST", body: input.body });
  return reply(r.status, r.data);
}
