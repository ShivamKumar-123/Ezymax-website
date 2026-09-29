// MAM part of the Client Area social BFF (app/api/social/[...path]/route.ts hands every `mam/…` path here).
// Browser -> /api/social/mam/<route> -> engine /v1/social/mam/<route> with the signed-in user from the session
// cookie (never from the browser). Bodies are rebuilt from known, type-checked fields.
//
//   GET   mam/managers · mam/managers/{id}                 programmes, one programme with its terms + your accounts
//   GET   mam/links · mam/links/{id}                       your linked accounts, one link (MAM trades, log, fees, consent)
//   POST  mam/links                                        {managerId, login, termsHash, accept:true, maxLot?, equityStop?}
//   PATCH mam/links/{id}                                   {maxLot?, equityStop?} (null clears)
//   POST  mam/links/{id}/revoke                            {closePositions?}
//   GET   mam/manager · mam/manager/allocations            manager dashboard, allocation audit
//   GET   mam/manager/preview?symbol&volume                allocation preview
//   POST  mam/manager                                      {name, description?, method, perfFeePct, mgmtFeePct?, feePeriod, minEquity?, seed?}
//   PATCH mam/manager                                      {name?, description?, method?, perfFeePct?, mgmtFeePct?, feePeriod?, minEquity?}
//   PATCH mam/manager/links/{id}                           {value}

import { NextResponse, type NextRequest } from "next/server";
import type { GatewayUser } from "@/lib/gateway";
import { clientOrder, clientPosition } from "@/lib/trading";
import { socialEngine } from "@/lib/social";

type Obj = Record<string, unknown>;

const NO_STORE = { "cache-control": "no-store" };
const ID_RE = /^\d{1,12}$/;
const HASH_RE = /^[0-9a-f]{64}$/;
const SYMBOL_RE = /^[A-Z0-9._]{2,20}$/;
const PERIODS = ["daily", "weekly", "monthly"];
const METHODS = ["equity", "balance", "multiplier", "percent"];

class Invalid extends Error {
  constructor(
    message: string,
    public field?: string,
  ) {
    super(message);
  }
}

const reply = (status: number, data: unknown) => NextResponse.json(data, { status, headers: NO_STORE });
const error = (status: number, code: string, message: string, field?: string) => reply(status, { error: { code, message, ...(field ? { field } : {}) } });
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

function num(body: Obj, k: string, o: { min: number; max: number; label: string; required?: boolean; nullable?: boolean }): number | null | undefined {
  const v = body[k];
  if (v === undefined) {
    if (o.required) throw new Invalid(`Enter ${o.label}.`, k);
    return undefined;
  }
  if (v === null) {
    if (o.nullable) return null;
    throw new Invalid(`Enter ${o.label}.`, k);
  }
  if (!isNum(v) || v < o.min || v > o.max) throw new Invalid(`Invalid ${o.label}.`, k);
  return v;
}

function text(body: Obj, k: string, o: { min?: number; max: number; label: string; required?: boolean }): string | undefined {
  const v = body[k];
  if (v === undefined || v === null) {
    if (o.required) throw new Invalid(`Enter ${o.label}.`, k);
    return undefined;
  }
  if (typeof v !== "string") throw new Invalid(`Invalid ${o.label}.`, k);
  const s = v.trim();
  if (s.length < (o.min ?? 0)) throw new Invalid(`Enter ${o.label} (at least ${o.min} characters).`, k);
  if (s.length > o.max) throw new Invalid(`The ${o.label} is too long (max ${o.max} characters).`, k);
  return s;
}

function oneOf(body: Obj, k: string, values: string[], label: string, required = false): string | undefined {
  const v = body[k];
  if (v === undefined) {
    if (required) throw new Invalid(`Choose ${label}.`, k);
    return undefined;
  }
  if (typeof v !== "string" || !values.includes(v)) throw new Invalid(`Choose ${label}.`, k);
  return v;
}

