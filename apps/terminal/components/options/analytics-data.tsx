"use client";

// Data of the options workspace's Analytics tab. Live builds read the options service only (no made-up numbers):
//   smile           GET /api/options/smile?u=&expiry=  → {points[{strike, vol}], pillars[{callDelta, vol, strike}],
//                   termStructure[{tenor, days, atm, …}], atmVol} (the model smile at the listed strikes); the bid /
//                   ask and mark IVs come from the chain on screen (book: the IVs of the best bid / offer and mark)
//   term structure  the ATM vol of every open expiry: its smile's `atmVol` (guests: the ATM row of its public chain)
//   open interest   the chain rows' `oi` / `volume` (the order book's figures; absent on house prices)
// Demo builds compute the same shapes with the demo pricer (@ezymex/mock/options), like the rest of the workspace.
import * as React from "react";
import { IS_LIVE } from "@ezymex/mock";
import { OPTION_SPEC, forwardOf, pricingContext, quotesAt, smileAtDelta, volAtStrike } from "@ezymex/mock/options";
import { optionsApi } from "@/lib/options/api";
import { atmIndex, strikeAtCallDelta, type SmilePillar } from "@/lib/options/math";
import { expiryOpen, useOpt } from "@/lib/options-store";
import type { OptionChain, OptionExpiry, OptionQuote } from "@/lib/options/types";

type Obj = Record<string, unknown>;
const num = (v: unknown): number | undefined => (typeof v === "number" && Number.isFinite(v) ? v : typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v)) ? Number(v) : undefined);

/** Where the analytics come from: the demo pricer, the options service for a signed-in account, or public chains. */
export type AnalyticsSource = "demo" | "live" | "public";

export function useAnalyticsSource(): { source: AnalyticsSource; login: string | null } {
  const login = useOpt((s) => (s.ctx && !s.ctx.guest && !s.ctx.publicPage ? s.ctx.login : null));
  const publicView = useOpt((s) => s.publicView);
  if (!IS_LIVE) return { source: "demo", login };
  return { source: login && !publicView ? "live" : "public", login };
}

/* ------------------------------------------------------------------ */
/* Fetch (same contract as lib/options/api.ts: errors are values)      */
/* ------------------------------------------------------------------ */

