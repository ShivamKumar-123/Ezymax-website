import { NextResponse, type NextRequest } from "next/server";
import type { GatewayUser } from "@/lib/gateway";
import { TERMINAL_BASE, clientAccount, clientDeal, clientOrder, clientPosition, engine, sameOrigin, sessionUser } from "@/lib/trading";

// Client Area trading BFF. Browser -> /api/trading/<route> (same origin) -> trading engine /v1/…
// The client is resolved from the HttpOnly gateway session cookie (gateway /v1/auth/me); the engine gets
// that user id in X-Kalks-User-Id and returns 404 for accounts the user doesn't own. A user id sent by the
// browser is never used. CSRF: cookies are SameSite=Lax, POSTs must be JSON with a same-origin Origin.
//
//   GET  groups                              open-account groups and their specs
//   GET  accounts                            the client's accounts (live metrics)
//   POST accounts                            {type, group, leverage?, name?, password?, initialBalance?}
//   GET  accounts/{login}                    {account, positions[], orders[]}
//   GET  accounts/{login}/history?from&to&page&limit
//   GET  accounts/{login}/ledger?from&to&page&limit
//   GET  accounts/{login}/export?kind=history|ledger&from&to   CSV download (times in UTC)
//   POST accounts/{login}/demo-refill
//   POST accounts/{login}/passwords          {kind: trading|investor, password}
//   POST accounts/{login}/leverage           {leverage}
//   POST accounts/{login}/sso                {url, expiresAt}: url = NEXT_PUBLIC_TERMINAL_URL + "/?sso=<token>"

type Obj = Record<string, unknown>;
type Ctx = { params: Promise<{ path: string[] }> };

const NO_STORE = { "cache-control": "no-store" };
const LOGIN_RE = /^\d{8}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}(T[\d:.]+(Z|[+-]\d{2}:\d{2})?)?$/;

function error(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status, headers: NO_STORE });
}

function reply(status: number, data: unknown) {
  return NextResponse.json(data, { status, headers: NO_STORE });
}

async function auth(req: NextRequest): Promise<GatewayUser | NextResponse> {
  const user = await sessionUser(req);
  if (user === "unavailable") return error(503, "unavailable", "Sign-in service is unavailable. Please try again shortly.");
  if (!user) return error(401, "unauthorized", "Please sign in.");
  return user;
}

/** from / to / page / limit, validated before they reach the engine. */
function pageQuery(req: NextRequest, maxLimit = 200): string | NextResponse {
  const sp = req.nextUrl.searchParams;
  const out = new URLSearchParams();
  for (const k of ["from", "to"] as const) {
    const v = sp.get(k);
    if (!v) continue;
    if (!DATE_RE.test(v)) return error(400, "bad_request", `Invalid ${k} date.`);
    out.set(k, v);
  }
  for (const [k, max] of [["page", 100000], ["limit", maxLimit]] as const) {
    const v = sp.get(k);
    if (!v) continue;
    const n = Number(v);
    if (!Number.isInteger(n) || n < 1 || n > max) return error(400, "bad_request", `Invalid ${k}.`);
    out.set(k, String(n));
  }
  const s = out.toString();
  return s ? `?${s}` : "";
}

