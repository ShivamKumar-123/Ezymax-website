// Live money of one prop account, from the trading-engine account stream (the stream Kalks Trader uses), opened
// through the Client Area's mobile trade BFF: a terminal session for the client's own account (SSO, shared with
// the Trade tab: trading/session.ts) and a one-time WebSocket ticket (POST trade/stream-ticket).
//
// Performance: equity frames (at most 4 a second) land in Reanimated shared values, which the rings, bars and
// the chart's live head read on the UI thread, and in a tiny store that only leaf texts subscribe to (coalesced
// to one update per frame). Nothing else re-renders on a tick. Structural events (a deal, an account status
// change, a resync) are reported so the dashboard refetches the prop service's verdicts at once.
//
// When the stream can't be had (view-only or read-only staff sessions, an older server), the dashboard falls
// back to the prop evaluator's numbers (refreshed every few seconds) and `status` says so.
import * as React from "react";
import { AppState, type AppStateStatus } from "react-native";
import { makeMutable, type SharedValue } from "react-native-reanimated";
import { netStore } from "@/lib/net";
import { loadConfig } from "@/market/config";
import { dropTradeSession, tradeApi } from "../trading/session";

export type LiveStatus = "idle" | "connecting" | "live" | "offline" | "unavailable";
export type LiveMoney = { equity: number; balance: number; positions: number; at: number };
export type LiveEvent = "deal" | "status" | "resync";

/* ------------------------------------------------------------------ */
/* Engine access                                                       */
/* ------------------------------------------------------------------ */

type Fail = { ok: false; code: string; status: number };

/** A one-time stream ticket for `login`, on the same terminal session as the Trade tab (trading/session.ts). */
async function streamTicket(login: number): Promise<{ ok: true; ticket: string; url: string } | Fail> {
  const r = await tradeApi<{ ticket: string; url?: string }>(login, "stream-ticket", { method: "POST", body: {} });
  if (!r.ok) return { ok: false, code: r.error.code, status: r.status };
  const url = r.data.url ?? (await loadConfig())?.engineStream;
  return r.data.ticket && url ? { ok: true, ticket: r.data.ticket, url } : { ok: false, code: "unavailable", status: 0 };
}

/** Refusals that retrying won't fix (no stream for this session or server): the dashboard polls instead. */
const permanent = (f: Fail) => f.status === 403 || f.status === 404 || f.status === 405 || f.status === 422 || (f.status === 401 && f.code !== "session_expired");

/* ------------------------------------------------------------------ */
/* The stream                                                          */
/* ------------------------------------------------------------------ */

type Frame = {
  type?: string;
  op?: string;
  ticket?: number;
  reason?: string;
  balance?: number;
  equity?: number;
  account?: { balance?: number; equity?: number; status?: string; positions?: number };
  position?: { ticket?: number };
  positions?: { ticket?: number }[];
};

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

export class PropLive {
  readonly equity: SharedValue<number>;
  readonly balance: SharedValue<number>;
  money: LiveMoney;
  status: LiveStatus = "idle";

  private subs = new Set<() => void>();
  private statusSubs = new Set<() => void>();
  private ws: WebSocket | null = null;
  private stopped = true;
  private paused = false;
  private backoff = 0;
  private retry: ReturnType<typeof setTimeout> | null = null;
  private bgTimer: ReturnType<typeof setTimeout> | null = null;
  private watchdog: ReturnType<typeof setInterval> | null = null;
  private lastFrame = 0;
  private raf = 0;
  private tickets = new Set<number>();
  private accountStatus: string | null = null;
  private offApp: (() => void) | null = null;
  private offNet: (() => void) | null = null;
  private generation = 0;

  constructor(
    readonly login: number,
    private onEvent: (e: LiveEvent) => void,
    seed: { equity: number; balance: number; positions: number },
  ) {
    this.equity = makeMutable(seed.equity);
    this.balance = makeMutable(seed.balance);
    this.money = { ...seed, at: 0 };
  }

  /** Leaf texts: called at most once per frame after the money moved. */
  subscribe(fn: () => void): () => void {
    this.subs.add(fn);
    return () => {
      this.subs.delete(fn);
    };
  }

  onStatus(fn: () => void): () => void {
    this.statusSubs.add(fn);
    return () => {
      this.statusSubs.delete(fn);
    };
  }

