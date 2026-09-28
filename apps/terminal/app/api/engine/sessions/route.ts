/**
 * GET /api/engine/sessions: the trading accounts this browser is logged in to (newest first), each with its
 * account view. Expired / revoked sessions (engine 401) are dropped from the cookie.
 */
import type { NextRequest } from "next/server";
import { clientAccount, engine, readSessions, reply, writeSessions, type Obj } from "@/lib/engine/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const list = readSessions(req);
  const checked = await Promise.all(
    list.map(async (s) => {
      const r = await engine<{ account?: Obj; readOnly?: boolean }>("/v1/terminal/state?historyLimit=1", { bearer: s.t, req });
      if (r.status === 401 || r.status === 403 || r.status === 404) return { s, gone: true as const };
      return { s, gone: false as const, account: r.status === 200 ? await clientAccount(r.data.account) : null, readOnly: r.status === 200 ? !!r.data.readOnly : s.r, unavailable: r.status !== 200 };
    }),
  );
  const alive = checked.filter((c) => !c.gone);
  const res = reply(200, {
    sessions: alive.map((c) => ({ login: c.s.l, readOnly: c.gone ? c.s.r : c.readOnly, expiresAt: new Date(c.s.e).toISOString(), account: c.gone ? null : c.account })),
    unavailable: alive.some((c) => !c.gone && c.unavailable),
  });
  return alive.length !== list.length || req.cookies.get("kalks_trade")?.value && !list.length ? writeSessions(req, res, alive.map((c) => c.s)) : res;
}
