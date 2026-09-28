import { NextResponse, type NextRequest } from "next/server";
import { STAFF_COOKIE, clientIp, gateway, safeNext } from "@/lib/gateway";

// Route protection for the Back Office: every page needs a staff session except /login.
// The (app) layout re-validates the session with the gateway on every full render.

export async function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const token = req.cookies.get(STAFF_COOKIE)?.value;

  if (pathname === "/login") {
    if (!token) return NextResponse.next();
    const r = await gateway("/v1/admin/auth/me", { token, ip: clientIp(req.headers), userAgent: req.headers.get("user-agent") });
    if (r.status === 200) return NextResponse.redirect(new URL(safeNext(req.nextUrl.searchParams.get("next")), req.url));
    const res = NextResponse.next();
    if (r.status === 401) res.cookies.delete(STAFF_COOKIE);
    return res;
  }

  if (!token) {
    const url = new URL("/login", req.url);
    if (pathname !== "/") url.searchParams.set("next", pathname + search);
    return NextResponse.redirect(url);
  }
  const headers = new Headers(req.headers);
  headers.set("x-kalks-path", pathname + search);
  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: ["/((?!api/|_next/|assets/|favicon\\.ico|.*\\.[a-zA-Z0-9]+$).*)"],
};
