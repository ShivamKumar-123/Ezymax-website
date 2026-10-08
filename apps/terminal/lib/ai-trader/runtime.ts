/**
 * AI Trader runtime. Holds the current account's strategies (persisted in localStorage), runs the
 * active ones on closed bars and routes orders through the terminal store (the same path as manual
 * orders, tagged source "ai"; in live builds they go to the trading engine). SL / TP / trailing of live
 * orders are executed server-side by the engine; this runtime adds breakeven, rule exits, session
 * close-outs, daily limits and a paper (dry-run) mode with virtual positions.
 *
 * It runs inside the browser tab: strategies only execute while the terminal is open.
 */
import { getInstrument, isMarketOpen, priceFeed, serverOffset, type Candle, type Quote } from "@ezymex/mock";
import type { JournalLine, OrderRequest } from "../store";
import { fmtPrice, fmtVol, pipSize, pointSize, profitAt, quoteToUsd, roundPrice, type TClosed, type TPosition } from "../trading";
import { acquireSeries, releaseSeries, type BarSeries } from "./data";
import { describeCondition } from "./describe";
import { atr, evalRuleSet, type RuleEval } from "./series";
import { hasRules, validateSpec, type Condition, type Distance, type ParseResult, type RuleSet, type StrategySpec } from "./schema";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export interface TradingApi {
  login: string;
  accountType: "demo" | "live";
  accountMode: "hedging" | "netting";
  investor: boolean;
  positions: () => TPosition[];
  history: () => TClosed[];
  balance: () => number;
  /** Resolves when the trade server answered; `ticket` = the opened position (market) when known. */
  placeOrder: (o: OrderRequest) => Promise<{ ok: boolean; ticket?: string }>;
  modifyPosition: (ticket: string, patch: { sl?: number | null; tp?: number | null; trailing?: number | null }) => Promise<boolean>;
  /** False when the close was rejected (e.g. the symbol's market is closed). */
  closePosition: (ticket: string, reason: string) => Promise<boolean>;
  log: (src: JournalLine["src"], text: string, level?: JournalLine["level"]) => void;
}

export type StrategyStatus = "draft" | "active" | "paused" | "stopped";
export type RunMode = "paper" | "live";
export type LogKind = "eval" | "signal" | "order" | "manage" | "close" | "error" | "info";

export interface LogEntry {
  ts: number;
  kind: LogKind;
  text: string;
}

export interface PaperPos {
  id: string;
  side: "buy" | "sell";
  volume: number;
  open: number;
  sl?: number;
  tp?: number;
  trailing?: number;
  beDone: boolean;
  openTime: number;
}

export interface StrategyRecord {
  id: string;
  spec: StrategySpec;
  prompt: string;
  origin: "claude" | "local" | "manual";
  questions: string[];
  assumptions: string[];
  status: StrategyStatus;
  mode: RunMode;
  paperRuns: number;
  createdAt: number;
  updatedAt: number;
  activatedAt?: number;
  day: string;
  tradesToday: number;
  dayRealized: number;
  realized: number;
  trades: number;
  wins: number;
  openTickets: string[];
  counted: string[];
  beDone: string[];
  paper: PaperPos[];
  lastEval?: number;
  log: LogEntry[];
}

export interface EngineInfo {
  status: "loading" | "ready" | "error";
  source: "history" | "quotes";
  bars: number;
  lastBar?: number;
  nextClose?: number;
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const STORE_KEY = (login: string) => `ezymex.terminal.ai.v1.${login}`;
const LOG_CAP = 400;
const newId = () => Array.from({ length: 5 }, () => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[Math.floor(Math.random() * 31)]).join("");

export const aiComment = (r: Pick<StrategyRecord, "id" | "spec">) => `AI ${r.id} ${r.spec.name}`.slice(0, 31);
export const isAiOf = (p: { source: string; comment?: string }, id: string) => p.source === "ai" && !!p.comment?.startsWith(`AI ${id}`);

function serverParts(ms = Date.now()) {
  const sec = Math.floor(ms / 1000);
  const d = new Date((sec + serverOffset(sec)) * 1000);
  return { day: d.toISOString().slice(0, 10), weekday: d.getUTCDay(), minutes: d.getUTCHours() * 60 + d.getUTCMinutes(), hhmm: d.toISOString().slice(11, 16) };
}
export const serverHHMM = (unixSec: number) => new Date((unixSec + serverOffset(unixSec)) * 1000).toISOString().slice(11, 16);

export function inSession(spec: StrategySpec, ms = Date.now()) {
  const s = serverParts(ms);
  if (spec.days.length && !spec.days.includes(s.weekday)) return false;
  if (!spec.sessions.length) return true;
  const toMin = (h: string) => +h.slice(0, 2) * 60 + +h.slice(3, 5);
  return spec.sessions.some((w) => {
    const a = toMin(w.start);
    const b = toMin(w.end);
    return a <= b ? s.minutes >= a && s.minutes < b : s.minutes >= a || s.minutes < b;
  });
}

/** Null when the symbol can trade now, else the reason. */
export function marketClosedReason(symbol: string): string | null {
  const feed = priceFeed();
  const q = feed.snapshot(symbol);
  if (!q || !(q.bid > 0)) return "no quotes";
  // same session rules as the manual order path and the market-data service (crypto 24/7, stocks US session, rest Mon–Fri)
  if (!isMarketOpen(symbol)) return "market closed";
  if (feed.mode === "live" && Date.now() - q.time > 10 * 60_000) return "market closed (no quotes for 10 min)";
  return null;
}

function fmtCond(d: RuleEval["details"][number], symbol: string) {
  const f = (v: number, c: Condition["left"]) => (!Number.isFinite(v) ? "n/a" : c.kind === "price" || (c.kind === "indicator" && /^(sma|ema|bb_|highest|lowest)/.test(c.indicator)) ? fmtPrice(symbol, v) : c.kind === "candle" ? (v ? "yes" : "no") : String(+v.toFixed(2)));
  const txt = describeCondition(d.cond);
  if (d.cond.left.kind === "candle") return `${txt}: ${d.res.ok ? "yes" : "no"}`;
  const vals = `${f(d.res.left, d.cond.left)}${d.cond.right.kind === "value" ? "" : ` vs ${f(d.res.right, d.cond.right)}`}`;
  return `${txt} [${vals}] ${d.res.ready ? (d.res.ok ? "yes" : "no") : "warming up"}`;
}

/* ------------------------------------------------------------------ */
/* Engine: one per running strategy                                    */
/* ------------------------------------------------------------------ */

class Engine {
  private main: BarSeries;
  private extra = new Map<string, BarSeries>();
  private unsubs: (() => void)[] = [];
  private timer: ReturnType<typeof setInterval>;
  private warm = false;
  private lastIntrabar = 0;
  private knownSl = new Map<string, number | undefined>();
  private lastTrailLog = new Map<string, number>();
  private closing = false;

