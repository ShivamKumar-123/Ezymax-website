import { NextResponse, type NextRequest } from "next/server";
import type { GatewayUser } from "@/lib/gateway";
import { clientOrder, clientPosition, sameOrigin, sessionUser } from "@/lib/trading";
import { socialEngine } from "@/lib/social";
import { mamGet, mamPatch, mamPost } from "@/lib/mam-bff";

// Client Area social BFF (copy trading and PAMM). Browser -> /api/social/<route> (same origin) -> engine /v1/social/…
// The client is resolved from the HttpOnly gateway session cookie; the engine gets that user id in X-Kalks-User-Id and
// the gateway KYC status in X-Kalks-Kyc (D68). A user id sent by the browser is never used. CSRF: cookies are
// SameSite=Lax, writes must be JSON with a same-origin Origin. Every body is rebuilt from known, type-checked fields.
//
//   GET   leaderboard?period&program&sort&risk&minDays
//   GET   masters/{id}
//   GET   master/me · master/dashboard
//   POST  master/apply                        {login, nickname, strategy, description, program, perfFeePct, feePeriod, minAllocation?}
//   PATCH master/me                           {nickname?, strategy?, description?, perfFeePct?, feePeriod?, minAllocation?}
//   GET   subscriptions · subscriptions/{id}
//   POST  subscriptions                       {masterId, sizing:{mode, value}, allocation, maxLot?, equityStop?, maxDdPct?, excludedSymbols?}
//   PATCH subscriptions/{id}                  {sizing?, maxLot?, equityStop?, maxDdPct?, excludedSymbols?, paused?}
//   POST  subscriptions/{id}/stop             {returnFunds?, closePositions?} (closePositions false keeps the copied positions)
//   GET   funds · funds/{id} · funds/{id}/statement
//   POST  funds                               {name, period, perfFeePct, lockInDays, minInvestment, maxDdPct, seed}
//   PATCH funds/{id}                          {name?, period?, perfFeePct?, lockInDays?, minInvestment?, maxDdPct?}
//   POST  funds/{id}/invest                   {amount, stopLossPct?}
//   POST  funds/{id}/redeem                   {units} | {amount} | {all:true}
//   POST  requests/{id}/cancel
//   GET   investments
//   PATCH investments/{fundId}                {stopLossPct: number|null}
//   GET   symbols                             {symbols:[{symbol, assetClass}]} (for the follower's symbol exclusions)
//   *     mam/…                               MAM (multi-account manager): see lib/mam-bff.ts

type Obj = Record<string, unknown>;
type Ctx = { params: Promise<{ path: string[] }> };

