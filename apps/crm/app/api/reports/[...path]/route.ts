import { NextResponse, type NextRequest } from "next/server";
import { sessionUser } from "@/lib/trading";
import { reportsFetch } from "@/lib/reports";
import { VIEWER_OUT_OF_SCOPE, viewerHasAccount } from "@/lib/viewer";

// Client Area reports BFF. Browser -> /api/reports/<route> (same origin) -> reports service /v1/me/…
// The client comes from the HttpOnly gateway session cookie; the service returns 404 for accounts the user
// doesn't own. Read-only: GET only.
//
//   GET analytics?login=all|<login>&from&to                      analytics JSON (D91)
//   GET accounts/{login}/months                                   calendar months with net / deposits / withdrawals
//   GET accounts/{login}/statement?from&to&format=pdf|csv|xlsx|json&open=0&charges=0&deals=0   file download (D48)

type Ctx = { params: Promise<{ path: string[] }> };

const NO_STORE = { "cache-control": "no-store" };
const LOGIN_RE = /^\d{8}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}(T[\d:.]+(Z|[+-]\d{2}:\d{2})?)?$/;

function error(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status, headers: NO_STORE });
}

/** Only known query keys with validated values reach the service. */
function query(req: NextRequest, keys: readonly string[]): string | NextResponse {
  const sp = req.nextUrl.searchParams;
  const out = new URLSearchParams();
  for (const k of keys) {
    const v = sp.get(k);
    if (v === null || v === "") continue;
    if ((k === "from" || k === "to") && !DATE_RE.test(v)) return error(400, "bad_request", `Invalid ${k} date.`);
    if (k === "login" && v !== "all" && !LOGIN_RE.test(v)) return error(400, "bad_request", "Invalid account.");
    if (k === "format" && !["pdf", "csv", "xlsx", "json"].includes(v)) return error(400, "bad_request", "Invalid format.");
    if (["open", "charges", "deals"].includes(k) && v !== "0" && v !== "1") return error(400, "bad_request", `Invalid ${k}.`);
    out.set(k, v);
  }
  const s = out.toString();
  return s ? `?${s}` : "";
}

export async function GET(req: NextRequest, { params }: Ctx) {
  const path = (await params).path;
  const user = await sessionUser(req);
  if (user === "unavailable") return error(503, "unavailable", "Sign-in service is unavailable. Please try again shortly.");
  if (!user) return error(401, "unauthorized", "Please sign in.");

  // a view-only login (D90) reads only the accounts it was given; "all accounts" means all of those
  if (user.viewer) {
    const login = path[0] === "accounts" ? path[1] : req.nextUrl.searchParams.get("login");
    if (!login || login === "all" ? user.viewer.accounts.length === 0 : !viewerHasAccount(user.viewer, login)) {
      return NextResponse.json({ error: VIEWER_OUT_OF_SCOPE }, { status: 403, headers: NO_STORE });
    }
    if (path[0] === "analytics" && (!login || login === "all") && user.viewer.accounts.length !== 1) {
      return NextResponse.json({ error: { ...VIEWER_OUT_OF_SCOPE, message: "Choose one of the accounts shared with you." } }, { status: 403, headers: NO_STORE });
    }
  }

  let target: string | null = null;
  let file = false;
  if (path.length === 1 && path[0] === "analytics") {
    const q = query(req, ["login", "from", "to"]);
    if (q instanceof NextResponse) return q;
    target = `/v1/me/analytics${q}`;
    // a viewer with a single account: "all" is that account
    if (user.viewer && user.viewer.accounts.length === 1 && !/[?&]login=\d/.test(target)) {
      const sp = new URLSearchParams(q.replace(/^\?/, ""));
      sp.set("login", user.viewer.accounts[0]!);
      target = `/v1/me/analytics?${sp}`;
    }
  } else if (path.length === 3 && path[0] === "accounts" && LOGIN_RE.test(path[1]!) && path[2] === "months") {
    target = `/v1/me/accounts/${path[1]}/months`;
  } else if (path.length === 3 && path[0] === "accounts" && LOGIN_RE.test(path[1]!) && path[2] === "statement") {
    const q = query(req, ["from", "to", "format", "open", "charges", "deals"]);
    if (q instanceof NextResponse) return q;
    target = `/v1/me/accounts/${path[1]}/statement${q}`;
    file = (req.nextUrl.searchParams.get("format") ?? "pdf") !== "json";
  }
  if (!target) return error(404, "not_found", "Not found.");

  const res = await reportsFetch(target, user);
  if (!res) return error(503, "unavailable", "Reports are unavailable right now. Please try again shortly.");
  if (file && res.ok) {
    const headers = new Headers(NO_STORE);
    for (const h of ["content-type", "content-disposition"]) {
      const v = res.headers.get(h);
      if (v) headers.set(h, v);
    }
    headers.set("x-content-type-options", "nosniff");
    return new NextResponse(res.body, { status: 200, headers });
  }
  const data = await res.json().catch(() => ({ error: { code: "bad_gateway", message: "Unexpected response from the reports service." } }));
  // the service lists every account of the client next to the analytics: a view-only login sees only the ones it
  // was given (logins, balances and equity of the others stay private)
  if (user.viewer && res.ok && path[0] === "analytics" && Array.isArray((data as { accounts?: unknown }).accounts)) {
    const d = data as { accounts: { login: number | string }[] };
    d.accounts = d.accounts.filter((a) => viewerHasAccount(user.viewer!, a.login));
  }
  return NextResponse.json(data, { status: res.status, headers: NO_STORE });
}