  constructor(
    private rt: AiTraderRuntime,
    readonly id: string,
  ) {
    const spec = this.rec.spec;
    this.main = acquireSeries(spec.symbol, spec.timeframe);
    for (const rs of [spec.long, spec.short, spec.exitLong, spec.exitShort])
      for (const g of rs.groups)
        for (const c of g.conditions) if (c.timeframe !== "same" && c.timeframe !== spec.timeframe && !this.extra.has(c.timeframe)) this.extra.set(c.timeframe, acquireSeries(spec.symbol, c.timeframe));
    this.unsubs.push(this.main.onClose((bar) => this.evaluate(bar, false)));
    this.unsubs.push(priceFeed().subscribe([spec.symbol], (q) => this.onQuote(q)));
    this.timer = setInterval(() => this.everySecond(), 1000);
    for (const p of this.rt.api?.positions() ?? []) if (this.rec.openTickets.includes(p.ticket)) this.knownSl.set(p.ticket, p.sl);
  }

  get rec() {
    return this.rt.get(this.id)!;
  }

  info(): EngineInfo {
    const last = this.main.bars[this.main.bars.length - 1];
    const step = { M1: 60, M5: 300, M15: 900, M30: 1800, H1: 3600, H4: 14400, D1: 86400, W1: 604800, MN: 2592000 }[this.rec.spec.timeframe];
    return { status: this.main.status, source: this.main.source, bars: this.main.closedBars().length, lastBar: last?.time, nextClose: last ? last.time + step : undefined };
  }

  dispose() {
    this.unsubs.forEach((u) => u());
    clearInterval(this.timer);
    releaseSeries(this.main);
    this.extra.forEach((s) => releaseSeries(s));
  }

  private seriesFor = (cache: Map<string, Map<string, number[]>>, bars: Candle[], intrabar: boolean) => (c: Condition) => {
    const tf = c.timeframe === "same" ? this.rec.spec.timeframe : c.timeframe;
    const src = tf === this.rec.spec.timeframe ? bars : (() => {
      const s = this.extra.get(tf);
      return s ? (intrabar ? s.bars : s.closedBars()) : [];
    })();
    if (src.length < 2) return null;
    let cc = cache.get(tf);
    if (!cc) cache.set(tf, (cc = new Map()));
    return { bars: src, i: src.length - 1, cache: cc };
  };

  private everySecond() {
    const rec = this.rec;
    if (!rec) return;
    this.rt.rollDay(this.id);
    // initial (warm-up) evaluation once history is in
    if (!this.warm && this.main.status !== "loading" && [...this.extra.values()].every((s) => s.status !== "loading")) {
      this.warm = true;
      const bars = this.main.closedBars();
      if (bars.length) this.evaluate(bars[bars.length - 1]!, true);
      else this.rt.logFor(this.id, "error", `No history for ${rec.spec.symbol} ${rec.spec.timeframe} yet; waiting for live bars`, "warn");
    }
    if (rec.mode === "live") this.rt.syncLive(this.id);
    // close outside session
    if (rec.spec.closeOutsideSession && rec.status === "active" && !inSession(rec.spec) && this.openCount() > 0 && !this.closing) {
      this.rt.logFor(this.id, "close", "Outside trading window: closing open positions");
      this.closing = true;
      void this.rt.closeAllOf(this.id, "ai session end").finally(() => (this.closing = false));
    }
  }

