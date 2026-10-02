/**
 * POST /api/growth/shares {dealId, showAmounts} — create a share P&L card for a closed trade of the acting account
 * (x-kalks-login), through the growth service (services/growth, POST /v1/growth/me/shares). Kalks Trader uses it for
 * closed option trades (O36 options share card: contract, side, entry → exit premium per contract, return on premium,
 * payoff sketch, referral link; never the balance). The card's public page and PNG live in the Client Area
 * (/s/<code>, /s/<code>/image).
 *
 * Who: the owner of the engine session in this browser's cookie. Investor (read-only) logins and staff sessions opened
 * as the client can't create cards: a card is public and carries the owner's referral code. The growth service checks
 * again that the account belongs to that client and that the deal is a closing deal of it.
 */
import type { NextRequest } from "next/server";
import { csrf, engine, error, readSessions, reply, sessionFor } from "@/lib/engine/server";
import { tenantBrand } from "@/lib/tenant-brand";
import { hostOf } from "@/lib/tenant-host";

export const dynamic = "force-dynamic";

const GROWTH_URL = (process.env.GROWTH_URL ?? "http://127.0.0.1:8101").replace(/\/+$/, "");
const GROWTH_TOKEN = process.env.GROWTH_INTERNAL_TOKEN ?? "";
// the Client Area serves the public card (/s/<code>) and its PNG (same variable as lib/guest.ts, read here directly
// so this route doesn't pull client modules into the server bundle)
const CLIENT_AREA = process.env.NEXT_PUBLIC_CLIENT_AREA_URL ?? "http://localhost:3000";

/** The broker of the visitor's host (gateway tenant_domains, as for the brand); Kalks when unknown. */
async function tenantOf(req: NextRequest): Promise<string> {
  const b = await tenantBrand(hostOf(req.headers)).catch(() => null);
  const slug = b?.slug?.toLowerCase();
  return slug && /^[a-z0-9_-]{1,64}$/.test(slug) ? slug : "kalks";
}

export async function POST(req: NextRequest) {
  const blocked = csrf(req);
  if (blocked) return blocked;
  const body = (await req.json().catch(() => null)) as { dealId?: unknown; showAmounts?: unknown } | null;
  const dealId = Number(body?.dealId);
  if (!body || !Number.isSafeInteger(dealId) || dealId <= 0) return error(422, "validation", "Choose a closed trade to share.");

  const s = sessionFor(req, readSessions(req));
  if (!s) return error(401, "unauthorized", "Log in to your trading account.");
  if (s.r) return error(403, "investor", "Investor (read-only) logins can't create share cards.");
  const st = await engine<{ account?: { userId?: number; login?: number | string }; readOnly?: boolean; staff?: unknown }>("/v1/terminal/state?historyLimit=0", { bearer: s.t, req });
  if (st.status === 401 || st.status === 403 || st.status === 404) return error(401, "session_expired", "Your trading session has expired. Log in again.");
  if (st.status !== 200) return error(503, "unavailable", "The trade server is unavailable. Try again shortly.");
  if (st.data.readOnly) return error(403, "investor", "Investor (read-only) logins can't create share cards.");
  if (st.data.staff) return error(403, "staff_session", "Share cards are created by the client, not from a staff session.");
  const userId = Number(st.data.account?.userId);
  if (!Number.isSafeInteger(userId) || userId <= 0) return error(404, "no_owner", "This account has no client profile.");

  let res: Response;
  try {
    res = await fetch(`${GROWTH_URL}/v1/growth/me/shares`, {
      method: "POST",
      headers: { "x-kalks-internal": GROWTH_TOKEN, "x-kalks-tenant": await tenantOf(req), "x-kalks-user-id": String(userId), "content-type": "application/json" },
      body: JSON.stringify({ kind: "trade", login: Number(s.l), dealId, showAmounts: body.showAmounts === true }),
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    return error(503, "unavailable", "Sharing is unavailable right now. Try again shortly.");
  }
  const data = (await res.json().catch(() => ({}))) as { share?: { code?: string; data?: unknown; showAmounts?: boolean }; error?: { code?: string; message?: string } };
  if (!res.ok || !data.share?.code) {
    const e = data.error ?? {};
    return error(res.status >= 400 ? res.status : 502, e.code ?? "unavailable", e.message ?? "Sharing is unavailable right now. Try again shortly.");
  }
  const code = data.share.code;
  const base = CLIENT_AREA.replace(/\/+$/, "");
  // the account number never leaves: the browser gets the code, the public links and the card data only
  return reply(200, { share: { code, url: `${base}/s/${code}`, image: `${base}/s/${code}/image`, showAmounts: !!data.share.showAmounts, data: data.share.data ?? null } });
}
