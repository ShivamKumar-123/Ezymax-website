import { NextResponse, type NextRequest } from "next/server";
import { TERMINAL_BASE } from "@/lib/trading";
import { isLoopbackHost, publicServiceUrl, toWs } from "@/lib/mobile";

// GET /api/mobile/config: where the mobile app finds the public services of this broker. The app only knows one
// base URL (this Client Area); quotes, candles and the trading-engine stream live on other hosts in production
// (api.<domain>, trade.<domain>/engine/stream), and on the mobile dev relay locally (lib/mobile.ts).
// Public, cached briefly by the app; no secrets.

export const dynamic = "force-dynamic";

const MARKET_DATA_URL = process.env.MOBILE_MARKET_DATA_URL || process.env.NEXT_PUBLIC_MARKET_DATA_URL || "http://127.0.0.1:8081";
const TRADING_URL = process.env.TRADING_URL ?? "http://127.0.0.1:8090";

export async function GET(req: NextRequest) {
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? req.nextUrl.host;
  const proto = req.headers.get("x-forwarded-proto") ?? req.nextUrl.protocol.replace(":", "");
  const origin = new URL(`${proto}://${host.split(",")[0]!.trim()}`);
  const md = publicServiceUrl(MARKET_DATA_URL, origin);
  return NextResponse.json(
    {
      marketData: { http: md, ws: `${toWs(md)}/v1/stream` },
      engineStream: engineStreamUrl(origin),
      terminalUrl: TERMINAL_BASE,
      clientAreaUrl: origin.origin,
    },
    { headers: { "cache-control": "no-store" } },
  );
}

/** Trading-engine account stream: trade.<domain>/engine/stream in production (Caddy); locally the engine port from
 *  this Mac, or the dev relay's /engine/stream from a phone on the LAN. */
function engineStreamUrl(origin: URL): string {
  if (process.env.MOBILE_ENGINE_STREAM_URL) return process.env.MOBILE_ENGINE_STREAM_URL;
  const terminal = new URL(TERMINAL_BASE);
  if (!isLoopbackHost(terminal.host)) return `${toWs(terminal.origin)}/engine/stream`;
  return isLoopbackHost(origin.host) ? `${toWs(TRADING_URL.replace(/\/+$/, ""))}/v1/terminal/stream` : `${toWs(origin.origin)}/engine/stream`;
}