  private openCount() {
    const rec = this.rec;
    return rec.mode === "paper" ? rec.paper.length : rec.openTickets.length;
  }

  /* ------------------------------ bar close ------------------------------ */

  evaluate(bar: Candle, warmup: boolean) {
    const rec = this.rec;
    if (!rec || (rec.status !== "active" && !warmup)) return;
    const spec = rec.spec;
    const bars = this.main.closedBars();
    if (bars.length < 3) return this.rt.logFor(this.id, "error", `Not enough ${spec.timeframe} history to evaluate (${bars.length} bars)`, "warn");
    const cache = new Map<string, Map<string, number[]>>();
    const sf = this.seriesFor(cache, bars, false);
    const L = hasRules(spec.long) ? evalRuleSet(spec.long, sf) : null;
    const S = hasRules(spec.short) ? evalRuleSet(spec.short, sf) : null;
    const XL = hasRules(spec.exitLong) ? evalRuleSet(spec.exitLong, sf) : null;
    const XS = hasRules(spec.exitShort) ? evalRuleSet(spec.exitShort, sf) : null;
    const parts: string[] = [];
    if (L) parts.push(`BUY ${L.ok ? "YES" : "no"}: ${L.details.map((d) => fmtCond(d, spec.symbol)).join("; ")}`);
    if (S) parts.push(`SELL ${S.ok ? "YES" : "no"}: ${S.details.map((d) => fmtCond(d, spec.symbol)).join("; ")}`);
    this.rt.patch(this.id, { lastEval: Date.now() });
    this.rt.logFor(this.id, "eval", `${spec.timeframe} bar ${serverHHMM(bar.time)} closed at ${fmtPrice(spec.symbol, bar.close)} · ${parts.join(" | ")}${warmup ? " · warm-up, orders start from the next closed bar" : ""}`);
    if (warmup || rec.status !== "active") return;

    // rule exits
    if (XL?.ok) this.exitSide("buy", "exit rule");
    if (XS?.ok) this.exitSide("sell", "exit rule");

    const wantBuy = !!L?.ok;
    const wantSell = !!S?.ok;
    if (!wantBuy && !wantSell) return;
    if (wantBuy && wantSell) return this.rt.logFor(this.id, "signal", "Buy and sell rules both true on the same bar: skipped", "warn");
    void this.enter(wantBuy ? "buy" : "sell", bars);
  }

  private exitSide(side: "buy" | "sell", why: string) {
    const rec = this.rec;
    if (rec.mode === "paper") {
      for (const p of rec.paper.filter((x) => x.side === side)) this.rt.closePaper(this.id, p.id, undefined, why);
    } else {
      const api = this.rt.api;
      if (!api) return;
      for (const p of api.positions().filter((x) => rec.openTickets.includes(x.ticket) && x.side === side)) {
        this.rt.logFor(this.id, "close", `${why}: closing #${p.ticket} ${p.side} ${fmtVol(p.volume)} ${p.symbol}`);
        void api.closePosition(p.ticket, "ai exit").then((ok) => {
          if (!ok) this.rt.logFor(this.id, "error", `Could not close #${p.ticket} ${p.symbol} (see Journal for the reason); position left open with its SL/TP`, "warn");
          this.rt.syncLive(this.id);
        });
      }
      this.rt.syncLive(this.id);
    }
  }

