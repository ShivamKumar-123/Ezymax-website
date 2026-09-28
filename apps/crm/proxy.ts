import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, clientIp, gateway, safeNext } from "@/lib/gateway";

// Route protection for the Client Area.
// - Signed-out visitors on any app page -> /login?next=<page>
// - Signed-in users on /login, /register, /forgot -> ?next or the dashboard
// The (app) layout re-validates the session with the gateway on every full render.

const AUTH_PAGES = ["/login", "/register", "/forgot"];

export async function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const isAuthPage = AUTH_PAGES.some((p) => pathname === p || pathname.startsWith(`${p}/`));

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
