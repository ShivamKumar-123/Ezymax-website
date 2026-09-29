import { NextResponse, type NextRequest } from "next/server";
import { fetchMe } from "@/lib/gateway";
import { bearerOf } from "@/lib/mobile";
import { tenantConfig } from "@/lib/tenant-config";
import { hostOf } from "@/lib/tenant-host";

// GET /api/mobile/accounts/options: what the mobile app's open-account wizard may offer for this broker.
//   {demoAccounts}: false when the broker switched new demo accounts off (Back Office › Settings › Features).
// It is the same switch the Client Area's wizard reads (components/tenant-config) to hide the demo choice; the
// trading BFF (POST /api/trading/accounts, reached by the app as /api/mobile/trading/accounts) refuses a demo
// account itself when it is off, so this only saves the client a refused request.
// Signed-in only (bearer session, resolved with the gateway like every mobile route). Read-only: nothing changes.

export const dynamic = "force-dynamic";

const NO_STORE = { "cache-control": "no-store" };

function error(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status, headers: NO_STORE });
}

export async function GET(req: NextRequest) {
  const token = bearerOf(req.headers);
  if (!token) return error(401, "unauthorized", "Please sign in.");
  const me = await fetchMe(token, req.headers);
  if (me === "unavailable") return error(503, "unavailable", "Sign-in service is unavailable. Please try again shortly.");
  if (!me) return error(401, "unauthorized", "Please sign in.");
  const cfg = await tenantConfig(hostOf(req.headers) ?? "");
  // unknown (gateway unreachable): everything on, like the Client Area; the trading BFF still decides
  return NextResponse.json({ demoAccounts: cfg?.flags?.demo_accounts !== false }, { headers: NO_STORE });
}