function put(out: Obj, k: string, v: unknown) {
  if (v !== undefined) out[k] = v;
}

/** The manager sees linked accounts without the client's user id or consent details. */
function managerSafe(d: Obj): Obj {
  const links = Array.isArray(d.links) ? d.links.map((l) => {
    const { userId: _u, ...rest } = (l ?? {}) as Obj;
    return rest;
  }) : d.links;
  return { ...d, links };
}

function clientFee(f: unknown): unknown {
  if (!f || typeof f !== "object") return f;
  const { payerUserId: _p, reviewedBy: _r, ...rest } = f as Obj;
  return rest;
}

export async function mamGet(req: NextRequest, path: string[], user: GatewayUser): Promise<NextResponse> {
  const [, b, c] = path;
  const n = path.length;
  if (n === 2 && b === "managers") return fwd(await socialEngine("/v1/social/mam/managers", { user, req }));
  if (n === 3 && b === "managers" && ID_RE.test(c!)) return fwd(await socialEngine(`/v1/social/mam/managers/${c}`, { user, req }));
  if (n === 2 && b === "links") return fwd(await socialEngine("/v1/social/mam/links", { user, req }));
  if (n === 3 && b === "links" && ID_RE.test(c!)) {
    const r = await socialEngine<Obj & { positions?: unknown[]; orders?: unknown[]; fees?: unknown[] }>(`/v1/social/mam/links/${c}`, { user, req });
    if (r.status !== 200) return reply(r.status, r.data);
    return reply(200, { ...r.data, positions: (r.data.positions ?? []).map(clientPosition), orders: (r.data.orders ?? []).map(clientOrder), fees: (r.data.fees ?? []).map(clientFee) });
  }
  if (n === 2 && b === "manager") {
    const r = await socialEngine<Obj>("/v1/social/mam/manager", { user, req });
    return r.status === 200 ? reply(200, managerSafe(r.data)) : reply(r.status, r.data);
  }
  if (n === 3 && b === "manager" && c === "allocations") return fwd(await socialEngine("/v1/social/mam/manager/allocations?limit=200", { user, req }));
  if (n === 3 && b === "manager" && c === "preview") {
    const sp = req.nextUrl.searchParams;
    const symbol = (sp.get("symbol") ?? "EURUSD").toUpperCase();
    const volume = sp.get("volume") ?? "1";
    if (!SYMBOL_RE.test(symbol)) return error(400, "bad_request", "Invalid symbol.");
    if (!/^\d{1,4}(\.\d{1,2})?$/.test(volume) || Number(volume) <= 0) return error(400, "bad_request", "Invalid volume.");
    return fwd(await socialEngine(`/v1/social/mam/manager/preview?symbol=${symbol}&volume=${volume}`, { user, req }));
  }
  return error(404, "not_found", "Not found.");
}

