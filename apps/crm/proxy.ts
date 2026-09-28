import { NextResponse, type NextRequest } from "next/server";
import { IS_DEMO } from "@kalks/mock/mode";
import { SESSION_COOKIE, clientIp, gateway, safeNext } from "@/lib/gateway";
import { REF_COOKIE, cleanRef, trackClick } from "@/lib/ib";

// Route protection for the Client Area.
// - Signed-out visitors on any app page -> /login?next=<page>
// - Signed-in users on /login, /register, /forgot -> ?next or the dashboard
// The (app) layout re-validates the session with the gateway on every full render.
// Demo builds (NEXT_PUBLIC_KALKS_MODE=demo) have no sign-in gate: everything is open, and the
// login / register pages offer "Enter demo".

const AUTH_PAGES = ["/login", "/register", "/forgot"];
/** Public pages (no sign-in): Academy and Prop certificate verification. */
const PUBLIC_PAGES = ["/certificate", "/verify"];

// Partner links (IB programme, services/ib): /r/CODE[/campaign] or any page with ?ref=CODE[&c=campaign].
// The click is recorded with the IB service and the referral kept in a first-party cookie (kalks_ref), so
// sign-up (email or Google) attributes the partner and campaign. Signed-out visitors land on /register.
const REF_SEEN = "kalks_ref_seen";

export async function proxy(req: NextRequest) {
  if (IS_DEMO) return gate(req);
  const { pathname, searchParams } = req.nextUrl;
  const short = pathname.match(/^\/r\/([^/]+)(?:\/([^/]+))?\/?$/);
  const ref = short ? cleanRef(decodeURIComponent(short[1]!), short[2] ? decodeURIComponent(short[2]) : null) : cleanRef(searchParams.get("ref"), searchParams.get("c"));
  if (short && !ref) return NextResponse.redirect(new URL("/register", req.url));
  if (!ref) return gate(req);

  const signedIn = !!req.cookies.get(SESSION_COOKIE)?.value;
  const onAuthPage = AUTH_PAGES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  let res: NextResponse;
  if (short || (!signedIn && !onAuthPage)) {
    const url = new URL("/register", req.url);
    url.searchParams.set("ref", ref.code);
    if (ref.campaign) url.searchParams.set("c", ref.campaign);
    res = NextResponse.redirect(url);
  } else {
    res = await gate(req);
  }
  // one click per visitor and link per 30 minutes from this browser (reloads and the /r redirect don't count twice)
  const value = ref.campaign ? `${ref.code}:${ref.campaign}` : ref.code;
  if (req.cookies.get(REF_SEEN)?.value !== value) {
    await trackClick(req, res, ref, clientIp(req.headers));
    res.cookies.set(REF_SEEN, value, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 1800 });
  } else if (!req.cookies.get(REF_COOKIE)) {
    res.cookies.set(REF_COOKIE, value, { httpOnly: false, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 90 * 24 * 3600 });
  }
  return res;
}

async function gate(req: NextRequest): Promise<NextResponse> {
  if (IS_DEMO) return NextResponse.next();
  const { pathname, search } = req.nextUrl;
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const isAuthPage = AUTH_PAGES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  if (PUBLIC_PAGES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return NextResponse.next();

  if (isAuthPage) {
    if (!token) return NextResponse.next();
    const r = await gateway("/v1/auth/me", { token, ip: clientIp(req.headers), userAgent: req.headers.get("user-agent") });
    if (r.status === 200) return NextResponse.redirect(new URL(safeNext(req.nextUrl.searchParams.get("next")), req.url));
    const res = NextResponse.next();
    if (r.status === 401) res.cookies.delete(SESSION_COOKIE);
    return res;
  }

  if (!token) {
    const url = new URL("/login", req.url);
    if (pathname !== "/") url.searchParams.set("next", pathname + search);
    return NextResponse.redirect(url);
  }
  // let the layout know which page was requested (for ?next= if the session turns out to be dead)
  const headers = new Headers(req.headers);
  headers.set("x-kalks-path", pathname + search);
  return NextResponse.next({ request: { headers } });
}

export const config = {
  // everything except API routes, Next internals and static files
  // (/trade is redirected to Kalks Trader by next.config before the proxy runs)
  matcher: ["/((?!api/|_next/|assets/|favicon\\.ico|.*\\.[a-zA-Z0-9]+$).*)"],
};
