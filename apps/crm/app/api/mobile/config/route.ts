import { NextResponse, type NextRequest } from "next/server";
import { TERMINAL_BASE } from "@/lib/trading";
import { publicServiceUrl, toWs } from "@/lib/mobile";
import { engineStreamUrl, requestOrigin } from "@/lib/mobile-trade";

// GET /api/mobile/config: where the mobile app finds the public services of this broker. The app only knows one
// base URL (this Client Area); quotes, candles and the trading-engine stream live on other hosts in production
// (api.<domain>, trade.<domain>/engine/stream), and on the mobile dev relay locally (lib/mobile.ts).
// Public, cached by the app; no secrets.

export const dynamic = "force-dynamic";

const MARKET_DATA_URL = process.env.MOBILE_MARKET_DATA_URL || process.env.NEXT_PUBLIC_MARKET_DATA_URL || "http://127.0.0.1:8081";

export async function GET(req: NextRequest) {
  const origin = requestOrigin(req);
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