  private async enter(side: "buy" | "sell", bars: Candle[]) {
    const rt = this.rt;
    const rec = this.rec;
    const spec = rec.spec;
    const api = rt.api;
    const skip = (why: string, level: JournalLine["level"] = "info") => rt.logFor(this.id, "signal", `${side.toUpperCase()} signal skipped: ${why}`, level);
    if (!api) return skip("terminal not connected", "warn");
    if (rec.mode === "live" && api.investor) return skip("investor (read-only) session", "warn");
    const closed = marketClosedReason(spec.symbol);
    if (closed) return skip(closed);
    if (!inSession(spec)) return skip("outside trading window");
    if (spec.maxTradesPerDay > 0 && rec.tradesToday >= spec.maxTradesPerDay) return skip(`daily limit of ${spec.maxTradesPerDay} trades reached`);
    if (spec.maxDailyLoss > 0) {
      const today = rec.dayRealized + rt.floating(this.id);
      if (today <= -spec.maxDailyLoss) return skip(`max daily loss reached (${today.toFixed(2)})`, "warn");
    }
    if (spec.oneAtATime && this.openCount() > 0) return skip("a position is already open (one at a time)");
    if (rec.mode === "live" && api.accountMode === "netting") {
      const other = api.positions().find((p) => p.login === api.login && p.symbol === spec.symbol && !isAiOf(p, rec.id));
      if (other) return skip(`netting account already holds #${other.ticket} on ${spec.symbol} (not this strategy)`, "warn");
    }

    const q = priceFeed().snapshot(spec.symbol)!;
    const entry = side === "buy" ? q.ask : q.bid;
    const atrAt = (n: number) => {
      const a = atr(bars, n);
      return a[a.length - 1] ?? NaN;
    };
    const dist = (d: Distance, slDist?: number): number | null => {
      const pt = pointSize(spec.symbol);
      switch (d.mode) {
        case "none":
          return null;
        case "points":
          return d.value * pt;
        case "pips":
          return d.value * pipSize(getInstrument(spec.symbol));
        case "price":
          return d.value;
        case "percent":
          return (entry * d.value) / 100;
        case "atr":
          return d.value * atrAt(d.atrPeriod);
        case "level":
          return Math.abs(entry - d.value);
        case "rr":
          return slDist !== undefined ? d.value * slDist : null;
      }
    };
    const slD = dist(spec.sl);
    const tpD = dist(spec.tp, slD ?? undefined);
    if (slD !== null && !(slD > 0)) return skip("stop distance could not be computed (ATR warming up?)", "error");
    if (tpD !== null && !(tpD > 0)) return skip("take-profit distance could not be computed", "error");
    if (spec.sl.mode === "level" && (side === "buy" ? spec.sl.value >= entry : spec.sl.value <= entry)) return skip(`SL level ${spec.sl.value} is on the wrong side of the price`, "error");
    if (spec.tp.mode === "level" && (side === "buy" ? spec.tp.value <= entry : spec.tp.value >= entry)) return skip(`TP level ${spec.tp.value} is on the wrong side of the price`, "error");
    const dir = side === "buy" ? 1 : -1;
    const sl = slD !== null ? roundPrice(spec.symbol, entry - dir * slD) : undefined;
    const tp = tpD !== null ? roundPrice(spec.symbol, entry + dir * tpD) : undefined;

    // volume
    let vol = spec.sizing.lots;
    if (spec.sizing.mode === "risk") {
      if (slD === null) return skip("risk sizing needs a stop loss", "error");
      const riskUsd = (api.balance() * spec.sizing.riskPct) / 100;
      const perLot = slD * getInstrument(spec.symbol).contractSize * quoteToUsd(spec.symbol, entry);
      vol = Math.floor((riskUsd / perLot) * 100) / 100;
      if (vol < 0.01) return skip(`risk ${spec.sizing.riskPct}% is below the minimum 0.01 lot for this stop`, "warn");
    }
    if (vol > spec.maxLots) {
      rt.logFor(this.id, "signal", `Volume ${fmtVol(vol)} capped at ${fmtVol(spec.maxLots)} lot`, "warn");
      vol = spec.maxLots;
    }
    vol = +vol.toFixed(2);

    // trailing (price distance)
    const t = spec.trailing;
    const trailing = t.mode === "points" ? t.value * pointSize(spec.symbol) : t.mode === "pips" ? t.value * pipSize(getInstrument(spec.symbol)) : t.mode === "atr" ? t.value * atrAt(t.atrPeriod) : undefined;
    const trail = trailing && trailing > 0 ? trailing : undefined;

    const desc = `${side.toUpperCase()} ${fmtVol(vol)} ${spec.symbol} at ~${fmtPrice(spec.symbol, entry)}${sl !== undefined ? ` SL ${fmtPrice(spec.symbol, sl)}` : ""}${tp !== undefined ? ` TP ${fmtPrice(spec.symbol, tp)}` : ""}${trail ? ` trailing ${Math.round(trail / pointSize(spec.symbol))} pts` : ""}`;
    if (rec.mode === "paper") {
      const p: PaperPos = { id: newId(), side, volume: vol, open: entry, sl, tp, trailing: trail, beDone: false, openTime: Date.now() };
      rt.patch(this.id, (r) => ({ paper: [...r.paper, p], tradesToday: r.tradesToday + 1 }));
      rt.logFor(this.id, "order", `PAPER ${desc} (no order sent)`);
      return;
    }
    rt.logFor(this.id, "signal", `${side.toUpperCase()} signal: sending market order ${desc}`);
    const comment = aiComment(rec);
    const before = new Set(api.positions().map((p) => `${p.ticket}|${p.volume}`));
    const res = await api.placeOrder({ symbol: spec.symbol, side, type: "market", volume: vol, sl, tp, trailing: trail, comment, source: "ai" });
    if (!res.ok) return rt.logFor(this.id, "error", `Order rejected: ${desc} (see Journal for the reason)`, "error");
    // the trade server names the new position; the stream may deliver it a moment after the answer
    const pos = api.positions().find((p) => (res.ticket ? p.ticket === res.ticket : p.login === api.login && isAiOf(p, rec.id) && !before.has(`${p.ticket}|${p.volume}`)));
    const ticket = pos?.ticket ?? res.ticket;
    rt.patch(this.id, (r) => ({ tradesToday: r.tradesToday + 1, openTickets: ticket && !r.openTickets.includes(ticket) ? [...r.openTickets, ticket] : r.openTickets }));
    if (pos) this.knownSl.set(pos.ticket, pos.sl);
    rt.logFor(this.id, "order", pos ? `Filled #${pos.ticket} ${pos.side} ${fmtVol(pos.volume)} ${pos.symbol} at ${fmtPrice(pos.symbol, pos.openPrice)}${pos.sl !== undefined ? ` SL ${fmtPrice(pos.symbol, pos.sl)}` : ""}${pos.tp !== undefined ? ` TP ${fmtPrice(pos.symbol, pos.tp)}` : ""}` : ticket ? `Filled #${ticket}` : "Order accepted");
  }

