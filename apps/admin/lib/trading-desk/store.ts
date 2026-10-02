/**
 * Dealing desk service layer — client-side implementation.
 *
 * There is no trading-engine backend yet, so LocalTradingDesk keeps the desk state (positions, pending
 * orders, closing deals, controls, routing rules and the audit log) in memory, persisted to localStorage,
 * seeded from the @kalks/mock admin-trading data. Every mutation goes through a typed method of
 * TradingDeskApi and appends immutable AuditEntry records (staff, action, tickets, before/after, reason).
 *
 * Intended trading-engine REST contract (a RestTradingDesk implements the same interface; every write
 * carries { reasonCode, note } and returns { data, audit[] } or { error }; the engine writes the audit log):
 *
 *   GET    /v1/dealing/positions?book=&group=&symbol=&source=&login=     → DeskPosition[]  (+ WS /v1/dealing/stream)
 *   POST   /v1/dealing/trades                    CreateTradeInput           → position | pending order
 *   PATCH  /v1/dealing/positions/:ticket         { sl, tp }
 *   POST   /v1/dealing/positions/:ticket/close   { volume?, price?, force?, stopOut? }  → deal
 *   POST   /v1/dealing/positions/:ticket/add     { volume }
 *   POST   /v1/dealing/positions/:ticket/price-correction   { openPrice }   (reason DLR-02 only)
 *   POST   /v1/dealing/positions/:ticket/charges { swap?, commission? }
 *   POST   /v1/dealing/positions/:ticket/void
 *   POST   /v1/dealing/deals/:id/reopen
 *   POST   /v1/dealing/book-transfers            { tickets[], to: "A"|"B", volume? | pct? }  → split tickets
 *   POST   /v1/dealing/positions/bulk            { tickets[], op: "close"|"modify", … }
 *   GET    /v1/dealing/orders                    · PATCH /v1/dealing/orders/:ticket · POST /v1/dealing/orders/cancel { tickets[] }
 *   POST   /v1/dealing/orders/:ticket/fill
 *   PUT    /v1/dealing/controls/symbols/:symbol  { group, mode: "halt"|"close-only"|null }
 *   PUT    /v1/dealing/controls/accounts/:login  { tradingDisabled, closeOnly, maxLot, execDelayMs, markupPips }
 *   PUT    /v1/dealing/controls/tenant           { execDelayEnabled, marginCallPct, stopOutPct }
 *   PUT    /v1/dealing/routing/rules             RoutingRule[]   · PUT /v1/dealing/routing/quick { login|group, book|null }
 *   GET    /v1/dealing/audit?staff=&action=&ticket=&from=&to=      → AuditEntry[] (append-only)
 */
import { INSTRUMENT_MAP, getInstrument, priceFeed, rebaseTrades } from "@kalks/mock";
import { ADMIN_ORDERS, ADMIN_POSITIONS, DEALER_OVERRIDES, ROUTING_RULES, type AdminOrder, type RoutingRule, type TradingGroup } from "@kalks/mock/admin-trading";
import { getClient } from "@kalks/mock/admin-clients";
import {
  REASON_ERROR_CORRECTION,
  accountMetrics,
  bookAttribution,
  closePriceOf,
  getAccount,
  marginFor,
  noteRequired,
  openPriceOf,
  pricePnl,
  resolveRoute,
  roundPrice,
  roundVol,
  symbolSpec,
  volumeError,
  type QuoteFn,
} from "./calc";
import type {
  AccountControl,
  AuditAction,
  AuditEntry,
  Book,
  BulkOutcome,
  ControlMode,
  CreateTradeInput,
  DealKind,
  DeskDeal,
  DeskOrder,
  DeskPosition,
  DeskResult,
  DeskState,
  OrderPatch,
  Reason,
  StaffRef,
  TenantPolicy,
  TradingDeskApi,
} from "./types";

const STORAGE_KEY = "kalks.tradingDesk.v1";
const VERSION = 1;
const nowIso = () => new Date().toISOString();
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const fail = (error: string, audit?: AuditEntry[]): DeskResult<never> => ({ ok: false, error, audit });
/** Off-market guard for dealer-entered prices (manual fill, close at price, open-price correction). */
const offMarket = (price: number, market: number, band: number) => market > 0 && Math.abs(price / market - 1) > band;

/* ------------------------------------------------------------------ */
/* Seed                                                                */
/* ------------------------------------------------------------------ */

function seedState(): DeskState {
  const positions: DeskPosition[] = ADMIN_POSITIONS.map((p) => ({
    ...clone(p),
    bookSince: p.openTime,
    bookPrice: p.openPrice,
    bookCarry: { A: 0, B: 0 },
    routeHistory: [{ at: p.openTime, kind: "open", from: null, to: p.route, volume: p.volume, price: p.openPrice, staff: "Routing engine", reason: p.route === "A" ? "Routing rule" : "Default route" }],
    refLevel: true,
  }));
  const orders: DeskOrder[] = ADMIN_ORDERS.map((o) => ({ ...clone(o), source: o.source ?? "manual", refLevel: true }));
  const accountControls: AccountControl[] = DEALER_OVERRIDES.map((d) => ({ ...clone(d) }));
  return {
    version: VERSION,
    positions,
    orders,
    deals: [],
    audit: [],
    symbolControls: [],
    accountControls,
    routingRules: clone(ROUTING_RULES),
    balanceAdj: {},
    tenant: { execDelayEnabled: true, execDelayCapMs: 500, marginCallPct: 100, stopOutPct: 50 },
    seq: { position: 49_460_001, order: 51_230_001, deal: 7_120_001, audit: 1, control: 1 },
  };
}

/* ------------------------------------------------------------------ */
/* Local implementation                                                */
/* ------------------------------------------------------------------ */

export class LocalTradingDesk implements TradingDeskApi {
  private state: DeskState;
  private listeners = new Set<() => void>();
  private actor: StaffRef = { id: 0, name: "System", role: "system" };
  private hydrated = false;
  private quote: QuoteFn;

  constructor(quote?: QuoteFn) {
    this.state = seedState();
    this.quote = quote ?? ((s) => priceFeed().quote(s));
  }

  /** Seed snapshot rendered on the server (and on the first client render, before localStorage loads). */
  static readonly serverState: DeskState = seedState();