  /** The prop service's numbers (polling): used while the stream isn't live, never over a live frame. */
  seed(equity: number, balance: number, positions: number) {
    if (this.status === "live") return;
    this.apply(equity, balance, positions, false);
  }

  start() {
    if (!this.stopped) return;
    this.stopped = false;
    this.paused = false;
    const sub = AppState.addEventListener("change", this.onAppState);
    this.offApp = () => sub.remove();
    const offNet = netStore.subscribe(() => {
      if (netStore.get().online && !this.paused && !this.stopped && !this.ws) {
        this.backoff = 0;
        this.schedule(0);
      }
    });
    this.offNet = () => {
      offNet();
    };
    this.watchdog = setInterval(() => {
      // nothing for 15 s (the engine sends a heartbeat every 5 s): the socket is dead even if it looks open
      if (this.ws && Date.now() - this.lastFrame > 15_000) this.reopen();
    }, 5_000);
    void this.connect();
  }

  stop() {
    this.stopped = true;
    this.generation++;
    this.offApp?.();
    this.offNet?.();
    this.offApp = this.offNet = null;
    if (this.retry) clearTimeout(this.retry);
    if (this.bgTimer) clearTimeout(this.bgTimer);
    if (this.watchdog) clearInterval(this.watchdog);
    this.retry = this.bgTimer = this.watchdog = null;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.close();
    this.setStatus("idle");
  }

  private onAppState = (s: AppStateStatus) => {
    if (s === "active") {
      if (this.bgTimer) clearTimeout(this.bgTimer);
      this.bgTimer = null;
      if (this.paused) {
        this.paused = false;
        this.backoff = 0;
        void this.connect();
      }
    } else if (!this.bgTimer && !this.stopped) {
      // battery: the socket closes after 30 s in the background and reopens on return
      this.bgTimer = setTimeout(() => {
        this.bgTimer = null;
        this.paused = true;
        this.close();
      }, 30_000);
    }
  };

  private setStatus(s: LiveStatus) {
    if (this.status === s) return;
    this.status = s;
    this.statusSubs.forEach((f) => f());
  }

  private schedule(ms: number) {
    if (this.retry) clearTimeout(this.retry);
    this.retry = setTimeout(() => {
      this.retry = null;
      void this.connect();
    }, ms);
  }

  private async connect() {
    if (this.stopped || this.paused || this.ws) return;
    if (!netStore.get().online) {
      this.setStatus("offline");
      return;
    }
    const gen = ++this.generation;
    if (this.status !== "live") this.setStatus("connecting");
    const t = await streamTicket(this.login);
    if (gen !== this.generation || this.stopped || this.paused) return;
    if (!t.ok) {
      if (permanent(t)) {
        this.setStatus("unavailable");
        return;
      }
      this.setStatus(netStore.get().online ? "connecting" : "offline");
      this.backoff = Math.min(Math.max(1_000, this.backoff * 2), 30_000);
      this.schedule(this.backoff);
      return;
    }
    const url = `${t.url}${t.url.includes("?") ? "&" : "?"}ticket=${encodeURIComponent(t.ticket)}`;
    let ws: WebSocket;
    try {
      ws = new WebSocket(url);
    } catch {
      this.schedule(Math.min(Math.max(1_000, (this.backoff *= 2)), 30_000));
      return;
    }
    this.ws = ws;
    this.lastFrame = Date.now();
    ws.onmessage = (e) => {
      if (this.ws !== ws) return;
      this.lastFrame = Date.now();
      let m: Frame;
      try {
        m = JSON.parse(String(e.data)) as Frame;
      } catch {
        return;
      }
      this.onFrame(m);
    };
    ws.onclose = () => {
      if (this.ws !== ws) return;
      this.ws = null;
      if (this.stopped || this.paused) return;
      this.setStatus(netStore.get().online ? "connecting" : "offline");
      this.backoff = Math.min(Math.max(500, this.backoff * 2), 15_000);
      this.schedule(this.backoff);
    };
    ws.onerror = () => ws.close();
  }

