import { NextResponse, type NextRequest } from "next/server";
import { STATE_COOKIE, STATE_TTL_SECONDS, googleConfig, publicOrigin, startFlow, type Mode } from "@/lib/google-oauth";

// GET /api/auth/google/start?mode=login|register&next=/path&ref=CODE
// Sets the signed state cookie (state, PKCE verifier, nonce, next, ref) and sends the browser to Google.

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const mode: Mode = sp.get("mode") === "register" ? "register" : "login";
  const origin = publicOrigin(req.headers, req.url);
  const cfg = googleConfig();
  if (!cfg) return NextResponse.redirect(`${origin}/${mode}?google_error=unavailable`, { headers: { "cache-control": "no-store" } });

  const flow = startFlow({ mode, next: sp.get("next") ?? "/", ref: sp.get("ref") ?? "", origin }, cfg);
  const res = NextResponse.redirect(flow.url, { headers: { "cache-control": "no-store" } });
  res.cookies.set(STATE_COOKIE, flow.cookie, {
    httpOnly: true,
    secure: origin.startsWith("https://"),
    sameSite: "lax",
    path: "/api/auth/google",
    maxAge: STATE_TTL_SECONDS,
  });
  return res;
}