  getState = () => this.state;
  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => void this.listeners.delete(fn);
  };
  setActor(staff: StaffRef) {
    this.actor = staff;
  }

  /** Load persisted state (client only) and re-base seeded rows onto live prices. */
  hydrate() {
    if (this.hydrated || typeof window === "undefined") return;
    this.hydrated = true;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const s = JSON.parse(raw) as DeskState;
        if (s && s.version === VERSION && Array.isArray(s.positions)) this.state = { ...seedState(), ...s };
      }
    } catch {
      /* storage unavailable: keep the seed */
    }
    const feed = priceFeed();
    feed.onMode(() => this.rebaseSeeds());
    void feed.ready.then(() => this.rebaseSeeds());
    this.rebaseSeeds();
    this.emit(false);
  }

  private rebaseSeeds() {
    const hasFactor = new Map<string, boolean>();
    const factor = (symbol: string) => {
      if (!hasFactor.has(symbol)) {
        const probe = { symbol, price: 1_000_000 };
        rebaseTrades([probe]);
        hasFactor.set(symbol, probe.price !== 1_000_000);
      }
      return hasFactor.get(symbol)!;
    };
    let changed = false;
    const positions = this.state.positions.map((p) => {
      if (!p.refLevel || !factor(p.symbol)) return p;
      const c = clone(p);
      rebaseTrades([c]);
      changed = true;
      return { ...c, bookPrice: c.openPrice, refLevel: false, routeHistory: c.routeHistory.map((e, i) => (i === 0 ? { ...e, price: c.openPrice } : e)) };
    });
    const orders = this.state.orders.map((o) => {
      if (!o.refLevel || !factor(o.symbol)) return o;
      const c = clone(o);
      rebaseTrades([c]);
      changed = true;
      return { ...c, refLevel: false };
    });
    if (changed) {
      this.state = { ...this.state, positions, orders };
      this.emit();
    }
  }

  private emit(persist = true) {
    if (persist && typeof window !== "undefined") {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
      } catch {
        /* quota / private mode: state stays in memory */
      }
    }
    this.listeners.forEach((l) => l());
  }

  /* ---------------- internals ---------------- */

  private commit(next: DeskState) {
    this.state = next;
    this.emit();
  }

  private audit(s: DeskState, action: AuditAction, e: { tickets?: string[]; login?: string; symbol?: string; before?: Record<string, unknown> | null; after?: Record<string, unknown> | null; reason: Reason; flags?: string[] }): AuditEntry {
    const entry: AuditEntry = Object.freeze({
      id: `AUD-${String(s.seq.audit++).padStart(6, "0")}`,
      at: nowIso(),
      staff: Object.freeze({ ...this.actor }),
      action,
      tickets: Object.freeze([...(e.tickets ?? [])]),
      login: e.login,
      symbol: e.symbol,
      before: e.before ? Object.freeze({ ...e.before }) : null,
      after: e.after ? Object.freeze({ ...e.after }) : null,
      reasonCode: e.reason.code,
      note: e.reason.note?.trim() ?? "",
      flags: e.flags?.length ? Object.freeze([...e.flags]) : undefined,
    });
    s.audit = [entry, ...s.audit];
    return entry;
  }

  /** Copy-on-write draft of the state for one action. */
  private draft(): DeskState {
    return { ...this.state, seq: { ...this.state.seq }, balanceAdj: { ...this.state.balanceAdj } };
  }

  private checkReason(r: Reason): string | null {
    if (!r.code) return "Select a reason code";
    if (noteRequired(r.code) && !r.note?.trim()) return "A note is required for reason “Other”";
    return null;
  }

  private q(symbol: string) {
    const q = this.quote(symbol);
    return q && q.bid > 0 && q.ask > 0 ? q : null;
  }

  private controlFor(symbol: string, group: string) {
    const list = this.state.symbolControls.filter((c) => c.symbol === symbol && (c.group === "all" || c.group === group));
    return list.find((c) => c.mode === "halt") ?? list.find((c) => c.mode === "close-only") ?? null;
  }

  /** Rules that stop new exposure on an account/symbol. Returns the rejection message or null. */
  private openBlock(login: string, symbol: string, group: string, volume: number): string | null {
    const acc = getAccount(login);
    if (!acc) return `Unknown account ${login}`;
    if (acc.status !== "active") return `Account ${login} is ${acc.status} — trading not allowed`;
    const ctl = this.state.accountControls.find((c) => c.login === login);
    if (ctl?.tradingDisabled) return `Trading is disabled on ${login} (dealer control)`;
    if (ctl?.closeOnly) return `${login} is close-only — new positions are rejected`;
    if (ctl && ctl.maxLot > 0 && volume > ctl.maxLot + 1e-9) return `Volume ${volume} exceeds the account max lot ${ctl.maxLot}`;
    const sc = this.controlFor(symbol, group);
    if (sc?.mode === "halt") return `${symbol} is halted${sc.group === "all" ? "" : ` for ${sc.group}`} — trading suspended`;
    if (sc?.mode === "close-only") return `${symbol} is close-only${sc.group === "all" ? "" : ` for ${sc.group}`} — new positions are rejected`;
    return null;
  }

  private closeBlock(p: DeskPosition, force?: boolean): string | null {
    if (force) return null;
    const sc = this.controlFor(p.symbol, p.group);
    if (sc?.mode === "halt") return `${p.symbol} is halted — use Force close to override`;
    return null;
  }

  private rejected(action: string, reason: Reason, error: string, e: { tickets?: string[]; login?: string; symbol?: string } = {}) {
    const s = this.draft();
    const entry = this.audit(s, "trade.rejected", { ...e, reason, before: null, after: { attempted: action, error }, flags: ["rejected"] });
    this.commit(s);
    return fail(error, [entry]);
  }

  private posIndex(s: DeskState, ticket: string) {
    return s.positions.findIndex((p) => p.ticket === ticket);
  }

  private snap(p: DeskPosition) {
    return { volume: p.volume, openPrice: p.openPrice, sl: p.sl ?? null, tp: p.tp ?? null, book: p.route, swap: p.swap, commission: p.commission };
  }

  /** Close `volume` of position `p` at `price`; mutates draft `s`, returns the deal. */
  private closePart(s: DeskState, p: DeskPosition, volume: number, price: number, kind: DealKind, reason: Reason, corrected: boolean): DeskDeal {
    const frac = volume / p.volume;
    const swap = +(p.swap * frac).toFixed(2);
    const commission = +(p.commission * frac).toFixed(2);
    const profit = +(pricePnl(p.symbol, p.side, volume, p.openPrice, price) + swap - commission).toFixed(2);
    const deal: DeskDeal = {
      id: `D${s.seq.deal++}`,
      ticket: p.ticket,
      login: p.login,
      clientId: p.clientId,
      symbol: p.symbol,
      side: p.side,
      volume,
      openPrice: p.openPrice,
      closePrice: price,
      openTime: p.openTime,
      closeTime: nowIso(),
      profit,
      book: p.route,
      kind,
      priceCorrection: corrected || undefined,
      staff: this.actor.name,
      reasonCode: reason.code,
      snapshot: clone({ ...p, volume, swap, commission, bookCarry: { A: p.bookCarry.A * frac, B: p.bookCarry.B * frac } }),
    };
    s.deals = [deal, ...s.deals];
    s.balanceAdj[p.login] = +((s.balanceAdj[p.login] ?? 0) + profit).toFixed(2);
    const i = this.posIndex(s, p.ticket);
    const rest = roundVol(p.symbol, p.volume - volume);
    if (rest <= 1e-9) s.positions = s.positions.filter((x) => x.ticket !== p.ticket);
    else {
      const keep = 1 - frac;
      const np: DeskPosition = { ...p, volume: rest, swap: +(p.swap - swap).toFixed(2), commission: +(p.commission - commission).toFixed(2), bookCarry: { A: p.bookCarry.A * keep, B: p.bookCarry.B * keep } };
      s.positions = s.positions.map((x, k) => (k === i ? np : x));
    }
    return deal;
  }

  /* ---------------- trades ---------------- */

  async createTrade(input: CreateTradeInput, reason: Reason) {
    const bad = this.checkReason(reason);
    if (bad) return fail(bad);
    const acc = getAccount(input.login);
    if (!acc) return fail(`Unknown account ${input.login}`);
    // getInstrument() never throws (it falls back for unknown symbols), so check the catalogue itself
    if (!INSTRUMENT_MAP[input.symbol]) return fail(`Unknown symbol ${input.symbol}`);
    const inst = getInstrument(input.symbol);
    const group = acc.group as TradingGroup;
    const ctl = this.state.accountControls.find((c) => c.login === input.login);
    const volErr = volumeError(input.symbol, input.volume);
    if (volErr) return this.rejected("create trade", reason, volErr, { login: input.login, symbol: input.symbol });
    const block = this.openBlock(input.login, input.symbol, group, input.volume);
    if (block) return this.rejected("create trade", reason, block, { login: input.login, symbol: input.symbol });

    let q = this.q(input.symbol);
    if (!q) return this.rejected("create trade", reason, `No price for ${input.symbol}`, { login: input.login, symbol: input.symbol });
    const client = getClient(acc.clientId);
    const route = resolveRoute(this.state.routingRules, { login: input.login, group, symbol: input.symbol, volume: input.volume, clientId: client.id });
    const book: Book = input.book ?? route.book;

    /* pending order */
    if (input.type !== "market") {
      const px = input.price;
      if (!px || px <= 0) return fail("Enter an order price");
      const mkt = openPriceOf(input.side, q);
      const isBuy = input.side === "buy";
      if (input.type === "limit" && (isBuy ? px >= mkt : px <= mkt)) return fail(`${isBuy ? "Buy" : "Sell"} limit must be ${isBuy ? "below" : "above"} the market (${roundPrice(input.symbol, mkt)})`);
      if ((input.type === "stop" || input.type === "stop-limit") && (isBuy ? px <= mkt : px >= mkt)) return fail(`${isBuy ? "Buy" : "Sell"} stop must be ${isBuy ? "above" : "below"} the market (${roundPrice(input.symbol, mkt)})`);
      if (input.type === "stop-limit") {
        if (!input.stopLimit || input.stopLimit <= 0) return fail("Enter the limit price of the stop-limit order");
        if (isBuy ? input.stopLimit > px : input.stopLimit < px) return fail(`Limit price must be ${isBuy ? "at or below" : "at or above"} the stop price`);
      }
      const slErr = this.sltpError(input.side, px, input.sl, input.tp);
      if (slErr) return fail(slErr);
      const s = this.draft();
      const typeLabel = (`${isBuy ? "Buy" : "Sell"} ${input.type === "limit" ? "Limit" : input.type === "stop" ? "Stop" : "Stop Limit"}`) as AdminOrder["type"];
      const o: DeskOrder = {
        ticket: String(s.seq.order++),
        login: input.login,
        clientId: acc.clientId,
        symbol: input.symbol,
        type: typeLabel,
        volume: input.volume,
        price: roundPrice(input.symbol, px),
        stopLimit: input.type === "stop-limit" ? roundPrice(input.symbol, input.stopLimit!) : undefined,
        sl: input.sl ? roundPrice(input.symbol, input.sl) : undefined,
        tp: input.tp ? roundPrice(input.symbol, input.tp) : undefined,
        placed: nowIso(),
        expiry: input.expiry ?? "GTC",
        group,
        source: "dealer",
        comment: input.comment,
        book,
      };
      s.orders = [o, ...s.orders];
      const entry = this.audit(s, "order.place", { tickets: [o.ticket], login: o.login, symbol: o.symbol, before: null, after: { type: o.type, volume: o.volume, price: o.price, stopLimit: o.stopLimit ?? null, sl: o.sl ?? null, tp: o.tp ?? null, book, expiry: o.expiry, source: "dealer" }, reason });
      this.commit(s);
      return { ok: true as const, data: { ticket: o.ticket, kind: "order" as const, price: o.price, book, delayMs: 0 }, audit: [entry] };
    }

    /* market */
    const manual = input.price !== undefined && input.price > 0;
    if (manual && !reason.note?.trim()) return fail("A manual price needs a note explaining where the price comes from");
    let delayMs = 0;
    if (!manual && this.state.tenant.execDelayEnabled && ctl && ctl.execDelayMs > 0) {
      delayMs = Math.min(ctl.execDelayMs, this.state.tenant.execDelayCapMs);
      await sleep(delayMs);
      q = this.q(input.symbol) ?? q;
      // re-check controls: they may have changed during the delay
      const again = this.openBlock(input.login, input.symbol, group, input.volume);
      if (again) return this.rejected("create trade", reason, again, { login: input.login, symbol: input.symbol });
    }
    const price = manual ? roundPrice(input.symbol, input.price!) : openPriceOf(input.side, q);
    if (manual && offMarket(price, openPriceOf(input.side, q), 0.05)) return fail(`Manual price ${price} is more than 5% away from the market (${roundPrice(input.symbol, openPriceOf(input.side, q))})`);
    const slErr = this.sltpError(input.side, closePriceOf(input.side, q), input.sl, input.tp);
    if (slErr) return fail(slErr);

    // margin check (approximate: notional / min(account leverage, class cap), live equity)
    const need = marginFor(input.symbol, input.volume, price, acc.leverage, this.quote);
    const m = accountMetrics(this.state, input.login, this.quote);
    if (m && need > m.freeMargin) return this.rejected("create trade", reason, `Insufficient free margin: needs $${need.toFixed(2)}, free $${m.freeMargin.toFixed(2)}`, { login: input.login, symbol: input.symbol });

    const s = this.draft();
    const at = nowIso();
    const commission = group === "ECN" ? +(input.volume * 7).toFixed(2) : 0;
    const p: DeskPosition = {
      ticket: String(s.seq.position++),
      login: input.login,
      clientId: acc.clientId,
      symbol: input.symbol,
      side: input.side,
      volume: input.volume,
      openPrice: price,
      sl: input.sl ? roundPrice(input.symbol, input.sl) : undefined,
      tp: input.tp ? roundPrice(input.symbol, input.tp) : undefined,
      swap: 0,
      commission,
      openTime: at,
      source: "dealer",
      platform: "Back Office",
      group,
      route: book,
      comment: input.comment,
      bookSince: at,
      bookPrice: price,
      bookCarry: { A: 0, B: 0 },
      routeHistory: [{ at, kind: "open", from: null, to: book, volume: input.volume, price, staff: this.actor.name, reason: input.book && input.book !== route.book ? `Dealer override (rule: ${route.rule?.name ?? "default"} → ${route.book})` : route.rule ? `Rule ${route.rule.id} · ${route.rule.name}` : "Default route" }],
    };
    s.positions = [p, ...s.positions];
    const flags = ["dealer"];
    if (manual) flags.push("manual price");
    if (delayMs) flags.push(`execution delay ${delayMs} ms`);
    const entry = this.audit(s, "position.open", {
      tickets: [p.ticket],
      login: p.login,
      symbol: p.symbol,
      before: null,
      after: { side: p.side, volume: p.volume, openPrice: price, market: roundPrice(p.symbol, openPriceOf(p.side, q)), sl: p.sl ?? null, tp: p.tp ?? null, book, margin: +need.toFixed(2), comment: p.comment ?? null, source: "dealer" },
      reason,
      flags,
    });
    this.commit(s);
    return { ok: true as const, data: { ticket: p.ticket, kind: "position" as const, price, book, delayMs }, audit: [entry] };
  }

  private sltpError(side: "buy" | "sell", ref: number, sl?: number | null, tp?: number | null): string | null {
    if (sl != null && sl > 0 && (side === "buy" ? sl >= ref : sl <= ref)) return `Stop loss must be ${side === "buy" ? "below" : "above"} ${ref}`;
    if (tp != null && tp > 0 && (side === "buy" ? tp <= ref : tp >= ref)) return `Take profit must be ${side === "buy" ? "above" : "below"} ${ref}`;
    return null;
  }

  async modifyPosition(ticket: string, patch: { sl?: number | null; tp?: number | null }, reason: Reason): Promise<DeskResult> {
    const bad = this.checkReason(reason);
    if (bad) return fail(bad);
    const p = this.state.positions.find((x) => x.ticket === ticket);
    if (!p) return fail(`Position #${ticket} not found`);
    const q = this.q(p.symbol);
    if (!q) return fail(`No price for ${p.symbol}`);
    const sl = patch.sl === undefined ? p.sl : patch.sl ?? undefined;
    const tp = patch.tp === undefined ? p.tp : patch.tp ?? undefined;
    const err = this.sltpError(p.side, closePriceOf(p.side, q), sl, tp);
    if (err) return fail(err);
    const s = this.draft();
    const np = { ...p, sl: sl ? roundPrice(p.symbol, sl) : undefined, tp: tp ? roundPrice(p.symbol, tp) : undefined };
    s.positions = s.positions.map((x) => (x.ticket === ticket ? np : x));
    const entry = this.audit(s, "position.modify", { tickets: [ticket], login: p.login, symbol: p.symbol, before: { sl: p.sl ?? null, tp: p.tp ?? null }, after: { sl: np.sl ?? null, tp: np.tp ?? null }, reason });
    this.commit(s);
    return { ok: true, data: null, audit: [entry] };
  }

  async modifyMany(tickets: string[], rule: { slPct?: number | null; tpPct?: number | null; clear?: "sl" | "tp" | "both" }, reason: Reason) {
    const bad = this.checkReason(reason);
    if (bad) return fail(bad);
    const s = this.draft();
    const out: BulkOutcome = { done: [], failed: [] };
    const entries: AuditEntry[] = [];
    for (const t of tickets) {
      const p = s.positions.find((x) => x.ticket === t);
      if (!p) {
        out.failed.push({ ticket: t, error: "not found" });
        continue;
      }
      const q = this.q(p.symbol);
      if (!q) {
        out.failed.push({ ticket: t, error: "no price" });
        continue;
      }
      const ref = closePriceOf(p.side, q);
      const dir = p.side === "buy" ? 1 : -1;
      let sl = p.sl;
      let tp = p.tp;
      if (rule.clear === "sl" || rule.clear === "both") sl = undefined;
      if (rule.clear === "tp" || rule.clear === "both") tp = undefined;
      if (rule.slPct) sl = roundPrice(p.symbol, ref * (1 - (dir * rule.slPct) / 100));
      if (rule.tpPct) tp = roundPrice(p.symbol, ref * (1 + (dir * rule.tpPct) / 100));
      const np = { ...p, sl, tp };
      s.positions = s.positions.map((x) => (x.ticket === t ? np : x));
      out.done.push(t);
      entries.push(this.audit(s, "position.modify", { tickets: [t], login: p.login, symbol: p.symbol, before: { sl: p.sl ?? null, tp: p.tp ?? null }, after: { sl: sl ?? null, tp: tp ?? null }, reason, flags: ["bulk"] }));
    }
    this.commit(s);
    return { ok: true as const, data: out, audit: entries };
  }

  async partialClose(ticket: string, volume: number, reason: Reason, opts: { price?: number } = {}) {
    const bad = this.checkReason(reason);
    if (bad) return fail(bad);
    const p = this.state.positions.find((x) => x.ticket === ticket);
    if (!p) return fail(`Position #${ticket} not found`);
    const spec = symbolSpec(p.symbol);
    const v = roundVol(p.symbol, volume);
    if (!(v > 0)) return fail("Enter a volume to close");
    if (v >= p.volume - 1e-9) return fail(`Partial close must be below ${p.volume} lots — use Close for the full volume`);
    const volErr = volumeError(p.symbol, v);
    if (volErr) return fail(volErr);
    if (p.volume - v < spec.min - 1e-9) return fail(`Remaining volume would be below the minimum ${spec.min}`);
    return this.doClose(p, v, reason, { price: opts.price, kind: "partial" });
  }

  async closePosition(ticket: string, reason: Reason, opts: { price?: number; force?: boolean; stopOut?: boolean } = {}) {
    const bad = this.checkReason(reason);
    if (bad) return fail(bad);
    const p = this.state.positions.find((x) => x.ticket === ticket);
    if (!p) return fail(`Position #${ticket} not found`);
    return this.doClose(p, p.volume, reason, { price: opts.price, force: opts.force || opts.stopOut, kind: opts.stopOut ? "stop-out" : opts.force ? "force" : "close" });
  }

  private doClose(p: DeskPosition, volume: number, reason: Reason, o: { price?: number; force?: boolean; kind: DealKind }) {
    const corrected = o.price !== undefined && o.price > 0;
    if (corrected && reason.code !== REASON_ERROR_CORRECTION) return fail("Closing at a specified price is a price correction — use reason DLR-02 · Error correction");
    if (corrected && !reason.note?.trim()) return fail("A price correction needs a note (source of the correct price)");
    const block = this.closeBlock(p, o.force);
    if (block) return this.rejected("close", reason, block, { tickets: [p.ticket], login: p.login, symbol: p.symbol });
    const q = this.q(p.symbol);
    if (!q && !corrected) return fail(`No price for ${p.symbol}`);
    const price = corrected ? roundPrice(p.symbol, o.price!) : closePriceOf(p.side, q!);
    if (corrected && q && offMarket(price, closePriceOf(p.side, q), 0.05)) return fail(`Close price ${price} is more than 5% away from the market (${roundPrice(p.symbol, closePriceOf(p.side, q))}) — check the value`);
    const s = this.draft();
    const deal = this.closePart(s, p, volume, price, corrected ? "price-correction" : o.kind, reason, corrected);
    const action: AuditAction = o.kind === "partial" ? "position.partial_close" : o.kind === "stop-out" ? "position.stop_out" : o.kind === "force" ? "position.force_close" : "position.close";
    const flags: string[] = [];
    if (corrected) flags.push("price correction");
    if (o.force) flags.push("forced");
    const entry = this.audit(s, action, {
      tickets: [p.ticket],
      login: p.login,
      symbol: p.symbol,
      before: { volume: p.volume, book: p.route },
      after: { closedVolume: volume, remaining: roundVol(p.symbol, p.volume - volume), closePrice: price, market: q ? roundPrice(p.symbol, closePriceOf(p.side, q)) : null, profit: deal.profit, deal: deal.id },
      reason,
      flags,
    });
    this.commit(s);
    return { ok: true as const, data: { dealId: deal.id, profit: deal.profit }, audit: [entry] };
  }

  async closeMany(tickets: string[], reason: Reason, opts: { force?: boolean } = {}) {
    const bad = this.checkReason(reason);
    if (bad) return fail(bad);
    const s = this.draft();
    const out: BulkOutcome & { profit: number } = { done: [], failed: [], profit: 0 };
    const entries: AuditEntry[] = [];
    for (const t of tickets) {
      const p = s.positions.find((x) => x.ticket === t);
      if (!p) {
        out.failed.push({ ticket: t, error: "not found" });
        continue;
      }
      const block = this.closeBlock(p, opts.force);
      const q = this.q(p.symbol);
      if (block || !q) {
        out.failed.push({ ticket: t, error: block ?? "no price" });
        continue;
      }
      const price = closePriceOf(p.side, q);
      const deal = this.closePart(s, p, p.volume, price, opts.force ? "force" : "close", reason, false);
      out.done.push(t);
      out.profit += deal.profit;
      entries.push(this.audit(s, opts.force ? "position.force_close" : "position.close", { tickets: [t], login: p.login, symbol: p.symbol, before: { volume: p.volume, book: p.route }, after: { closedVolume: p.volume, closePrice: price, profit: deal.profit, deal: deal.id }, reason, flags: ["bulk", ...(opts.force ? ["forced"] : [])] }));
    }
    this.commit(s);
    return { ok: true as const, data: out, audit: entries };
  }

  async addVolume(ticket: string, volume: number, reason: Reason): Promise<DeskResult> {
    const bad = this.checkReason(reason);
    if (bad) return fail(bad);
    const p = this.state.positions.find((x) => x.ticket === ticket);
    if (!p) return fail(`Position #${ticket} not found`);
    const v = roundVol(p.symbol, volume);
    const volErr = volumeError(p.symbol, v) ?? volumeError(p.symbol, roundVol(p.symbol, p.volume + v));
    if (volErr) return fail(volErr);
    const block = this.openBlock(p.login, p.symbol, p.group, roundVol(p.symbol, p.volume + v));
    if (block) return this.rejected("add volume", reason, block, { tickets: [ticket], login: p.login, symbol: p.symbol });
    const q = this.q(p.symbol);
    if (!q) return fail(`No price for ${p.symbol}`);
    const px = openPriceOf(p.side, q);
    const acc = getAccount(p.login)!;
    const need = marginFor(p.symbol, v, px, acc.leverage, this.quote);
    const m = accountMetrics(this.state, p.login, this.quote);
    if (m && need > m.freeMargin) return this.rejected("add volume", reason, `Insufficient free margin: needs $${need.toFixed(2)}, free $${m.freeMargin.toFixed(2)}`, { tickets: [ticket], login: p.login, symbol: p.symbol });
    const total = roundVol(p.symbol, p.volume + v);
    const avg = roundPrice(p.symbol, (p.openPrice * p.volume + px * v) / total);
    const bookAvg = roundPrice(p.symbol, (p.bookPrice * p.volume + px * v) / total);
    const s = this.draft();
    const np: DeskPosition = { ...p, volume: total, openPrice: avg, bookPrice: bookAvg, commission: p.group === "ECN" ? +(p.commission + v * 7).toFixed(2) : p.commission };
    s.positions = s.positions.map((x) => (x.ticket === ticket ? np : x));
    const entry = this.audit(s, "position.add_volume", { tickets: [ticket], login: p.login, symbol: p.symbol, before: { volume: p.volume, openPrice: p.openPrice }, after: { volume: total, openPrice: avg, addedAt: px, added: v }, reason });
    this.commit(s);
    return { ok: true, data: null, audit: [entry] };
  }

  async priceCorrection(ticket: string, openPrice: number, reason: Reason): Promise<DeskResult> {
    const bad = this.checkReason(reason);
    if (bad) return fail(bad);
    if (reason.code !== REASON_ERROR_CORRECTION) return fail("Price edits are restricted to error correction (DLR-02)");
    if (!reason.note?.trim()) return fail("A price correction needs a note (source of the correct price)");
    const p = this.state.positions.find((x) => x.ticket === ticket);
    if (!p) return fail(`Position #${ticket} not found`);
    if (!(openPrice > 0)) return fail("Enter the corrected open price");
    const px = roundPrice(p.symbol, openPrice);
    if (px === p.openPrice) return fail("Price is unchanged");
    if (offMarket(px, p.openPrice, 0.05)) return fail(`Corrected price ${px} is more than 5% away from the recorded open price ${p.openPrice} — check the value`);
    const s = this.draft();
    const neverMoved = p.bookPrice === p.openPrice;
    const np: DeskPosition = { ...p, openPrice: px, bookPrice: neverMoved ? px : p.bookPrice, priceCorrected: true };
    s.positions = s.positions.map((x) => (x.ticket === ticket ? np : x));
    const entry = this.audit(s, "position.price_correction", { tickets: [ticket], login: p.login, symbol: p.symbol, before: { openPrice: p.openPrice }, after: { openPrice: px }, reason, flags: ["price correction", "client statement"] });
    this.commit(s);
    return { ok: true, data: null, audit: [entry] };
  }

  async adjustCharges(ticket: string, patch: { swap?: number; commission?: number }, reason: Reason): Promise<DeskResult> {
    const bad = this.checkReason(reason);
    if (bad) return fail(bad);
    const p = this.state.positions.find((x) => x.ticket === ticket);
    if (!p) return fail(`Position #${ticket} not found`);
    const swap = patch.swap ?? p.swap;
    const commission = patch.commission ?? p.commission;
    if (!Number.isFinite(swap) || !Number.isFinite(commission)) return fail("Enter valid amounts");
    if (commission < 0) return fail("Commission cannot be negative");
    if (swap === p.swap && commission === p.commission) return fail("Nothing changed");
    const s = this.draft();
    s.positions = s.positions.map((x) => (x.ticket === ticket ? { ...x, swap: +swap.toFixed(2), commission: +commission.toFixed(2) } : x));
    const entry = this.audit(s, "position.adjust_charges", { tickets: [ticket], login: p.login, symbol: p.symbol, before: { swap: p.swap, commission: p.commission }, after: { swap: +swap.toFixed(2), commission: +commission.toFixed(2) }, reason, flags: ["charges adjustment"] });
    this.commit(s);
    return { ok: true, data: null, audit: [entry] };
  }

  async voidPosition(ticket: string, reason: Reason): Promise<DeskResult> {
    const bad = this.checkReason(reason);
    if (bad) return fail(bad);
    if (reason.code !== REASON_ERROR_CORRECTION && reason.code !== "DLR-06 · Technical issue") return fail("Voiding a trade is limited to error correction or technical issue");
    if (!reason.note?.trim()) return fail("Voiding a trade needs a note");
    const p = this.state.positions.find((x) => x.ticket === ticket);
    if (!p) return fail(`Position #${ticket} not found`);
    const s = this.draft();
    s.positions = s.positions.filter((x) => x.ticket !== ticket);
    const entry = this.audit(s, "position.void", { tickets: [ticket], login: p.login, symbol: p.symbol, before: this.snap(p), after: { status: "void — no P&L booked" }, reason, flags: ["void"] });
    this.commit(s);
    return { ok: true, data: null, audit: [entry] };
  }

  async reopenDeal(dealId: string, reason: Reason) {
    const bad = this.checkReason(reason);
    if (bad) return fail(bad);
    const d = this.state.deals.find((x) => x.id === dealId);
    if (!d) return fail(`Deal ${dealId} not found`);
    if (d.reversed) return fail(`Deal ${dealId} was already reversed`);
    const s = this.draft();
    const open = s.positions.find((x) => x.ticket === d.ticket);
    if (open) {
      const total = roundVol(open.symbol, open.volume + d.volume);
      const merged: DeskPosition = { ...open, volume: total, swap: +(open.swap + d.snapshot.swap).toFixed(2), commission: +(open.commission + d.snapshot.commission).toFixed(2), bookCarry: { A: open.bookCarry.A + d.snapshot.bookCarry.A, B: open.bookCarry.B + d.snapshot.bookCarry.B } };
      s.positions = s.positions.map((x) => (x.ticket === d.ticket ? merged : x));
    } else s.positions = [{ ...d.snapshot }, ...s.positions];
    s.balanceAdj[d.login] = +((s.balanceAdj[d.login] ?? 0) - d.profit).toFixed(2);
    s.deals = s.deals.map((x) => (x.id === dealId ? { ...x, reversed: true } : x));
    const entry = this.audit(s, "deal.reopen", { tickets: [d.ticket], login: d.login, symbol: d.symbol, before: { deal: d.id, closedVolume: d.volume, closePrice: d.closePrice, profit: d.profit }, after: { reopenedVolume: d.volume, balanceReversal: -d.profit }, reason, flags: ["reopen"] });
    this.commit(s);
    return { ok: true as const, data: { ticket: d.ticket }, audit: [entry] };
  }

  /* ---------------- A/B book ---------------- */

  async transferBook(tickets: string[], to: Book, reason: Reason, opts: { volume?: number; pct?: number } = {}) {
    const bad = this.checkReason(reason);
    if (bad) return fail(bad);
    const s = this.draft();
    const out: BulkOutcome & { created: string[] } = { done: [], failed: [], created: [] };
    const entries: AuditEntry[] = [];
    const at = nowIso();
    for (const t of tickets) {
      const p = s.positions.find((x) => x.ticket === t);
      if (!p) {
        out.failed.push({ ticket: t, error: "not found" });
        continue;
      }
      if (p.route === to) {
        out.failed.push({ ticket: t, error: `already on ${to}-book` });
        continue;
      }
      const q = this.q(p.symbol);
      if (!q) {
        out.failed.push({ ticket: t, error: "no price" });
        continue;
      }
      const spec = symbolSpec(p.symbol);
      let move = opts.volume !== undefined ? roundVol(p.symbol, opts.volume) : opts.pct !== undefined ? roundVol(p.symbol, (p.volume * opts.pct) / 100) : p.volume;
      if (move > p.volume) move = p.volume;
      if (move < spec.min - 1e-9) {
        out.failed.push({ ticket: t, error: `volume to move below minimum ${spec.min}` });
        continue;
      }
      const rest = roundVol(p.symbol, p.volume - move);
      if (rest > 0 && rest < spec.min - 1e-9) move = p.volume; // remainder too small to keep: move everything
      const px = closePriceOf(p.side, q);
      const from = p.route;
      const staff = this.actor.name;
      const full = move >= p.volume - 1e-9;
      if (full) {
        const seg = pricePnl(p.symbol, p.side, p.volume, p.bookPrice, px);
        const carry = { ...p.bookCarry, [from]: p.bookCarry[from] + seg };
        const np: DeskPosition = { ...p, route: to, bookSince: at, bookPrice: px, bookCarry: carry, routeHistory: [...p.routeHistory, { at, kind: "transfer", from, to, volume: p.volume, price: px, staff, reason: reason.code }] };
        s.positions = s.positions.map((x) => (x.ticket === t ? np : x));
        out.done.push(t);
        entries.push(this.audit(s, "book.transfer", { tickets: [t], login: p.login, symbol: p.symbol, before: { book: from, volume: p.volume }, after: { book: to, volume: p.volume, transferPrice: px, pnlOnPreviousBook: +seg.toFixed(2) }, reason, flags: opts.pct !== undefined || tickets.length > 1 ? ["bulk"] : undefined }));
      } else {
        const frac = move / p.volume;
        const child = String(s.seq.position++);
        const segMoved = pricePnl(p.symbol, p.side, move, p.bookPrice, px);
        const childCarry = { A: p.bookCarry.A * frac, B: p.bookCarry.B * frac };
        childCarry[from] += segMoved;
        const cSwap = +(p.swap * frac).toFixed(2);
        const cComm = +(p.commission * frac).toFixed(2);
        const cp: DeskPosition = {
          ...p,
          ticket: child,
          volume: move,
          swap: cSwap,
          commission: cComm,
          route: to,
          parentTicket: p.ticket,
          childTickets: undefined,
          bookSince: at,
          bookPrice: px,
          bookCarry: childCarry,
          routeHistory: [...p.routeHistory, { at, kind: "split-in", from, to, volume: move, price: px, staff, reason: reason.code, relatedTicket: p.ticket }],
        };
        const keep = 1 - frac;
        const np: DeskPosition = {
          ...p,
          volume: rest,
          swap: +(p.swap - cSwap).toFixed(2),
          commission: +(p.commission - cComm).toFixed(2),
          bookCarry: { A: p.bookCarry.A * keep, B: p.bookCarry.B * keep },
          childTickets: [...(p.childTickets ?? []), child],
          routeHistory: [...p.routeHistory, { at, kind: "split-out", from, to, volume: move, price: px, staff, reason: reason.code, relatedTicket: child }],
        };
        s.positions = s.positions.flatMap((x) => (x.ticket === t ? [np, cp] : [x]));
        out.done.push(t);
        out.created.push(child);
        entries.push(this.audit(s, "book.split", { tickets: [t, child], login: p.login, symbol: p.symbol, before: { ticket: t, book: from, volume: p.volume }, after: { [t]: `${rest} lots on ${from}-book`, [child]: `${move} lots on ${to}-book`, transferPrice: px, openPrice: p.openPrice }, reason, flags: tickets.length > 1 ? ["bulk", "partial transfer"] : ["partial transfer"] }));
      }
    }
    this.commit(s);
    return { ok: true as const, data: out, audit: entries };
  }

  /* ---------------- pending orders ---------------- */

  async modifyOrder(ticket: string, patch: OrderPatch, reason: Reason): Promise<DeskResult> {
    const bad = this.checkReason(reason);
    if (bad) return fail(bad);
    const o = this.state.orders.find((x) => x.ticket === ticket);
    if (!o) return fail(`Order #${ticket} not found`);
    const q = this.q(o.symbol);
    if (!q) return fail(`No price for ${o.symbol}`);
    const isBuy = o.type.startsWith("Buy");
    const price = patch.price ?? o.price;
    const volume = patch.volume ?? o.volume;
    const volErr = volumeError(o.symbol, volume);
    if (volErr) return fail(volErr);
    const mkt = isBuy ? q.ask : q.bid;
    if (o.type.includes("Limit") && !o.type.includes("Stop") && (isBuy ? price >= mkt : price <= mkt)) return fail(`${o.type} must be ${isBuy ? "below" : "above"} the market (${roundPrice(o.symbol, mkt)})`);
    if (o.type.includes("Stop") && (isBuy ? price <= mkt : price >= mkt)) return fail(`${o.type} must be ${isBuy ? "above" : "below"} the market (${roundPrice(o.symbol, mkt)})`);
    const sl = patch.sl === undefined ? o.sl : patch.sl ?? undefined;
    const tp = patch.tp === undefined ? o.tp : patch.tp ?? undefined;
    const err = this.sltpError(isBuy ? "buy" : "sell", price, sl, tp);
    if (err) return fail(err);
    const s = this.draft();
    const no: DeskOrder = { ...o, price: roundPrice(o.symbol, price), volume, sl: sl ? roundPrice(o.symbol, sl) : undefined, tp: tp ? roundPrice(o.symbol, tp) : undefined, stopLimit: patch.stopLimit ?? o.stopLimit, expiry: patch.expiry ?? o.expiry };
    s.orders = s.orders.map((x) => (x.ticket === ticket ? no : x));
    const entry = this.audit(s, "order.modify", { tickets: [ticket], login: o.login, symbol: o.symbol, before: { price: o.price, volume: o.volume, sl: o.sl ?? null, tp: o.tp ?? null, expiry: o.expiry }, after: { price: no.price, volume: no.volume, sl: no.sl ?? null, tp: no.tp ?? null, expiry: no.expiry }, reason });
    this.commit(s);
    return { ok: true, data: null, audit: [entry] };
  }

  async cancelOrders(tickets: string[], reason: Reason) {
    const bad = this.checkReason(reason);
    if (bad) return fail(bad);
    const s = this.draft();
    const out: BulkOutcome = { done: [], failed: [] };
    const entries: AuditEntry[] = [];
    for (const t of tickets) {
      const o = s.orders.find((x) => x.ticket === t);
      if (!o) {
        out.failed.push({ ticket: t, error: "not found" });
        continue;
      }
      s.orders = s.orders.filter((x) => x.ticket !== t);
      out.done.push(t);
      entries.push(this.audit(s, "order.cancel", { tickets: [t], login: o.login, symbol: o.symbol, before: { type: o.type, volume: o.volume, price: o.price }, after: { status: "cancelled" }, reason, flags: tickets.length > 1 ? ["bulk"] : undefined }));
    }
    this.commit(s);
    return { ok: true as const, data: out, audit: entries };
  }

  async fillOrder(ticket: string, reason: Reason) {
    const bad = this.checkReason(reason);
    if (bad) return fail(bad);
    const o = this.state.orders.find((x) => x.ticket === ticket);
    if (!o) return fail(`Order #${ticket} not found`);
    const res = await this.createTrade({ login: o.login, symbol: o.symbol, side: o.type.startsWith("Buy") ? "buy" : "sell", type: "market", volume: o.volume, sl: o.sl, tp: o.tp, book: o.book, comment: `Filled from order #${o.ticket}` }, reason);
    if (!res.ok) return res;
    const s = this.draft();
    s.orders = s.orders.filter((x) => x.ticket !== ticket);
    const entry = this.audit(s, "order.fill", { tickets: [ticket, res.data.ticket], login: o.login, symbol: o.symbol, before: { order: ticket, price: o.price }, after: { position: res.data.ticket, fillPrice: res.data.price }, reason, flags: ["dealer fill"] });
    this.commit(s);
    return { ok: true as const, data: { ticket: res.data.ticket }, audit: [...res.audit, entry] };
  }

  /* ---------------- controls ---------------- */

  async setSymbolControl(symbol: string, group: TradingGroup | "all", mode: ControlMode | null, reason: Reason): Promise<DeskResult> {
    const bad = this.checkReason(reason);
    if (bad) return fail(bad);
    const s = this.draft();
    const prev = s.symbolControls.find((c) => c.symbol === symbol && c.group === group) ?? null;
    s.symbolControls = s.symbolControls.filter((c) => !(c.symbol === symbol && c.group === group));
    if (mode) s.symbolControls = [{ id: `SC-${s.seq.control++}`, symbol, group, mode, reasonCode: reason.code, note: reason.note, staff: this.actor.name, at: nowIso() }, ...s.symbolControls];
    const entry = this.audit(s, "control.symbol", { symbol, before: { scope: group, mode: prev?.mode ?? "trading" }, after: { scope: group, mode: mode ?? "trading" }, reason });
    this.commit(s);
    return { ok: true, data: null, audit: [entry] };
  }

  async setAccountControl(login: string, patch: Partial<Pick<AccountControl, "tradingDisabled" | "closeOnly" | "maxLot" | "execDelayMs" | "markupPips">>, reason: Reason): Promise<DeskResult> {
    const bad = this.checkReason(reason);
    if (bad) return fail(bad);
    const acc = getAccount(login);
    if (!acc) return fail(`Unknown account ${login}`);
    if (patch.execDelayMs !== undefined && (patch.execDelayMs < 0 || patch.execDelayMs > this.state.tenant.execDelayCapMs)) return fail(`Execution delay must be 0–${this.state.tenant.execDelayCapMs} ms`);
    if (patch.maxLot !== undefined && !(patch.maxLot > 0)) return fail("Max lot must be above 0");
    const s = this.draft();
    const prev = s.accountControls.find((c) => c.login === login);
    const base: AccountControl = prev ?? { login, clientId: acc.clientId, group: acc.group, tradingDisabled: false, closeOnly: false, maxLot: 100, execDelayMs: 0, markupPips: 0, reason: "", setBy: "", updated: "" };
    const next: AccountControl = { ...base, ...patch, reason: reason.code, setBy: this.actor.name, updated: nowIso() };
    s.accountControls = prev ? s.accountControls.map((c) => (c.login === login ? next : c)) : [next, ...s.accountControls];
    const pick = (c: AccountControl) => ({ tradingDisabled: c.tradingDisabled, closeOnly: c.closeOnly, maxLot: c.maxLot, execDelayMs: c.execDelayMs, markupPips: c.markupPips });
    const entry = this.audit(s, "control.account", { login, before: prev ? pick(prev) : null, after: pick(next), reason, flags: patch.execDelayMs ? ["execution delay"] : undefined });
    this.commit(s);
    return { ok: true, data: null, audit: [entry] };
  }

  async setTenantPolicy(patch: Partial<TenantPolicy>, reason: Reason): Promise<DeskResult> {
    const bad = this.checkReason(reason);
    if (bad) return fail(bad);
    const s = this.draft();
    const prev = s.tenant;
    s.tenant = { ...prev, ...patch };
    const entry = this.audit(s, "control.tenant", { before: { ...prev }, after: { ...s.tenant }, reason });
    this.commit(s);
    return { ok: true, data: null, audit: [entry] };
  }

  async saveRoutingRules(rules: RoutingRule[], reason: Reason, summary: string): Promise<DeskResult> {
    const bad = this.checkReason(reason);
    if (bad) return fail(bad);
    const s = this.draft();
    const before = s.routingRules.map((r) => `${r.id}${r.enabled ? "" : " (off)"}`).join(", ");
    s.routingRules = clone(rules);
    const entry = this.audit(s, "routing.rule", { before: { rules: before }, after: { rules: rules.map((r) => `${r.id}${r.enabled ? "" : " (off)"}`).join(", "), change: summary }, reason });
    this.commit(s);
    return { ok: true, data: null, audit: [entry] };
  }

  async quickRoute(scope: { login: string } | { group: string }, book: Book | null, reason: Reason): Promise<DeskResult> {
    const bad = this.checkReason(reason);
    if (bad) return fail(bad);
    const isLogin = "login" in scope;
    const key = isLogin ? scope.login : scope.group;
    const id = isLogin ? `RQ-L${key}` : `RQ-G${key}`;
    const s = this.draft();
    const prev = s.routingRules.find((r) => r.id === id);
    s.routingRules = s.routingRules.filter((r) => r.id !== id);
    if (book) {
      const rule: RoutingRule = { id, name: isLogin ? `Account ${key} → ${book}-book` : `Group ${key} → ${book}-book`, conditions: [isLogin ? { field: "Login", op: "=", value: key } : { field: "Group", op: "is", value: key }], join: "AND", action: { book, pct: 100, lp: book === "A" ? "Primary LP" : undefined }, enabled: true, hits24h: 0, lots24h: 0 };
      // account overrides first, then group overrides, then the rule set
      const firstNonLogin = s.routingRules.findIndex((r) => !r.id.startsWith("RQ-L"));
      const firstNonQuick = s.routingRules.findIndex((r) => !r.id.startsWith("RQ-"));
      const at = isLogin ? (firstNonLogin < 0 ? s.routingRules.length : firstNonLogin) : firstNonQuick < 0 ? s.routingRules.length : firstNonQuick;
      s.routingRules = [...s.routingRules.slice(0, at), rule, ...s.routingRules.slice(at)];
    }
    const entry = this.audit(s, "routing.rule", { login: isLogin ? key : undefined, before: { scope: isLogin ? `login ${key}` : `group ${key}`, route: prev ? `${prev.action.book}-book` : "rules" }, after: { scope: isLogin ? `login ${key}` : `group ${key}`, route: book ? `${book}-book` : "rules" }, reason, flags: ["new trades only"] });
    this.commit(s);
    return { ok: true, data: null, audit: [entry] };
  }

  async reset(reason: Reason): Promise<DeskResult> {
    const bad = this.checkReason(reason);
    if (bad) return fail(bad);
    const keep = this.state.audit;
    const s = seedState();
    s.audit = keep;
    s.seq.audit = this.state.seq.audit;
    const entry = this.audit(s, "desk.reset", { before: { positions: this.state.positions.length, orders: this.state.orders.length }, after: { positions: s.positions.length, orders: s.orders.length }, reason, flags: ["demo data"] });
    this.state = s;
    this.rebaseSeeds();
    this.commit(this.state);
    return { ok: true, data: null, audit: [entry] };
  }
}

export { bookAttribution };