const NO_STORE = { "cache-control": "no-store" };
const ID_RE = /^\d{1,12}$/;
const SYMBOL_RE = /^[A-Za-z0-9._#-]{1,24}$/;
const PERIODS = ["daily", "weekly", "monthly"] as const;
const PROGRAMS = ["copy", "pamm", "both"] as const;
const SIZING = ["equity", "allocation", "multiplier", "fixed_lot"] as const;

function error(status: number, code: string, message: string, field?: string) {
  return NextResponse.json({ error: { code, message, ...(field ? { field } : {}) } }, { status, headers: NO_STORE });
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

/* ------------------------------------------------------------------ */
/* Client-safe views                                                   */
/* ------------------------------------------------------------------ */

/** A public master card never carries the account login, user id or review details. */
function publicMaster(m: unknown): unknown {
  if (!m || typeof m !== "object") return m;
  const { login: _l, userId: _u, kycVerified: _k, reviewNote: _r, reviewedBy: _b, createdAt: _c, ...rest } = m as Obj;
  return rest;
}

/** The client's own master profile: keeps login / review note, drops staff and internal ids. */
function ownMaster(m: unknown): unknown {
  if (!m || typeof m !== "object") return m;
  const { userId: _u, reviewedBy: _b, ...rest } = m as Obj;
  return rest;
}

function clientFee(f: unknown): unknown {
  if (!f || typeof f !== "object") return f;
  const { payerUserId: _p, reviewedBy: _r, ...rest } = f as Obj;
  return rest;
}

/* ------------------------------------------------------------------ */
/* Validation                                                          */
/* ------------------------------------------------------------------ */

class Invalid extends Error {
  constructor(
    message: string,
    public field?: string,
  ) {
    super(message);
  }
}

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

function num(body: Obj, k: string, opts: { min?: number; max?: number; int?: boolean; label: string; nullable?: boolean; required?: boolean }): number | null | undefined {
  const v = body[k];
  if (v === undefined) {
    if (opts.required) throw new Invalid(`Enter ${opts.label}.`, k);
    return undefined;
  }
  if (v === null) {
    if (opts.nullable) return null;
    throw new Invalid(`Enter ${opts.label}.`, k);
  }
  if (!isNum(v) || (opts.int && !Number.isInteger(v)) || (opts.min !== undefined && v < opts.min) || (opts.max !== undefined && v > opts.max)) {
    throw new Invalid(`Invalid ${opts.label}.`, k);
  }
  return v;
}

function text(body: Obj, k: string, opts: { max: number; label: string; required?: boolean; min?: number }): string | undefined {
  const v = body[k];
  if (v === undefined || v === null) {
    if (opts.required) throw new Invalid(`Enter ${opts.label}.`, k);
    return undefined;
  }
  if (typeof v !== "string") throw new Invalid(`Invalid ${opts.label}.`, k);
  const s = v.trim();
  if ((opts.required || opts.min) && s.length < (opts.min ?? 1)) throw new Invalid(`Enter ${opts.label}.`, k);
  if (s.length > opts.max) throw new Invalid(`${opts.label[0]!.toUpperCase()}${opts.label.slice(1)} is too long (max ${opts.max} characters).`, k);
  return s;
}

function oneOf<T extends string>(body: Obj, k: string, values: readonly T[], label: string, required = false): T | undefined {
  const v = body[k];
  if (v === undefined) {
    if (required) throw new Invalid(`Choose ${label}.`, k);
    return undefined;
  }
  if (typeof v !== "string" || !(values as readonly string[]).includes(v)) throw new Invalid(`Choose ${label}.`, k);
  return v as T;
}

function put(out: Obj, k: string, v: unknown) {
  if (v !== undefined) out[k] = v;
}

function sizing(v: unknown): Obj {
  if (!v || typeof v !== "object" || Array.isArray(v)) throw new Invalid("Choose how trades are sized.", "sizing");
  const s = v as Obj;
  const mode = oneOf(s, "mode", SIZING, "a sizing mode", true)!;
  const value = s.value === undefined && mode === "equity" ? 1 : s.value;
  if (!isNum(value) || value <= 0 || value > 1_000_000) throw new Invalid("Enter a sizing value above zero.", "sizing");
  return { mode, value };
}

function symbols(v: unknown): string[] {
  if (!Array.isArray(v) || v.length > 200) throw new Invalid("Invalid symbol list.", "excludedSymbols");
  const out = new Set<string>();
  for (const s of v) {
    if (typeof s !== "string" || !SYMBOL_RE.test(s)) throw new Invalid("Invalid symbol list.", "excludedSymbols");
    out.add(s);
  }
  return [...out];
}

/** Follower limits shared by POST and PATCH subscriptions (`null` clears a limit on PATCH). */
function limits(body: Obj, out: Obj, nullable: boolean) {
  put(out, "maxLot", num(body, "maxLot", { min: 0.01, max: 10000, label: "max lot", nullable }));
  put(out, "equityStop", num(body, "equityStop", { min: 0, max: 1e9, label: "equity stop", nullable }));
  put(out, "maxDdPct", num(body, "maxDdPct", { min: 1, max: 99, label: "max drawdown", nullable }));
  if (body.excludedSymbols !== undefined) out.excludedSymbols = body.excludedSymbols === null && nullable ? [] : symbols(body.excludedSymbols);
}

function masterBody(body: Obj, apply: boolean): Obj {
  const out: Obj = {};
  if (apply) out.login = num(body, "login", { int: true, min: 1, max: 99_999_999, label: "an account", required: true });
  put(out, "nickname", text(body, "nickname", { max: 32, min: 3, label: "a nickname", required: apply }));
  put(out, "strategy", text(body, "strategy", { max: 60, label: "a strategy name", required: apply }));
  put(out, "description", text(body, "description", { max: 1000, label: "a description", required: apply }));
  if (apply) out.program = oneOf(body, "program", PROGRAMS, "a programme", true);
  put(out, "perfFeePct", num(body, "perfFeePct", { min: 0, max: 100, label: "performance fee", required: apply }));
  put(out, "feePeriod", oneOf(body, "feePeriod", PERIODS, "a fee period", apply));
  put(out, "minAllocation", num(body, "minAllocation", { min: 0, max: 1e9, label: "minimum allocation" }));
  return out;
}

function fundBody(body: Obj, create: boolean): Obj {
  const out: Obj = {};
  put(out, "name", text(body, "name", { max: 40, min: 3, label: "a fund name", required: create }));
  put(out, "period", oneOf(body, "period", PERIODS, "a rollover period", create));
  put(out, "perfFeePct", num(body, "perfFeePct", { min: 0, max: 100, label: "performance fee", required: create }));
  put(out, "lockInDays", num(body, "lockInDays", { int: true, min: 0, max: 3650, label: "lock-in days", required: create }));
  put(out, "minInvestment", num(body, "minInvestment", { min: 0, max: 1e9, label: "minimum investment", required: create }));
  put(out, "maxDdPct", num(body, "maxDdPct", { min: 1, max: 99, label: "max drawdown", required: create }));
  if (create) out.seed = num(body, "seed", { min: 0.01, max: 1e9, label: "seed capital", required: true });
  return out;
}

async function readBody(req: NextRequest): Promise<Obj | NextResponse> {
  if (!sameOrigin(req)) return error(403, "forbidden", "Cross-site request blocked.");
  if (!req.headers.get("content-type")?.includes("application/json")) return error(415, "bad_request", "Expected JSON.");
  const body = (await req.json().catch(() => null)) as Obj | null;
  if (body === null || typeof body !== "object" || Array.isArray(body)) return error(400, "bad_request", "Invalid request body.");
  return body;
}

/* ------------------------------------------------------------------ */
/* GET                                                                 */
/* ------------------------------------------------------------------ */

const LB_QUERY: Record<string, readonly string[]> = {
  period: ["1m", "3m", "1y", "all"],
  program: ["all", "copy", "pamm"],
  sort: ["return", "dd", "aum", "followers", "age"],
  risk: ["all", "low", "med", "high"],
};

export async function GET(req: NextRequest, { params }: Ctx) {
  const path = (await params).path;
  const user = await auth(req);
  if (user instanceof NextResponse) return user;
  const [a, b, c] = path;
  const n = path.length;
  if (a === "mam") return mamGet(req, path, user);

  if (n === 1 && a === "leaderboard") {
    const sp = req.nextUrl.searchParams;
    const q = new URLSearchParams();
    for (const [k, allowed] of Object.entries(LB_QUERY)) {
      const v = sp.get(k);
      if (!v) continue;
      if (!allowed.includes(v)) return error(400, "bad_request", `Invalid ${k}.`);
      q.set(k, v);
    }
    const md = sp.get("minDays");
    if (md) {
      if (!/^\d{1,5}$/.test(md)) return error(400, "bad_request", "Invalid minDays.");
      q.set("minDays", md);
    }
    const qs = q.toString();
    const r = await socialEngine<{ items?: unknown[] }>(`/v1/social/leaderboard${qs ? `?${qs}` : ""}`, { user, req });
    if (r.status !== 200) return reply(r.status, r.data);
    return reply(200, { ...r.data, items: (r.data.items ?? []).map(publicMaster) });
  }

  if (n === 2 && a === "masters" && ID_RE.test(b!)) {
    const r = await socialEngine<Obj>(`/v1/social/masters/${b}`, { user, req });
    if (r.status !== 200) return reply(r.status, r.data);
    return reply(200, { ...r.data, master: publicMaster(r.data.master) });
  }

  if (n === 2 && a === "master" && b === "me") {
    const r = await socialEngine<Obj>("/v1/social/master/me", { user, req });
    if (r.status !== 200) return reply(r.status, r.data);
    return reply(200, { ...r.data, master: r.data.master ? ownMaster(r.data.master) : null });
  }

  if (n === 2 && a === "master" && b === "dashboard") {
    const r = await socialEngine<Obj & { fees?: unknown[] }>("/v1/social/master/dashboard", { user, req });
    if (r.status !== 200) return reply(r.status, r.data);
    return reply(200, { ...r.data, master: ownMaster(r.data.master), fees: (r.data.fees ?? []).map(clientFee) });
  }

  if (n === 1 && a === "subscriptions") {
    const r = await socialEngine("/v1/social/subscriptions", { user, req });
    return reply(r.status, r.data);
  }

  if (n === 2 && a === "subscriptions" && ID_RE.test(b!)) {
    const r = await socialEngine<Obj & { positions?: unknown[]; orders?: unknown[]; fees?: unknown[] }>(`/v1/social/subscriptions/${b}`, { user, req });
    if (r.status !== 200) return reply(r.status, r.data);
    return reply(200, {
      ...r.data,
      positions: (r.data.positions ?? []).map(clientPosition),
      orders: (r.data.orders ?? []).map(clientOrder),
      fees: (r.data.fees ?? []).map(clientFee),
    });
  }

  if (n === 1 && a === "funds") {
    const r = await socialEngine("/v1/social/funds", { user, req });
    return reply(r.status, r.data);
  }

  if (a === "funds" && ID_RE.test(b ?? "") && (n === 2 || (n === 3 && c === "statement"))) {
    const r = await socialEngine<Obj>(`/v1/social/funds/${b}${n === 3 ? "/statement" : ""}`, { user, req });
    if (r.status !== 200 || n === 3) return reply(r.status, r.data);
    return reply(200, { ...r.data, master: publicMaster(r.data.master) });
  }

  if (n === 1 && a === "investments") {
    const r = await socialEngine("/v1/social/investments", { user, req });
    return reply(r.status, r.data);
  }

  if (n === 1 && a === "symbols") {
    const r = await socialEngine<{ symbols?: Obj[] }>("/v1/symbols", { user, req });
    if (r.status !== 200) return reply(r.status, r.data);
    return reply(200, { symbols: (r.data.symbols ?? []).map((s) => ({ symbol: s.symbol, assetClass: s.assetClass ?? null })) });
  }

  return error(404, "not_found", "Not found.");
}

/* ------------------------------------------------------------------ */
/* POST                                                                */
/* ------------------------------------------------------------------ */

export async function POST(req: NextRequest, { params }: Ctx) {
  const path = (await params).path;
  const body = await readBody(req);
  if (body instanceof NextResponse) return body;
  const user = await auth(req);
  if (user instanceof NextResponse) return user;
  const [a, b, c] = path;
  const n = path.length;
  if (a === "mam") return mamPost(req, path, body, user);

  try {
    if (n === 2 && a === "master" && b === "apply") {
      const r = await socialEngine<Obj>("/v1/social/master/apply", { user, req, body: masterBody(body, true) });
      if (r.status !== 200) return reply(r.status, r.data);
      return reply(200, { ...r.data, master: ownMaster(r.data.master) });
    }

    if (n === 1 && a === "subscriptions") {
      const out: Obj = {
        masterId: num(body, "masterId", { int: true, min: 1, label: "a master", required: true }),
        sizing: sizing(body.sizing),
        allocation: num(body, "allocation", { min: 0.01, max: 1e9, label: "an allocation", required: true }),
      };
      limits(body, out, false);
      const r = await socialEngine("/v1/social/subscriptions", { user, req, body: out });
      return reply(r.status, r.data);
    }

    if (n === 3 && a === "subscriptions" && ID_RE.test(b!) && c === "stop") {
      if (body.returnFunds !== undefined && typeof body.returnFunds !== "boolean") throw new Invalid("Invalid returnFunds.");
      if (body.closePositions !== undefined && typeof body.closePositions !== "boolean") throw new Invalid("Invalid closePositions.");
      // both flags are always explicit for the engine: the balance goes back only when asked (the web sends
      // returnFunds: true when its box is ticked); copied positions close unless the client chose to keep them
      const out = { returnFunds: body.returnFunds === true, closePositions: body.closePositions !== false };
      const r = await socialEngine(`/v1/social/subscriptions/${b}/stop`, { user, req, body: out });
      return reply(r.status, r.data);
    }

    if (n === 1 && a === "funds") {
      const r = await socialEngine("/v1/social/funds", { user, req, body: fundBody(body, true) });
      return reply(r.status, r.data);
    }

    if (n === 3 && a === "funds" && ID_RE.test(b!) && c === "invest") {
      const out: Obj = { amount: num(body, "amount", { min: 0.01, max: 1e9, label: "an amount", required: true }) };
      put(out, "stopLossPct", num(body, "stopLossPct", { min: 1, max: 99, label: "stop-loss" }) ?? undefined);
      const r = await socialEngine(`/v1/social/funds/${b}/invest`, { user, req, body: out });
      return reply(r.status, r.data);
    }

    if (n === 3 && a === "funds" && ID_RE.test(b!) && c === "redeem") {
      let out: Obj;
      if (body.all === true) out = { all: true };
      else if (body.units !== undefined) out = { units: num(body, "units", { min: 1e-8, max: 1e12, label: "units", required: true }) };
      else if (body.amount !== undefined) out = { amount: num(body, "amount", { min: 0.01, max: 1e9, label: "an amount", required: true }) };
      else throw new Invalid("Choose how much to redeem.");
      const r = await socialEngine(`/v1/social/funds/${b}/redeem`, { user, req, body: out });
      return reply(r.status, r.data);
    }

    if (n === 3 && a === "requests" && ID_RE.test(b!) && c === "cancel") {
      const r = await socialEngine(`/v1/social/requests/${b}/cancel`, { user, req, body: {} });
      return reply(r.status, r.data);
    }
  } catch (e) {
    if (e instanceof Invalid) return error(422, "validation", e.message, e.field);
    throw e;
  }
  return error(404, "not_found", "Not found.");
}

/* ------------------------------------------------------------------ */
/* PATCH                                                               */
/* ------------------------------------------------------------------ */

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const path = (await params).path;
  const body = await readBody(req);
  if (body instanceof NextResponse) return body;
  const user = await auth(req);
  if (user instanceof NextResponse) return user;
  const [a, b] = path;
  const n = path.length;
  if (a === "mam") return mamPatch(req, path, body, user);

  try {
    if (n === 2 && a === "master" && b === "me") {
      const out = masterBody(body, false);
      if (!Object.keys(out).length) throw new Invalid("Nothing to update.");
      const r = await socialEngine<Obj>("/v1/social/master/me", { method: "PATCH", user, req, body: out });
      if (r.status !== 200) return reply(r.status, r.data);
      return reply(200, { ...r.data, master: ownMaster(r.data.master) });
    }

    if (n === 2 && a === "subscriptions" && ID_RE.test(b!)) {
      const out: Obj = {};
      if (body.sizing !== undefined) out.sizing = sizing(body.sizing);
      limits(body, out, true);
      if (body.paused !== undefined) {
        if (typeof body.paused !== "boolean") throw new Invalid("Invalid paused flag.");
        out.paused = body.paused;
      }
      if (!Object.keys(out).length) throw new Invalid("Nothing to update.");
      const r = await socialEngine(`/v1/social/subscriptions/${b}`, { method: "PATCH", user, req, body: out });
      return reply(r.status, r.data);
    }

    if (n === 2 && a === "funds" && ID_RE.test(b!)) {
      const out = fundBody(body, false);
      if (!Object.keys(out).length) throw new Invalid("Nothing to update.");
      const r = await socialEngine(`/v1/social/funds/${b}`, { method: "PATCH", user, req, body: out });
      return reply(r.status, r.data);
    }

    if (n === 2 && a === "investments" && ID_RE.test(b!)) {
      if (!("stopLossPct" in body)) throw new Invalid("Enter a stop-loss or clear it.");
      const sl = num(body, "stopLossPct", { min: 1, max: 99, label: "stop-loss", nullable: true });
      const r = await socialEngine(`/v1/social/investments/${b}`, { method: "PATCH", user, req, body: { stopLossPct: sl ?? null } });
      return reply(r.status, r.data);
    }
  } catch (e) {
    if (e instanceof Invalid) return error(422, "validation", e.message, e.field);
    throw e;
  }
  return error(404, "not_found", "Not found.");
}