export async function GET(req: NextRequest, { params }: Ctx) {
  const path = (await params).path;
  const user = await auth(req);
  if (user instanceof NextResponse) return user;

  if (path.length === 1 && path[0] === "groups") {
    const r = await engine<{ groups?: Obj[] }>("/v1/groups", { user, req });
    if (r.status !== 200) return reply(r.status, r.data);
    // spread group / route are dealing details; the client sees the commercial terms only
    const groups = (r.data.groups ?? []).map(({ route: _r, tenantId: _t, ...g }) => g);
    return reply(200, { groups });
  }

  if (path.length === 1 && path[0] === "accounts") {
    const r = await engine<{ accounts?: unknown[] }>("/v1/accounts", { user, req });
    if (r.status !== 200) return reply(r.status, r.data);
    return reply(200, { accounts: (r.data.accounts ?? []).map(clientAccount).filter(Boolean) });
  }

  const login = path[1];
  if (path[0] !== "accounts" || !login || !LOGIN_RE.test(login)) return error(404, "not_found", "Not found.");

  if (path.length === 2) {
    const r = await engine<{ account?: unknown; positions?: unknown[]; orders?: unknown[] }>(`/v1/accounts/${login}`, { user, req });
    if (r.status !== 200) return reply(r.status, r.data);
    if (!r.data.account) return error(404, "not_found", "Account not found.");
    return reply(200, {
      account: clientAccount(r.data.account),
      positions: (r.data.positions ?? []).map(clientPosition),
      orders: (r.data.orders ?? []).map(clientOrder),
    });
  }

  if (path.length === 3 && (path[2] === "history" || path[2] === "ledger")) {
    const q = pageQuery(req);
    if (q instanceof NextResponse) return q;
    const r = await engine<Obj>(`/v1/accounts/${login}/${path[2]}${q}`, { user, req });
    if (r.status !== 200 || path[2] === "ledger") return reply(r.status, r.data);
    const d = r.data as { deals?: unknown[]; orders?: unknown[] };
    return reply(200, { ...r.data, deals: (d.deals ?? []).map(clientDeal), orders: (d.orders ?? []).map(clientOrder) });
  }

  if (path.length === 3 && path[2] === "export") return exportCsv(req, user, login);

  return error(404, "not_found", "Not found.");
}

export async function POST(req: NextRequest, { params }: Ctx) {
  const path = (await params).path;
  if (!sameOrigin(req)) return error(403, "forbidden", "Cross-site request blocked.");
  if (!req.headers.get("content-type")?.includes("application/json")) return error(415, "bad_request", "Expected JSON.");
  const body = (await req.json().catch(() => null)) as Obj | null;
  if (body === null || typeof body !== "object" || Array.isArray(body)) return error(400, "bad_request", "Invalid request body.");
  const user = await auth(req);
  if (user instanceof NextResponse) return user;

  if (path.length === 1 && path[0] === "accounts") {
    const type = body.type;
    if (type !== "live" && type !== "demo") return error(422, "validation", "Choose a live or demo account.");
    if (typeof body.group !== "string" || !/^[a-z0-9_-]{1,40}$/i.test(body.group)) return error(422, "validation", "Choose an account type.");
    const open: Obj = { type, group: body.group };
    if (body.leverage !== undefined) {
      if (!Number.isInteger(body.leverage)) return error(422, "validation", "Invalid leverage.");
      open.leverage = body.leverage;
    }
    if (typeof body.name === "string" && body.name.trim()) open.name = body.name.trim().slice(0, 32);
    if (typeof body.password === "string" && body.password) open.password = body.password.slice(0, 64);
    if (type === "demo" && body.initialBalance !== undefined) {
      if (typeof body.initialBalance !== "number" || !Number.isFinite(body.initialBalance)) return error(422, "validation", "Invalid demo balance.");
      open.initialBalance = body.initialBalance;
    }
    const r = await engine<{ account?: unknown; credentials?: Obj }>("/v1/accounts", { user, req, body: open });
    if (r.status !== 200) return reply(r.status, r.data);
    // Generated passwords are returned exactly once, here; they are not stored anywhere by the Client Area.
    const creds = { ...(r.data.credentials ?? {}) };
    if (open.password && !creds.password) creds.password = open.password;
    return reply(200, { account: clientAccount(r.data.account), credentials: creds });
  }

  const login = path[1];
  if (path[0] !== "accounts" || !login || !LOGIN_RE.test(login) || path.length !== 3) return error(404, "not_found", "Not found.");

  switch (path[2]) {
    case "demo-refill": {
      const r = await engine(`/v1/accounts/${login}/demo-refill`, { user, req, body: {} });
      return reply(r.status, r.data);
    }
    case "passwords": {
      if (body.kind !== "trading" && body.kind !== "investor") return error(422, "validation", "Choose the trading or investor password.");
      if (typeof body.password !== "string" || body.password.length > 64) return error(422, "validation", "Invalid password.");
      const r = await engine(`/v1/accounts/${login}/passwords`, { user, req, body: { kind: body.kind, password: body.password } });
      return reply(r.status, r.data);
    }
    case "leverage": {
      if (!Number.isInteger(body.leverage)) return error(422, "validation", "Invalid leverage.");
      const r = await engine(`/v1/accounts/${login}/leverage`, { user, req, body: { leverage: body.leverage } });
      return reply(r.status, r.data);
    }
    case "sso": {
      const r = await engine<{ token?: string; expiresAt?: string }>(`/v1/accounts/${login}/sso`, { user, req, body: {} });
      if (r.status !== 200 || !r.data.token) return reply(r.status === 200 ? 502 : r.status, r.data);
      return reply(200, { url: `${TERMINAL_BASE}/?sso=${encodeURIComponent(r.data.token)}`, expiresAt: r.data.expiresAt });
    }
  }
  return error(404, "not_found", "Not found.");
}