  /* ------------------------------ ticks ------------------------------ */

  private onQuote(q: Quote) {
    const rec = this.rec;
    if (!rec || rec.status === "draft" || rec.status === "stopped") return;
    const spec = rec.spec;
    const pt = pointSize(spec.symbol);
    const be = spec.trailing.breakevenTrigger;
    if (rec.mode === "paper") {
      for (const p of rec.paper) {
        const px = p.side === "buy" ? q.bid : q.ask;
        if (p.sl !== undefined && (p.side === "buy" ? px <= p.sl : px >= p.sl)) {
          this.rt.closePaper(this.id, p.id, p.sl, "SL");
          continue;
        }
        if (p.tp !== undefined && (p.side === "buy" ? px >= p.tp : px <= p.tp)) {
          this.rt.closePaper(this.id, p.id, p.tp, "TP");
          continue;
        }
        let sl = p.sl;
        let why = "";
        if (be > 0 && !p.beDone && (p.side === "buy" ? px - p.open : p.open - px) >= be * pt) {
          const cand = roundPrice(spec.symbol, p.open + (p.side === "buy" ? 1 : -1) * spec.trailing.breakevenOffset * pt);
          if (sl === undefined || (p.side === "buy" ? cand > sl : cand < sl)) {
            sl = cand;
            why = "breakeven";
          }
          this.rt.patchPaper(this.id, p.id, { beDone: true });
        }
        if (p.trailing) {
          const cand = roundPrice(spec.symbol, p.side === "buy" ? px - p.trailing : px + p.trailing);
          const inProfit = p.side === "buy" ? px - p.open >= p.trailing : p.open - px >= p.trailing;
          if (inProfit && (sl === undefined || (p.side === "buy" ? cand > sl : cand < sl))) {
            sl = cand;
            why = "trailing";
          }
        }
        if (sl !== p.sl) {
          this.rt.patchPaper(this.id, p.id, { sl });
          if (why === "breakeven" || Date.now() - (this.lastTrailLog.get(p.id) ?? 0) > 3000) {
            this.lastTrailLog.set(p.id, Date.now());
            this.rt.logFor(this.id, "manage", `PAPER ${why} stop moved to ${fmtPrice(spec.symbol, sl!)}`);
          }
        }
      }
    } else if (this.rt.api) {
      const api = this.rt.api;
      for (const p of api.positions()) {
        if (!rec.openTickets.includes(p.ticket)) continue;
        const px = p.side === "buy" ? q.bid : q.ask;
        if (be > 0 && !rec.beDone.includes(p.ticket) && (p.side === "buy" ? px - p.openPrice : p.openPrice - px) >= be * pt) {
          this.rt.patch(this.id, (r) => ({ beDone: [...r.beDone.slice(-200), p.ticket] }));
          const cand = roundPrice(spec.symbol, p.openPrice + (p.side === "buy" ? 1 : -1) * spec.trailing.breakevenOffset * pt);
          if (p.sl === undefined || (p.side === "buy" ? cand > p.sl : cand < p.sl)) {
            this.knownSl.set(p.ticket, cand);
            void api.modifyPosition(p.ticket, { sl: cand }).then((ok) => this.rt.logFor(this.id, ok ? "manage" : "error", ok ? `Breakeven: #${p.ticket} SL moved to ${fmtPrice(spec.symbol, cand)}` : `Breakeven modify of #${p.ticket} rejected`, ok ? "info" : "error"));
            continue; // `p` is the pre-modify snapshot
          }
        }
        // SL moved by the store's trailing engine: log at most every 3 s per position
        const known = this.knownSl.get(p.ticket);
        if (this.knownSl.has(p.ticket) && known !== p.sl && p.sl !== undefined && Date.now() - (this.lastTrailLog.get(p.ticket) ?? 0) > 3000) {
          this.lastTrailLog.set(p.ticket, Date.now());
          this.rt.logFor(this.id, "manage", `Trailing stop: #${p.ticket} SL moved to ${fmtPrice(spec.symbol, p.sl)}`);
          this.knownSl.set(p.ticket, p.sl);
        } else if (!this.knownSl.has(p.ticket)) this.knownSl.set(p.ticket, p.sl);
      }
    }
    // intrabar exit rules (throttled)
    if (rec.status === "active" && spec.exitIntrabar && (hasRules(spec.exitLong) || hasRules(spec.exitShort)) && Date.now() - this.lastIntrabar > 1000 && this.openCount() > 0) {
      this.lastIntrabar = Date.now();
      const bars = this.main.bars;
      if (bars.length < 3) return;
      const sf = this.seriesFor(new Map(), bars, true);
      if (hasRules(spec.exitLong) && evalRuleSet(spec.exitLong, sf).ok) this.exitSide("buy", "intrabar exit rule");
      if (hasRules(spec.exitShort) && evalRuleSet(spec.exitShort, sf).ok) this.exitSide("sell", "intrabar exit rule");
    }
  }
}

/* ------------------------------------------------------------------ */
/* Runtime (singleton)                                                 */
/* ------------------------------------------------------------------ */

export interface AiSnapshot {
  login: string | null;
  records: StrategyRecord[];
  attached: boolean;
}

export class AiTraderRuntime {
  api: TradingApi | null = null;
  private records: StrategyRecord[] = [];
  private engines = new Map<string, Engine>();
  private listeners = new Set<() => void>();
  private snap: AiSnapshot = { login: null, records: [], attached: false };
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private syncTimer: ReturnType<typeof setInterval> | null = null;

