/**
 * GET /api/engine/controls (X-Kalks-Login): what the broker restricted on this account's owner and, for a staff
 * session opened from the Back Office ("Log in as client"), who is acting and until when. Polled by the banner
 * (components/shell/controls-banner.tsx). The owner's user id never reaches the browser.
 */
import type { NextRequest } from "next/server";
import { engine, error, reply, sessionFor, soft, type Obj } from "@/lib/engine/server";
import { clientIp, gateway } from "@/lib/gateway";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const s = sessionFor(req);
  if (!s) return soft(req, error(401, "unauthorized", "Log in to your trading account."));
  const r = await engine<Obj>("/v1/terminal/controls", { bearer: s.t, req });
  if (r.status !== 200) return soft(req, reply(r.status, r.data));
  const { userId, ...rest } = r.data;
  // a staff session's banner names the client (gateway record; the user id stays on the server)
  if (rest.staff && typeof userId === "number") {
    const u = await gateway<{ user?: { name?: string } }>(`/v1/internal/users/${userId}`, { ip: clientIp(req.headers), userAgent: req.headers.get("user-agent") });
    if (u.status === 200 && u.data.user?.name) rest.clientName = u.data.user.name;
  }
  return reply(200, rest);
}