/* ------------------------------------------------------------------ */
/* CSV statements (D48)                                                */
/* ------------------------------------------------------------------ */

const EXPORT_PAGE = 1000;
const EXPORT_MAX_PAGES = 50;

function cell(v: unknown, text = false): string {
  let s = v === null || v === undefined ? "" : String(v);
  // spreadsheet formula injection: free-text cells never start with = + - @
  if (text && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

async function exportCsv(req: NextRequest, user: GatewayUser, login: string) {
  const kind = req.nextUrl.searchParams.get("kind");
  if (kind !== "history" && kind !== "ledger") return error(400, "bad_request", "kind must be history or ledger.");
  const sp = req.nextUrl.searchParams;
  const range = new URLSearchParams();
  for (const k of ["from", "to"] as const) {
    const v = sp.get(k);
    if (!v) continue;
    if (!DATE_RE.test(v)) return error(400, "bad_request", `Invalid ${k} date.`);
    range.set(k, v);
  }

  const rows: Obj[] = [];
  for (let page = 1; page <= EXPORT_MAX_PAGES; page++) {
    const q = new URLSearchParams(range);
    q.set("page", String(page));
    q.set("limit", String(EXPORT_PAGE));
    const r = await engine<{ deals?: Obj[]; items?: Obj[]; total?: number }>(`/v1/accounts/${login}/${kind}?${q}`, { user, req });
    if (r.status !== 200) return reply(r.status, r.data);
    const batch = (kind === "history" ? r.data.deals : r.data.items) ?? [];
    rows.push(...batch);
    if (batch.length < EXPORT_PAGE || rows.length >= (r.data.total ?? 0)) break;
  }

  let csv: string;
  if (kind === "history") {
    const head = ["Time (UTC)", "Deal", "Position", "Order", "Symbol", "Type", "Direction", "Volume", "Price", "Open price", "Open time (UTC)", "Commission", "Swap", "Profit", "Reason", "Comment"];
    csv = [
      head.join(","),
      ...rows.map((d) =>
        [d.time, d.id, d.positionTicket, d.orderTicket, d.symbol, d.side, d.entry, d.volume, d.price, d.openPrice, d.openTime, d.commission, d.swap, d.profit, d.reason, cell(d.comment, true)]
          .map((v, i) => (i === 15 ? v : cell(v)))
          .join(","),
      ),
    ].join("\r\n");
  } else {
    const head = ["Time (UTC)", "Transaction", "Type", "Sub-ledger", "Amount", "Currency", "Reference", "Note"];
    csv = [head.join(","), ...rows.map((e) => [cell(e.at), cell(e.txn), cell(e.kind), cell(e.subLedger), cell(e.amount), cell(e.currency), cell(e.reference, true), cell(e.note, true)].join(","))].join("\r\n");
  }

  const span = [range.get("from"), range.get("to")].filter(Boolean).map((s) => s!.slice(0, 10)).join("_");
  const name = `kalks-${login}-${kind === "history" ? "trades" : "ledger"}${span ? `-${span}` : ""}.csv`;
  return new NextResponse("﻿" + csv + "\r\n", {
    status: 200,
    headers: { ...NO_STORE, "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="${name}"`, "x-content-type-options": "nosniff" },
  });
}