  /* ------------------------------ store plumbing ------------------------------ */

  subscribe = (l: () => void) => {
    this.listeners.add(l);
    return () => void this.listeners.delete(l);
  };
  getSnapshot = () => this.snap;
  private emit() {
    this.snap = { login: this.api?.login ?? null, records: this.records, attached: !!this.api };
    this.listeners.forEach((l) => l());
    if (this.saveTimer) return;
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      this.save();
    }, 400);
  }
  private save() {
    if (!this.api) return;
    try {
      localStorage.setItem(STORE_KEY(this.api.login), JSON.stringify(this.records));
    } catch {
      /* storage full or blocked */
    }
  }
  private load(login: string): StrategyRecord[] {
    try {
      const raw = localStorage.getItem(STORE_KEY(login));
      if (!raw) return [];
      const list = JSON.parse(raw) as StrategyRecord[];
      if (!Array.isArray(list)) return [];
      return list
        .filter((r) => r && typeof r.id === "string")
        .map((r) => ({
          ...blankStats(),
          ...r,
          spec: validateSpec(r.spec).spec,
          log: Array.isArray(r.log) ? r.log.slice(-LOG_CAP) : [],
          paper: Array.isArray(r.paper) ? r.paper : [],
          openTickets: Array.isArray(r.openTickets) ? r.openTickets : [],
          counted: Array.isArray(r.counted) ? r.counted : [],
          beDone: Array.isArray(r.beDone) ? r.beDone : [],
        }));
    } catch {
      return [];
    }
  }

  get(id: string) {
    return this.records.find((r) => r.id === id);
  }

  patch(id: string, p: Partial<StrategyRecord> | ((r: StrategyRecord) => Partial<StrategyRecord>)) {
    this.records = this.records.map((r) => (r.id === id ? { ...r, ...(typeof p === "function" ? p(r) : p) } : r));
    this.emit();
  }
  patchPaper(id: string, pid: string, p: Partial<PaperPos>) {
    this.patch(id, (r) => ({ paper: r.paper.map((x) => (x.id === pid ? { ...x, ...p } : x)) }));
  }

  logFor(id: string, kind: LogKind, text: string, level?: JournalLine["level"]) {
    const r = this.get(id);
    if (!r) return;
    const e: LogEntry = { ts: Date.now(), kind, text };
    this.patch(id, (x) => ({ log: [...x.log.slice(-(LOG_CAP - 1)), e] }));
    this.api?.log("Experts", `AI ${r.id} "${r.spec.name}": ${text}`, level ?? (kind === "error" ? "error" : undefined));
  }

  /* ------------------------------ lifecycle ------------------------------ */

  attach(api: TradingApi) {
    this.detachEngines();
    this.api = api;
    this.records = this.load(api.login);
    this.emit();
    for (const r of this.records) {
      if (r.mode === "live" && r.openTickets.length) this.syncLive(r.id, true);
      if (r.status === "active" || r.status === "paused") {
        this.logFor(r.id, "info", `Resumed after reload (${r.status}, ${r.mode} mode)`);
        this.startEngine(r.id);
      }
    }
    // closes of positions that belong to stopped strategies still need to be booked
    this.syncTimer = setInterval(() => {
      for (const r of this.records) if (r.mode === "live" && r.openTickets.length && !this.engines.has(r.id)) this.syncLive(r.id);
    }, 2000);
    return () => this.detach();
  }

  detach() {
    this.save();
    this.detachEngines();
    if (this.syncTimer) clearInterval(this.syncTimer);
    this.syncTimer = null;
    this.api = null;
    this.records = [];
    this.emit();
  }

  private detachEngines() {
    this.engines.forEach((e) => e.dispose());
    this.engines.clear();
  }
  private startEngine(id: string) {
    this.engines.get(id)?.dispose();
    this.engines.set(id, new Engine(this, id));
  }
  private stopEngine(id: string) {
    this.engines.get(id)?.dispose();
    this.engines.delete(id);
  }
  engineInfo(id: string): EngineInfo | null {
    return this.engines.get(id)?.info() ?? null;
  }

  /* ------------------------------ strategy actions ------------------------------ */

  createDraft(res: ParseResult, prompt: string, origin: StrategyRecord["origin"]): string {
    const id = newId();
    const now = Date.now();
    const rec: StrategyRecord = {
      ...blankStats(),
      id,
      spec: res.strategy,
      prompt,
      origin,
      questions: res.questions,
      assumptions: res.assumptions,
      status: "draft",
      mode: "paper",
      paperRuns: 0,
      createdAt: now,
      updatedAt: now,
      log: [],
    };
    this.records = [rec, ...this.records];
    this.emit();
    this.logFor(id, "info", `Draft created from ${origin === "claude" ? "Claude" : "the local parser"}${res.questions.length ? ` with ${res.questions.length} open question(s)` : ""}`);
    return id;
  }

  updateSpec(id: string, spec: StrategySpec) {
    const r = this.get(id);
    if (!r || r.status === "active") return;
    this.patch(id, { spec, updatedAt: Date.now(), questions: [] });
  }

  activate(id: string, mode: RunMode) {
    const r = this.get(id);
    if (!r || !this.api) return;
    if (mode === "live" && this.api.investor) return;
    const wasRunning = r.status === "active" || r.status === "paused";
    // paper and live keep separate daily counters: switching mode starts a fresh day budget
    const reset = r.mode !== mode ? { tradesToday: 0, dayRealized: 0 } : {};
    this.patch(id, (x) => ({ ...reset, status: "active", mode, activatedAt: Date.now(), paperRuns: x.paperRuns + (mode === "paper" ? 1 : 0), paper: mode === "live" ? [] : x.paper }));
    this.logFor(id, "info", `Activated in ${mode === "paper" ? "PAPER (dry-run, no orders)" : `LIVE mode on ${this.api.accountType} account ${this.api.login}`}`, mode === "live" ? "warn" : undefined);
    if (wasRunning && r.mode === "paper" && mode === "live" && r.paper.length) this.logFor(id, "info", `${r.paper.length} paper position(s) discarded on switch to live`);
    this.startEngine(id);
  }

  pause(id: string) {
    this.patch(id, { status: "paused" });
    this.logFor(id, "info", "Paused: no new entries; SL/TP/trailing/breakeven still managed");
  }

  resume(id: string) {
    this.patch(id, { status: "active" });
    this.logFor(id, "info", "Resumed");
    if (!this.engines.has(id)) this.startEngine(id);
  }

  stop(id: string, closePositions: boolean) {
    const r = this.get(id);
    if (!r) return;
    if (closePositions) void this.closeAllOf(id, "ai stop");
    this.stopEngine(id);
    this.patch(id, { status: "stopped", paper: [] });
    this.logFor(id, "info", `Stopped${closePositions ? " and closed its positions" : r.openTickets.length ? `; ${r.openTickets.length} position(s) left open with their SL/TP` : ""}`, "warn");
  }

  remove(id: string) {
    const r = this.get(id);
    if (!r) return;
    this.stopEngine(id);
    this.api?.log("Experts", `AI ${r.id} "${r.spec.name}": deleted`);
    this.records = this.records.filter((x) => x.id !== id);
    this.emit();
  }

  clearLog(id: string) {
    this.patch(id, { log: [] });
  }

  /** Kill switch: stop every AI strategy on this account and close every AI position. */
  async killAll(): Promise<{ strategies: number; positions: number; blocked: number }> {
    const api = this.api;
    let strategies = 0;
    const aiOpen = api ? api.positions().filter((x) => x.login === api.login && x.source === "ai").length : 0;
    for (const r of this.records) {
      if (r.status === "active" || r.status === "paused") {
        strategies++;
        await this.closeAllOf(r.id, "ai kill");
        this.stopEngine(r.id);
        this.patch(r.id, { status: "stopped", paper: [] });
        this.logFor(r.id, "info", "Stopped by kill switch", "warn");
      }
    }
    let positions = 0;
    let blocked = 0;
    if (api && !api.investor) {
      // anything still open with source "ai" (strategy positions were closed above)
      const rest = api.positions().filter((x) => x.login === api.login && x.source === "ai");
      const closed = await Promise.all(rest.map((p) => api.closePosition(p.ticket, "ai kill")));
      const failed = new Set(rest.filter((_, i) => !closed[i]).map((p) => p.ticket));
      const left = api.positions().filter((x) => x.login === api.login && x.source === "ai" && (failed.has(x.ticket) || !rest.some((r) => r.ticket === x.ticket)));
      positions = aiOpen - left.length;
      for (const r of this.records) if (r.openTickets.length) this.syncLive(r.id);
      api.log("Experts", `AI kill switch: ${strategies} strategies stopped, ${positions} AI positions closed`, "warn");
      blocked = left.length;
      if (left.length) {
        const syms = [...new Set(left.map((p) => p.symbol))].join(", ");
        api.log("Experts", `AI kill switch: could not close ${left.length} AI position${left.length > 1 ? "s" : ""} on ${syms}: market closed; they stay open with their SL/TP until the market opens`, "error");
      }
    }
    return { strategies, positions, blocked };
  }

  async closeAllOf(id: string, reason: string) {
    const r = this.get(id);
    if (!r) return;
    for (const p of r.paper) this.closePaper(id, p.id, undefined, reason);
    const api = this.api;
    if (api && !api.investor) {
      await Promise.all(
        api
          .positions()
          .filter((x) => r.openTickets.includes(x.ticket))
          .map(async (p) => {
            if (!(await api.closePosition(p.ticket, reason))) this.logFor(id, "error", `Could not close #${p.ticket} ${p.symbol} (${reason}): rejected (see Journal); position left open with its SL/TP`, "warn");
          }),
      );
      this.syncLive(id);
    }
  }

  closePaper(id: string, pid: string, at: number | undefined, why: string) {
    const r = this.get(id);
    const p = r?.paper.find((x) => x.id === pid);
    if (!r || !p) return;
    const q = priceFeed().snapshot(r.spec.symbol)!;
    const px = at ?? (p.side === "buy" ? q.bid : q.ask);
    const profit = +profitAt({ symbol: r.spec.symbol, side: p.side, volume: p.volume, openPrice: p.open }, px).toFixed(2);
    this.patch(id, (x) => ({
      paper: x.paper.filter((y) => y.id !== pid),
      realized: x.realized + profit,
      dayRealized: x.dayRealized + profit,
      trades: x.trades + 1,
      wins: x.wins + (profit > 0 ? 1 : 0),
    }));
    this.logFor(id, "close", `PAPER ${p.side.toUpperCase()} ${fmtVol(p.volume)} closed (${why}) at ${fmtPrice(r.spec.symbol, px)}, P&L ${profit >= 0 ? "+" : ""}${profit.toFixed(2)}`);
  }

  /** Book closes of the strategy's live positions (SL/TP/trailing hits, manual closes, netting). */
  syncLive(id: string, onAttach = false) {
    const api = this.api;
    const r = this.get(id);
    if (!api || !r || !r.openTickets.length) return;
    const open = new Set(api.positions().map((p) => p.ticket));
    const hist = api.history();
    const counted = new Set(r.counted);
    let realized = 0;
    let trades = 0;
    let wins = 0;
    const newlyCounted: string[] = [];
    const logs: [LogKind, string, JournalLine["level"]?][] = [];
    for (const h of hist) {
      if (!r.openTickets.includes(h.ticket)) continue;
      const key = `${h.ticket}|${h.closeTime}|${h.volume}`;
      if (counted.has(key)) continue;
      newlyCounted.push(key);
      realized += h.profit;
      if (!open.has(h.ticket)) {
        trades++;
        if (h.profit > 0) wins++;
      }
      const why = h.reason === "sl" ? "stop loss" : h.reason === "tp" ? "take profit" : h.reason === "manual" ? "manual close" : (h.reason ?? "close");
      logs.push(["close", `#${h.ticket} ${h.side} ${fmtVol(h.volume)} closed by ${why} at ${fmtPrice(h.symbol, h.closePrice)}, P&L ${h.profit >= 0 ? "+" : ""}${h.profit.toFixed(2)}`]);
    }
    const stillOpen = r.openTickets.filter((t) => open.has(t));
    const lost = r.openTickets.filter((t) => !open.has(t) && !hist.some((h) => h.ticket === t));
    if (lost.length && onAttach) logs.push(["info", `Position(s) ${lost.map((t) => `#${t}`).join(", ")} no longer exist (demo trading state resets when the terminal reloads)`, "warn"]);
    if (!newlyCounted.length && stillOpen.length === r.openTickets.length) return;
    this.patch(id, (x) => ({
      openTickets: stillOpen,
      counted: [...x.counted, ...newlyCounted].slice(-500),
      realized: x.realized + realized,
      dayRealized: x.dayRealized + realized,
      trades: x.trades + trades,
      wins: x.wins + wins,
    }));
    for (const [k, t, l] of logs) this.logFor(id, k, t, l);
  }

  rollDay(id: string) {
    const r = this.get(id);
    const day = serverParts().day;
    if (r && r.day !== day) this.patch(id, { day, tradesToday: 0, dayRealized: 0 });
  }

  /** Floating P&L (USD) of the strategy's open positions. */
  floating(id: string): number {
    const r = this.get(id);
    if (!r) return 0;
    const q = priceFeed().snapshot(r.spec.symbol);
    if (!q) return 0;
    if (r.mode === "paper") return r.paper.reduce((s, p) => s + profitAt({ symbol: r.spec.symbol, side: p.side, volume: p.volume, openPrice: p.open }, p.side === "buy" ? q.bid : q.ask), 0);
    const api = this.api;
    if (!api) return 0;
    return api
      .positions()
      .filter((p) => r.openTickets.includes(p.ticket))
      .reduce((s, p) => {
        const qq = priceFeed().snapshot(p.symbol)!;
        return s + profitAt(p, p.side === "buy" ? qq.bid : qq.ask) + p.swap - p.commission;
      }, 0);
  }
}

function blankStats() {
  return { day: serverParts().day, tradesToday: 0, dayRealized: 0, realized: 0, trades: 0, wins: 0, openTickets: [] as string[], counted: [] as string[], beDone: [] as string[], paper: [] as PaperPos[] };
}

export const aiTrader = new AiTraderRuntime();

export type { RuleSet };