async function getJson(path: string, login: string | null): Promise<Obj | null> {
  const headers: Record<string, string> = { "x-ezymex-errors": "body" };
  if (login) headers["x-ezymex-login"] = login;
  try {
    const res = await fetch(path, { headers, cache: "no-store", credentials: "same-origin", signal: AbortSignal.timeout(10_000) });
    const data = (await res.json().catch(() => null)) as Obj | null;
    if (!res.ok || !data || data.error) return null;
    return data;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* Smile                                                               */
/* ------------------------------------------------------------------ */

export interface SmilePoint {
  strike: number;
  vol: number;
}

export interface TermPillar {
  tenor: string;
  days: number;
  atm: number;
}

export interface SmileData {
  u: string;
  expiry: string;
  atmVol: number | null;
  /** the model smile at the listed strikes */
  points: SmilePoint[];
  /** 10 / 25-delta and ATM pillars of the smile (call delta, vol, strike) */
  pillars: SmilePillar[];
  /** the vol surface's ATM pillars (term structure of the surface) */
  term: TermPillar[];
}

function parseSmile(u: string, expiry: string, x: Obj): SmileData {
  const points = (Array.isArray(x.points) ? (x.points as Obj[]) : [])
    .map((p) => ({ strike: num(p?.strike) ?? NaN, vol: num(p?.vol) ?? NaN }))
    .filter((p) => p.strike > 0 && p.vol > 0)
    .sort((a, b) => a.strike - b.strike);
  const pillars = (Array.isArray(x.pillars) ? (x.pillars as Obj[]) : [])
    .map((p) => ({ callDelta: num(p?.callDelta) ?? NaN, vol: num(p?.vol) ?? NaN, strike: num(p?.strike) ?? NaN }))
    .filter((p) => p.callDelta > 0 && p.callDelta < 1 && p.vol > 0);
  const term = (Array.isArray(x.termStructure) ? (x.termStructure as Obj[]) : [])
    .map((p) => ({ tenor: String(p?.tenor ?? ""), days: num(p?.days) ?? NaN, atm: num(p?.atm) ?? NaN }))
    .filter((p) => p.days > 0 && p.atm > 0)
    .sort((a, b) => a.days - b.days);
  return { u, expiry: String(x.expiry ?? expiry), atmVol: num(x.atmVol) ?? null, points, pillars, term };
}

const TENORS: { tenor: string; days: number }[] = [
  { tenor: "ON", days: 1 },
  { tenor: "1W", days: 7 },
  { tenor: "2W", days: 14 },
  { tenor: "1M", days: 30 },
  { tenor: "2M", days: 61 },
  { tenor: "3M", days: 91 },
];
const PILLAR_DELTAS = [0.1, 0.25, 0.5, 0.75, 0.9];

/** The demo pricer's smile for a chain (demo builds). */
function demoSmile(chain: OptionChain, now = Date.now()): SmileData | null {
  const spec = OPTION_SPEC[chain.underlying];
  const spot = chain.spot?.mid;
  const cut = Date.parse(chain.cutAt);
  if (!spec || !spot || !(cut > now)) return null;
  const ctx = pricingContext(spec, spot, cut, now, 1);
  const fwd = forwardOf(ctx);
  return {
    u: chain.underlying,
    expiry: chain.expiry,
    atmVol: ctx.quotes.atm,
    points: chain.rows.map((r) => ({ strike: r.strike, vol: volAtStrike(ctx, r.strike) })),
    pillars: PILLAR_DELTAS.map((d) => {
      const vol = smileAtDelta(ctx.quotes, d);
      return { callDelta: d, vol, strike: strikeAtCallDelta(fwd, d, vol, ctx.tVol) };
    }),
    term: TENORS.map((x, i) => ({ ...x, atm: spec.atm[i]! })),
  };
}

/** The model IV of a quote: the book's theo IV, else the house quote's IV. */
export const modelIv = (q: OptionQuote | null | undefined): number | null => {
  const v = q ? (q.book ? (q.theoIv ?? q.iv) : q.iv) : null;
  return v !== null && v !== undefined && v > 0 ? v : null;
};

/** The chain's own smile (the model IV of the out-of-the-money side): guests, and while the smile route is down. */
function chainSmile(chain: OptionChain): SmileData | null {
  const ref = chain.atmStrike ?? chain.spot?.mid;
  const points: SmilePoint[] = [];
  for (const r of chain.rows) {
    const otm = ref !== undefined && r.strike < ref ? r.put : r.call;
    const v = modelIv(otm) ?? modelIv(r.call) ?? modelIv(r.put);
    if (v) points.push({ strike: r.strike, vol: v });
  }
  if (!points.length) return null;
  const atmRow = chain.rows[atmIndex(chain)];
  return { u: chain.underlying, expiry: chain.expiry, atmVol: modelIv(atmRow?.call) ?? modelIv(atmRow?.put), points, pillars: [], term: [] };
}

const smileCache = new Map<string, { at: number; data: SmileData | null; atm: number | null }>();
const smileFlight = new Map<string, Promise<{ data: SmileData | null; atm: number | null }>>();
const SMILE_TTL = 20_000;

/** One expiry's smile from the options service, shared by the smile chart and the term structure (in-flight deduped). */
function fetchSmile(login: string | null, u: string, expiry: string, ttl = SMILE_TTL): Promise<{ data: SmileData | null; atm: number | null }> {
  const key = `${login}|${u}|${expiry}`;
  const c = smileCache.get(key);
  if (c && Date.now() - c.at < ttl) return Promise.resolve(c);
  const flying = smileFlight.get(key);
  if (flying) return flying;
  const p = getJson(`/api/options/smile?u=${encodeURIComponent(u)}&expiry=${expiry}`, login).then((r) => {
    const v = { data: r ? parseSmile(u, expiry, r) : null, atm: r ? (num(r.atmVol) ?? null) : null };
    smileCache.set(key, { at: Date.now(), ...v });
    smileFlight.delete(key);
    return v;
  });
  smileFlight.set(key, p);
  return p;
}

/** The smile of the expiry on screen (refreshed every 20 s while mounted in live builds). */
export function useSmile(chain: OptionChain | null): { data: SmileData | null; loading: boolean } {
  const { source, login } = useAnalyticsSource();
  const key = chain ? `${chain.underlying}|${chain.expiry}` : "";
  const [live, setLive] = React.useState<{ key: string; data: SmileData | null } | null>(() => {
    const c = smileCache.get(`${login}|${key}`);
    return c ? { key, data: c.data } : null;
  });
  React.useEffect(() => {
    if (source !== "live" || !key) return;
    const [u, expiry] = key.split("|") as [string, string];
    let gone = false;
    const load = async () => {
      const { data } = await fetchSmile(login, u, expiry);
      if (!gone) setLive({ key, data });
    };
    void load();
    const id = setInterval(() => document.visibilityState !== "hidden" && void load(), SMILE_TTL);
    return () => {
      gone = true;
      clearInterval(id);
    };
  }, [source, login, key]);

  // demo: the pricer's smile, recomputed when the spot moves by a pip or so
  const spotKey = chain?.spot?.mid ? chain.spot.mid.toPrecision(6) : "";
  const demo = React.useMemo(() => (source === "demo" && chain ? demoSmile(chain) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [source, key, spotKey, chain?.rows.length],
  );
  const fromChain = React.useMemo(() => (chain ? chainSmile(chain) : null), [chain]);

  if (!chain) return { data: null, loading: true };
  if (source === "demo") return { data: demo ?? fromChain, loading: false };
  if (source === "public") return { data: fromChain, loading: false };
  const mine = live && live.key === key ? live : null;
  // the smile route answered nothing (no price, service down): the chain's IVs still draw the smile
  if (mine && !mine.data?.points.length) return { data: fromChain ? { ...fromChain, term: mine.data?.term ?? [], pillars: mine.data?.pillars ?? [] } : mine.data, loading: false };
  return { data: mine?.data ?? null, loading: !mine };
}

/* ------------------------------------------------------------------ */
/* Term structure: ATM vol of every open expiry                        */
/* ------------------------------------------------------------------ */

export interface TermPoint {
  date: string;
  cutAt: string;
  /** calendar days to the cut (fractional) */
  days: number;
  atm: number;
}

const atmCache = new Map<string, { at: number; v: number | null }>();
const atmFlight = new Map<string, Promise<number | null>>();
const TERM_TTL = 60_000;

async function atmOf(source: AnalyticsSource, login: string | null, u: string, e: OptionExpiry): Promise<number | null> {
  const key = `${source}|${login}|${u}|${e.date}`;
  const c = atmCache.get(key);
  if (c && Date.now() - c.at < TERM_TTL) return c.v;
  const flying = atmFlight.get(key);
  if (flying) return flying;
  const p = (async () => {
    let v: number | null = null;
    if (source === "live") {
      // the smile of the expiry on screen is shared with the smile chart
      v = (await fetchSmile(login, u, e.date, TERM_TTL)).atm;
    } else {
      const r = await optionsApi.publicChain(u, e.date);
      if (r.ok && r.data.rows?.length) {
        const row = r.data.rows[atmIndex(r.data)];
        const ivs = [row?.call, row?.put].map((q) => (q ? (num((q as unknown as Obj).theoIv) ?? q.iv) : null)).filter((x): x is number => !!x && x > 0);
        v = ivs.length ? ivs.reduce((a, b) => a + b, 0) / ivs.length : null;
      }
    }
    atmCache.set(key, { at: Date.now(), v });
    atmFlight.delete(key);
    return v;
  })();
  atmFlight.set(key, p);
  return p;
}

/** ATM IV of every open expiry of the underlying (live: their smiles, 3 at a time; demo: the pricer). */
export function useTermStructure(u: string, expiries: OptionExpiry[]): { points: TermPoint[]; loading: boolean } {
  const { source, login } = useAnalyticsSource();
  const open = React.useMemo(() => expiries.filter((e) => expiryOpen(e)).sort((a, b) => Date.parse(a.cutAt) - Date.parse(b.cutAt)), [expiries]);
  const listKey = `${u}|${open.map((e) => e.date).join(",")}`;
  const [state, setState] = React.useState<{ key: string; points: TermPoint[]; done: boolean }>({ key: "", points: [], done: false });

  React.useEffect(() => {
    if (!open.length) return void setState({ key: listKey, points: [], done: true });
    let gone = false;
    const load = async () => {
      const now = Date.now();
      const days = (e: OptionExpiry) => Math.max(1 / 24, (Date.parse(e.cutAt) - now) / 86_400_000);
      if (source === "demo") {
        const spec = OPTION_SPEC[u];
        const points = spec ? open.map((e) => ({ date: e.date, cutAt: e.cutAt, days: days(e), atm: quotesAt(spec, days(e)).atm })) : [];
        if (!gone) setState({ key: listKey, points, done: true });
        return;
      }
      const out: (TermPoint | null)[] = open.map(() => null);
      let i = 0;
      const worker = async () => {
        while (i < open.length && !gone) {
          const k = i++;
          const e = open[k]!;
          const v = await atmOf(source, login, u, e);
          if (v) out[k] = { date: e.date, cutAt: e.cutAt, days: days(e), atm: v };
          if (!gone) setState({ key: listKey, points: out.filter((x): x is TermPoint => !!x), done: false });
        }
      };
      await Promise.all([worker(), worker(), worker()]);
      if (!gone) setState({ key: listKey, points: out.filter((x): x is TermPoint => !!x), done: true });
    };
    void load();
    const id = setInterval(() => document.visibilityState !== "hidden" && void load(), TERM_TTL);
    return () => {
      gone = true;
      clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, login, listKey]);

  const mine = state.key === listKey ? state : null;
  return { points: mine?.points ?? [], loading: !mine?.done };
}

/* ------------------------------------------------------------------ */
/* Open interest & volume (order book)                                 */
/* ------------------------------------------------------------------ */

export interface OiRow {
  strike: number;
  strikeLabel: string;
  callOi: number;
  putOi: number;
  callVol: number;
  putVol: number;
}

export interface OiData {
  /** the chain carries open interest (the order book is live for it) */
  available: boolean;
  rows: OiRow[];
  calls: { oi: number; volume: number };
  puts: { oi: number; volume: number };
}

/** Open interest and today's volume per strike of the chain on screen (null fields = the book doesn't report them). */
export function oiOf(chain: OptionChain | null): OiData {
  const rows: OiRow[] = [];
  let available = false;
  const calls = { oi: 0, volume: 0 };
  const puts = { oi: 0, volume: 0 };
  for (const r of chain?.rows ?? []) {
    const c = r.call;
    const p = r.put;
    if ((c?.oi ?? null) !== null || (p?.oi ?? null) !== null || (c?.volume ?? null) !== null || (p?.volume ?? null) !== null) available = true;
    const row = { strike: r.strike, strikeLabel: r.strikeLabel, callOi: Math.max(0, c?.oi ?? 0), putOi: Math.max(0, p?.oi ?? 0), callVol: Math.max(0, c?.volume ?? 0), putVol: Math.max(0, p?.volume ?? 0) };
    calls.oi += row.callOi;
    calls.volume += row.callVol;
    puts.oi += row.putOi;
    puts.volume += row.putVol;
    rows.push(row);
  }
  return { available: available && !!chain?.book?.active, rows, calls, puts };
}