  private onFrame(m: Frame) {
    switch (m.type) {
      case "snapshot": {
        this.backoff = 0;
        this.tickets = new Set((m.positions ?? []).map((p) => p.ticket).filter((x): x is number => typeof x === "number"));
        const a = m.account ?? {};
        this.accountStatus = a.status ?? null;
        this.apply(num(a.equity) ?? this.money.equity, num(a.balance) ?? this.money.balance, this.tickets.size, true);
        this.setStatus("live");
        // the snapshot may follow a gap (reconnect): verdicts, days and trades may have moved meanwhile
        this.onEvent("resync");
        break;
      }
      case "equity":
        this.apply(num(m.equity) ?? this.money.equity, num(m.balance) ?? this.money.balance, this.tickets.size, true);
        break;
      case "account": {
        const a = m.account ?? {};
        this.apply(num(a.equity) ?? this.money.equity, num(a.balance) ?? this.money.balance, this.tickets.size, true);
        if (a.status && a.status !== this.accountStatus) {
          this.accountStatus = a.status;
          this.onEvent("status");
        }
        break;
      }
      case "position": {
        const ticket = m.op === "remove" ? m.ticket : m.position?.ticket;
        if (typeof ticket !== "number") break;
        if (m.op === "remove") this.tickets.delete(ticket);
        else this.tickets.add(ticket);
        this.apply(this.money.equity, this.money.balance, this.tickets.size, true);
        break;
      }
      case "deal":
        this.onEvent("deal");
        break;
      case "resync":
        this.onEvent("resync");
        break;
      case "ended":
        // "expired": the terminal session ran out (take a new one); "suspended": sign-in blocked by the broker
        this.close();
        if (m.reason === "expired") {
          void dropTradeSession(this.login).then(() => this.schedule(0));
        } else {
          this.setStatus("unavailable");
        }
        break;
      default:
        break; // hb, order, ledger, notification: the lastFrame stamp is all they are needed for here
    }
  }

  private apply(equity: number, balance: number, positions: number, live: boolean) {
    const prev = this.money;
    if (prev.equity === equity && prev.balance === balance && prev.positions === positions) return;
    this.money = { equity, balance, positions, at: live ? Date.now() : prev.at };
    this.equity.value = equity;
    this.balance.value = balance;
    if (!this.raf)
      this.raf = requestAnimationFrame(() => {
        this.raf = 0;
        this.subs.forEach((f) => f());
      });
  }

  private close() {
    const ws = this.ws;
    this.ws = null;
    if (ws) {
      ws.onclose = null;
      ws.onmessage = null;
      ws.onerror = null;
      try {
        ws.close();
      } catch {}
    }
  }

  private reopen() {
    this.close();
    this.schedule(0);
  }
}

/* ------------------------------------------------------------------ */
/* React                                                               */
/* ------------------------------------------------------------------ */

/**
 * The live stream of `login` while `active` (the screen is in front and the account is tradable); null login →
 * no stream. `onEvent` may change between renders. The instance is stable per login, so shared values are too.
 */
export function usePropLive(login: number | null, active: boolean, seed: { equity: number; balance: number; positions: number }, onEvent: (e: LiveEvent) => void): PropLive | null {
  const handler = React.useRef(onEvent);
  handler.current = onEvent;
  const seedRef = React.useRef(seed);
  seedRef.current = seed;
  const live = React.useMemo(() => (login === null ? null : new PropLive(login, (e) => handler.current(e), seedRef.current)), [login]);
  React.useEffect(() => {
    if (!live || !active) return;
    live.start();
    return () => live.stop();
  }, [live, active]);
  return live;
}

/** Live money for a leaf component (it alone re-renders, at most once per frame); null without a stream. */
export function useLiveMoney(live: PropLive | null): LiveMoney | null {
  const [m, setM] = React.useState<LiveMoney | null>(() => live?.money ?? null);
  React.useEffect(() => {
    if (!live) {
      setM(null);
      return;
    }
    setM(live.money);
    return live.subscribe(() => setM(live.money));
  }, [live]);
  return live ? m : null;
}

export function useLiveStatus(live: PropLive | null): LiveStatus {
  const [s, setS] = React.useState<LiveStatus>(() => live?.status ?? "idle");
  React.useEffect(() => {
    if (!live) {
      setS("idle");
      return;
    }
    setS(live.status);
    return live.onStatus(() => setS(live.status));
  }, [live]);
  return s;
}
