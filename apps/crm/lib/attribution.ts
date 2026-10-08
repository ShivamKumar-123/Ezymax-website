// First-touch campaign attribution (D144). The first page a visitor opens with utm_* tags (or with an external
// referrer) is remembered in a first-party HttpOnly cookie for 30 days; the sign-up BFFs (email and Google)
// send it to the gateway, which stores it once on the new client. The browser never supplies attribution in the
// sign-up body, so it can't be forged per request. The website -> Client Area register redirect keeps the query
// string, so tags on website links survive the hop.

import type { NextRequest, NextResponse } from "next/server";

export const ATTR_COOKIE = "ezymex_attr";
const MAX_AGE = 30 * 24 * 3600;
const KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"] as const;

export type Attribution = Partial<Record<(typeof KEYS)[number] | "landing_page" | "referrer", string>>;

const clip = (v: string, n: number) => v.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, n);

/** Host of an external referrer (not this site), or null. */
function externalReferrer(req: NextRequest): string | null {
  const ref = req.headers.get("referer");
  if (!ref) return null;
  try {
    const u = new URL(ref);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    const own = (req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "").split(",")[0]!.trim().toLowerCase();
    if (u.host.toLowerCase() === own) return null;
    return `${u.protocol}//${u.host}`;
  } catch {
    return null;
  }
}

/** Stamps the attribution cookie on the first tagged (or externally referred) page view. Pages only. */
export function captureAttribution(req: NextRequest, res: NextResponse): NextResponse {
  if (req.method !== "GET" || req.cookies.get(ATTR_COOKIE)) return res;
  const q = req.nextUrl.searchParams;
  const a: Attribution = {};
  for (const k of KEYS) {
    const v = q.get(k);
    if (v && clip(v, 100)) a[k] = clip(v, 100);
  }
  const referrer = externalReferrer(req);
  if (!Object.keys(a).length && !referrer) return res;
  a.landing_page = clip(`${req.nextUrl.pathname}${req.nextUrl.search}`, 300);
  if (referrer) a.referrer = referrer;
  res.cookies.set(ATTR_COOKIE, encodeURIComponent(JSON.stringify(a)), { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: MAX_AGE });
  return res;
}

export function readAttribution(req: NextRequest): Attribution | null {
  const raw = req.cookies.get(ATTR_COOKIE)?.value;
  if (!raw) return null;
  try {
    const v = JSON.parse(decodeURIComponent(raw)) as Record<string, unknown>;
    const out: Attribution = {};
    for (const k of [...KEYS, "landing_page", "referrer"] as const) {
      const x = v[k];
      if (typeof x === "string" && x.trim()) out[k] = clip(x, k === "landing_page" ? 300 : 200);
    }
    return Object.keys(out).length ? out : null;
  } catch {
    return null;
  }
}

/** Sign-up body: attribution from the cookie only, marketing consent as a boolean (default on). */
export function withAttribution(body: Record<string, unknown>, req: NextRequest) {
  delete body.attribution;
  const a = readAttribution(req);
  if (a) body.attribution = a;
  body.marketing_consent = body.marketing_consent !== false;
}
