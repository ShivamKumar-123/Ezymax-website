// Server-only gate for the mobile app's paid AI routes (app/api/mobile/trade/ai-trader, …/trade/options/explain): Ezymex
// Trader's lib/ai-guard.ts rules with the app's auth. Every model call costs money, so it needs a live gateway session
// (Authorization: Bearer; view-only logins never) and each client has a budget of 10 calls a minute and 200 a day.
// The budget lives in this server process's memory (one Node process per deployment); a restart resets it.

import type { NextRequest } from "next/server";
import { SESSION_COOKIE, fetchMe } from "@/lib/gateway";
import { bearerOf } from "@/lib/mobile";

export const AI_PER_MINUTE = 10;
export const AI_PER_DAY = 200;
const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;

/** Machine-readable reason, so the app can show it in the reader's language (the same codes as Ezymex Trader). */
export type AiDenied = "signin" | "forbidden" | "rate_minute" | "rate_day" | "unavailable";

const MESSAGES: Record<AiDenied, string> = {
  signin: "Sign in to use AI.",
  forbidden: "AI isn't available with this login.",
  rate_minute: `You have reached the limit of ${AI_PER_MINUTE} AI requests a minute. Try again in a minute.`,
  rate_day: `You have reached today's limit of ${AI_PER_DAY} AI requests. It resets within 24 hours.`,
  unavailable: "Sign-in service is unavailable, so your sign-in could not be checked. Try again shortly.",
};

function denied(status: number, code: AiDenied, headers?: Record<string, string>) {
  return Response.json({ configured: true, error: MESSAGES[code], code }, { status, headers: { "cache-control": "no-store", ...headers } });
}

// per client: the call times of the last 24 hours
const calls = new Map<string, number[]>();

/** Counts one call against the client's budget; null when within it. */
function overBudget(key: string): Response | null {
  const now = Date.now();
  const day = (calls.get(key) ?? []).filter((t) => now - t < DAY);
  const minute = day.filter((t) => now - t < MINUTE);
  if (minute.length >= AI_PER_MINUTE) {
    calls.set(key, day);
    return denied(429, "rate_minute", { "retry-after": String(Math.max(1, Math.ceil((minute[0]! + MINUTE - now) / 1000))) });
  }
  if (day.length >= AI_PER_DAY) {
    calls.set(key, day);
    return denied(429, "rate_day", { "retry-after": String(Math.max(60, Math.ceil((day[0]! + DAY - now) / 1000))) });
  }
  day.push(now);
  if (calls.size > 20_000) calls.clear();
  calls.set(key, day);
  return null;
}

/**
 * Call at the top of a paid AI POST handler: the response to send when the caller may not use the model now (no or
 * dead session, view-only login, over budget), or null to go ahead.
 */
export async function mobileAiGate(req: NextRequest): Promise<Response | null> {
  const token = bearerOf(req.headers);
  if (!token) return denied(401, "signin");
  if (req.cookies.get(SESSION_COOKIE)?.value) return denied(403, "forbidden");
  const user = await fetchMe(token, req.headers);
  if (user === "unavailable") return denied(503, "unavailable");
  if (!user) return denied(401, "signin");
  if (user.viewer) return denied(403, "forbidden");
  return overBudget(`user:${user.id}`);
}
