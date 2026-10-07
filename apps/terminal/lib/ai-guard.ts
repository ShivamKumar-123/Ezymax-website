// Server-only gate for the paid AI routes (/api/ai-trader, /api/options/explain): every model call costs money, so
// it needs a signed-in terminal session that the trading engine confirms (the same session cookie and engine check as
// the /api/engine/* BFF routes), and each user has a budget of 10 calls a minute and 200 a day.
//
// Demo builds have no engine and no sign-in: there the AI routes answer only on the developer's own machine
// (localhost), so the public demo showcase cannot spend AI credits.
//
// The budget lives in this server process's memory (one Node process per deployment); a restart resets it.

import type { NextRequest } from "next/server";
import { IS_DEMO } from "@kalks/mock";
import { engine, readSessions, sameOrigin, sessionFor } from "@/lib/engine/server";
import { clientIp } from "@/lib/gateway";

export const AI_PER_MINUTE = 10;
export const AI_PER_DAY = 200;
const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;

/** Machine-readable reason, so the terminal can show it in the reader's language. */
export type AiDenied = "signin" | "forbidden" | "rate_minute" | "rate_day" | "unavailable";

const MESSAGES: Record<AiDenied, string> = {
  signin: "Sign in to use AI.",
  forbidden: "Cross-site request blocked.",
  rate_minute: `You have reached the limit of ${AI_PER_MINUTE} AI requests a minute. Try again in a minute.`,
  rate_day: `You have reached today's limit of ${AI_PER_DAY} AI requests. It resets within 24 hours.`,
  unavailable: "The trade server is unavailable, so your sign-in could not be checked. Try again shortly.",
};

function denied(status: number, code: AiDenied, headers?: Record<string, string>) {
  return Response.json({ configured: true, error: MESSAGES[code], code }, { status, headers: { "cache-control": "no-store", ...headers } });
}

// engine-confirmed sessions, cached for a minute (a token -> valid-until map)
const confirmed = new Map<string, number>();
// per user: the call times of the last 24 hours
const calls = new Map<string, number[]>();

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

/** Who is calling, or the response that refuses the call. */
async function identify(req: NextRequest): Promise<{ user: string } | { res: Response }> {
  if (IS_DEMO) {
    // no engine sessions in demo builds: only the developer's machine may call the model
    const host = (req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "").replace(/:\d+$/, "");
    if (!LOCAL_HOSTS.has(host) && !LOCAL_HOSTS.has(req.nextUrl.hostname)) return { res: denied(401, "signin") };
    return { user: `local:${clientIp(req.headers)}` };
  }
  const list = readSessions(req);
  const s = sessionFor(req, list) ?? list[0];
  if (!s) return { res: denied(401, "signin") };
  const now = Date.now();
  if ((confirmed.get(s.t) ?? 0) < now) {
    const r = await engine("/v1/terminal/state?historyLimit=1", { bearer: s.t, req });
    if (r.status === 401 || r.status === 403 || r.status === 404) return { res: denied(401, "signin") };
    if (r.status !== 200) return { res: denied(503, "unavailable") };
    if (confirmed.size > 5000) confirmed.clear();
    confirmed.set(s.t, Math.min(s.e, now + MINUTE));
  }
  return { user: `login:${s.l}` };
}

/** Counts one call against the user's budget; null when within it. */
function overBudget(user: string): Response | null {
  const now = Date.now();
  const day = (calls.get(user) ?? []).filter((t) => now - t < DAY);
  const minute = day.filter((t) => now - t < MINUTE);
  if (minute.length >= AI_PER_MINUTE) {
    calls.set(user, day);
    return denied(429, "rate_minute", { "retry-after": String(Math.max(1, Math.ceil((minute[0]! + MINUTE - now) / 1000))) });
  }
  if (day.length >= AI_PER_DAY) {
    calls.set(user, day);
    return denied(429, "rate_day", { "retry-after": String(Math.max(60, Math.ceil((day[0]! + DAY - now) / 1000))) });
  }
  day.push(now);
  if (calls.size > 20_000) calls.clear();
  calls.set(user, day);
  return null;
}

/**
 * Call at the top of a paid AI POST handler: returns the response to send when the caller may not use the model now
 * (cross-site, not signed in, over budget), or null to go ahead.
 */
export async function aiGate(req: NextRequest): Promise<Response | null> {
  if (!sameOrigin(req)) return denied(403, "forbidden");
  const who = await identify(req);
  if ("res" in who) return who.res;
  return overBudget(who.user);
}