export async function mamPost(req: NextRequest, path: string[], body: Obj, user: GatewayUser): Promise<NextResponse> {
  const [, b, c, d] = path;
  const n = path.length;
  try {
    if (n === 2 && b === "links") {
      if (body.accept !== true) throw new Invalid("Read and accept the terms to continue.", "accept");
      if (typeof body.termsHash !== "string" || !HASH_RE.test(body.termsHash)) throw new Invalid("Read and accept the terms to continue.", "termsHash");
      const out: Obj = {
        managerId: num(body, "managerId", { min: 1, max: 1e12, label: "a programme", required: true }),
        login: num(body, "login", { min: 1, max: 99_999_999, label: "an account", required: true }),
        termsHash: body.termsHash,
        accept: true,
      };
      put(out, "maxLot", num(body, "maxLot", { min: 0.01, max: 100, label: "max lot", nullable: true }) ?? undefined);
      put(out, "equityStop", num(body, "equityStop", { min: 0.01, max: 1e9, label: "equity stop", nullable: true }) ?? undefined);
      return fwd(await socialEngine("/v1/social/mam/links", { user, req, body: out }));
    }
    if (n === 4 && b === "links" && ID_RE.test(c!) && d === "revoke") {
      if (body.closePositions !== undefined && typeof body.closePositions !== "boolean") throw new Invalid("Invalid closePositions.");
      return fwd(await socialEngine(`/v1/social/mam/links/${c}/revoke`, { user, req, body: { closePositions: body.closePositions === true } }));
    }
    if (n === 2 && b === "manager") {
      const out: Obj = {
        name: text(body, "name", { min: 3, max: 60, label: "a programme name", required: true }),
        method: oneOf(body, "method", METHODS, "an allocation method", true),
        perfFeePct: num(body, "perfFeePct", { min: 0, max: 90, label: "the performance fee", required: true }),
        feePeriod: oneOf(body, "feePeriod", PERIODS, "a fee period", true),
      };
      put(out, "description", text(body, "description", { max: 1000, label: "description" }));
      put(out, "mgmtFeePct", num(body, "mgmtFeePct", { min: 0, max: 10, label: "the management fee" }) ?? undefined);
      put(out, "minEquity", num(body, "minEquity", { min: 0, max: 1e9, label: "the minimum equity" }) ?? undefined);
      put(out, "seed", num(body, "seed", { min: 0.01, max: 1e9, label: "the funding amount" }) ?? undefined);
      return fwd(await socialEngine("/v1/social/mam/manager", { user, req, body: out }));
    }
  } catch (e) {
    if (e instanceof Invalid) return error(422, "validation", e.message, e.field);
    throw e;
  }
  return error(404, "not_found", "Not found.");
}

export async function mamPatch(req: NextRequest, path: string[], body: Obj, user: GatewayUser): Promise<NextResponse> {
  const [, b, c, d] = path;
  const n = path.length;
  try {
    if (n === 3 && b === "links" && ID_RE.test(c!)) {
      const out: Obj = {};
      put(out, "maxLot", num(body, "maxLot", { min: 0.01, max: 100, label: "max lot", nullable: true }));
      put(out, "equityStop", num(body, "equityStop", { min: 0.01, max: 1e9, label: "equity stop", nullable: true }));
      if (!Object.keys(out).length) throw new Invalid("Nothing to update.");
      return fwd(await socialEngine(`/v1/social/mam/links/${c}`, { method: "PATCH", user, req, body: out }));
    }
    if (n === 2 && b === "manager") {
      const out: Obj = {};
      put(out, "name", text(body, "name", { min: 3, max: 60, label: "a programme name" }));
      put(out, "description", text(body, "description", { max: 1000, label: "description" }));
      put(out, "method", oneOf(body, "method", METHODS, "an allocation method"));
      put(out, "perfFeePct", num(body, "perfFeePct", { min: 0, max: 90, label: "the performance fee" }));
      put(out, "mgmtFeePct", num(body, "mgmtFeePct", { min: 0, max: 10, label: "the management fee" }));
      put(out, "feePeriod", oneOf(body, "feePeriod", PERIODS, "a fee period"));
      put(out, "minEquity", num(body, "minEquity", { min: 0, max: 1e9, label: "the minimum equity" }));
      if (!Object.keys(out).length) throw new Invalid("Nothing to update.");
      return fwd(await socialEngine("/v1/social/mam/manager", { method: "PATCH", user, req, body: out }));
    }
    if (n === 4 && b === "manager" && c === "links" && ID_RE.test(d!)) {
      const value = num(body, "value", { min: 0.01, max: 1000, label: "a value", required: true });
      return fwd(await socialEngine(`/v1/social/mam/manager/links/${d}`, { method: "PATCH", user, req, body: { value } }));
    }
  } catch (e) {
    if (e instanceof Invalid) return error(422, "validation", e.message, e.field);
    throw e;
  }
  return error(404, "not_found", "Not found.");
}

function fwd(r: { status: number; data: unknown }) {
  return reply(r.status, r.data);
}
