"use client";

import * as React from "react";
import { ArrowRight, Clock, Eye, Link2Off, Radio, UserRound } from "lucide-react";
import { getInstrument, priceFeed } from "@ezymex/mock";
import { Logo, SymbolAvatar, cn, useQuotes } from "@ezymex/ui";
import { PENDING_LABEL, SOURCE_LABEL, fmtServer, fmtVol, profitAt } from "@/lib/trading";
import { dateLabel, duration, shareTotals, signed, tradePct, tradePips, usd } from "@/lib/share-stats";
import type { PublicShare, ShareTrade } from "@/lib/share";
import { LiveMoney, Pnl } from "@/components/ui/primitives";
import { TradeMiniChart } from "@/components/share/mini-chart";

type Live = { price: number; pips: number; pct: number; profit: number };

function useNow(ms: number) {
  const [now, setNow] = React.useState<number | null>(null);
  React.useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

/** True once the price feed has live (or fallback) prices, so the page never flashes reference prices. */
function useFeedReady() {
  const [ready, setReady] = React.useState(false);
  React.useEffect(() => {
    const feed = priceFeed();
    feed.markHydrated();
    let alive = true;
    void feed.ready.then(() => alive && setReady(true));
    return () => {
      alive = false;
    };
  }, []);
  return ready;
}

function Page({ children, cta }: { children: React.ReactNode; cta: string }) {
  return (
    <div className="dark h-dvh overflow-y-auto bg-bg text-fg">
      <header className="sticky top-0 z-10 border-b border-line bg-bg/95">
        <div className="mx-auto flex h-14 max-w-[1120px] items-center gap-3 px-4 sm:px-6">
          <a href={cta} className="flex items-center gap-2.5" aria-label="Ezymex">
            <Logo height={18} />
            <span className="hidden border-l border-line pl-2.5 text-[12px] font-medium text-fg-3 sm:inline">Trader</span>
          </a>
          <a href={`${cta.replace(/\/$/, "")}/register`} className="ml-auto inline-flex h-8 items-center gap-1.5 rounded-[8px] bg-ember px-3 text-[12.5px] font-semibold text-white hover:brightness-110">
            Trade with Ezymex <ArrowRight className="size-3.5" />
          </a>
        </div>
      </header>
      <main className="mx-auto max-w-[1120px] px-4 pb-10 pt-5 sm:px-6 sm:pt-8">{children}</main>
    </div>
  );
}

export function Unavailable({ cta, busy }: { cta: string; busy?: boolean }) {
  return (
    <Page cta={cta}>
      <div className="mx-auto mt-10 max-w-[440px] rounded-[14px] border border-line bg-surface p-8 text-center sm:mt-20">
        <span className="mx-auto grid size-11 place-items-center rounded-full border border-line bg-surface-2 text-fg-3">
          <Link2Off className="size-5" />
        </span>
        <h1 className="mt-4 text-[18px] font-semibold">{busy ? "This link can't be loaded right now" : "This link is no longer available"}</h1>
        <p className="mt-2 text-[13px] leading-relaxed text-fg-2">
          {busy ? "Please try again in a moment." : "The trader may have revoked it, or it has expired. Ask them for a new link."}
        </p>
        <a href={`${cta.replace(/\/$/, "")}/register`} className="mt-6 inline-flex h-9 items-center gap-1.5 rounded-[8px] bg-ember px-4 text-[13px] font-semibold text-white hover:brightness-110">
          Trade with Ezymex <ArrowRight className="size-3.5" />
        </a>
      </div>
    </Page>
  );
}

export function ShareView({ initial, cta }: { initial: PublicShare; cta: string }) {
  const [s, setS] = React.useState(initial);
  const [gone, setGone] = React.useState(false);
  const ready = useFeedReady();
  const now = useNow(30_000);

  // pick up closes / modifications from the owner's terminal
  React.useEffect(() => {
    const t = setInterval(async () => {
      if (document.hidden) return;
      try {
        const res = await fetch(`/api/shares/public/${initial.code}`, { cache: "no-store" });
        if (res.status === 404) return setGone(true);
        if (res.ok) setS((await res.json()) as PublicShare);
      } catch {
        /* offline: keep the last data */
      }
    }, 15_000);
    return () => clearInterval(t);
  }, [initial.code]);

  const open = s.trades.filter((t) => t.status === "open");
  const pending = s.trades.filter((t) => t.status === "pending");
  const closed = s.trades.filter((t) => t.status === "closed" || t.status === "cancelled");
  const syms = [...new Set([...open, ...pending].map((t) => t.symbol))];
  const qs = useQuotes(syms.length ? syms : ["EURUSD"]);
  const live: Record<string, Live> = {};
  if (ready)
    for (const t of open) {
      const q = qs[t.symbol];
      if (!q || !q.bid) continue;
      const price = t.side === "buy" ? q.bid : q.ask;
      live[t.ticket] = { price, pips: tradePips(t, price), pct: tradePct(t, price), profit: profitAt(t, price) };
    }
  const tot = shareTotals(s.trades, live, s.show_amounts);

  if (gone) return <Unavailable cta={cta} />;
  return (
    <Page cta={cta}>
      {/* header card */}
      <section className="relative overflow-hidden rounded-[16px] border border-line bg-surface">
        <div className="h-[2px] bg-[linear-gradient(90deg,var(--k-ember),var(--k-gold)_60%,transparent)]" />
        <div className="p-5 sm:p-7">
          <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-fg-3">
            <span>Shared trades</span>
            {tot.open > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-ember/30 bg-ember-soft px-2 py-0.5 text-ember">
                <Radio className="size-3" /> Live
              </span>
            )}
          </div>
          <h1 className="mt-2 text-[24px] font-semibold leading-tight tracking-[-0.01em] sm:text-[30px]">{s.title}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12.5px] text-fg-2">
            <span className="flex items-center gap-2">
              <span className="grid size-6 place-items-center rounded-full bg-surface-3 text-gold">
                <UserRound className="size-3.5" />
              </span>
              <span className="font-mono">{s.alias}</span>
            </span>
            {s.account && <span className="rounded-[5px] border border-line bg-surface-2 px-1.5 py-0.5 text-[11px] text-fg-2">{s.account}</span>}
            <span className="text-fg-3">Shared {dateLabel(s.created_at)}</span>
            <span className="flex items-center gap-1 text-fg-3">
              <Eye className="size-3.5" /> <span className="k-num font-mono">{s.views.toLocaleString("en-US")}</span>
            </span>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-[12px] border border-line bg-line lg:grid-cols-4">
            <Stat label="Trades" value={String(s.trades.length)} sub={[tot.open && `${tot.open} open`, tot.pending && `${tot.pending} pending`, tot.closed && `${tot.closed} closed`].filter(Boolean).join(" · ") || "—"} />
            <Stat label="Win rate" value={tot.winRate === null ? "—" : `${tot.winRate.toFixed(0)}%`} sub={tot.closed ? `${tot.wins} of ${tot.closed} closed in profit` : "No closed trades yet"} tone={tot.winRate === null ? undefined : tot.winRate >= 50 ? "up" : "down"} />
            <Stat label="Total pips" value={<LiveMoney value={tot.pips} format={(v) => signed(v)} />} sub={<LiveMoney value={tot.pct} format={(v) => `${signed(v, 2)}% price move`} />} tone={tot.pips > 0 ? "up" : tot.pips < 0 ? "down" : undefined} />
            {tot.profit !== null ? (
              <Stat label="Total P&L" value={<Pnl value={tot.profit} text={usd(tot.profit)} format={usd} />} sub={tot.open ? "Includes live open P&L" : "Realised, USD"} />
            ) : (
              <Stat label="Result" value={<LiveMoney value={tot.pct} format={(v) => `${signed(v, 2)}%`} />} sub="Money amounts hidden by the trader" tone={tot.pct > 0 ? "up" : tot.pct < 0 ? "down" : undefined} />
            )}
          </div>
        </div>
      </section>

      {open.length > 0 && (
        <Section title="Open positions" count={open.length} hint="Live prices">
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {open.map((t) => (
              <OpenCard key={`${t.ticket}-open`} t={t} live={live[t.ticket]} money={s.show_amounts} now={now} />
            ))}
          </div>
        </Section>
      )}

      {pending.length > 0 && (
        <Section title="Pending orders" count={pending.length}>
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {pending.map((t) => (
              <PendingCard key={`${t.ticket}-pending`} t={t} price={ready ? (t.side === "buy" ? qs[t.symbol]?.ask : qs[t.symbol]?.bid) : undefined} />
            ))}
          </div>
        </Section>
      )}

      {closed.length > 0 && (
        <Section title="Closed trades" count={closed.length}>
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {closed.map((t) => (
              <ClosedCard key={`${t.ticket}-${t.status}-${t.closeTime ?? ""}`} t={t} money={s.show_amounts} />
            ))}
          </div>
        </Section>
      )}

      <section className="mt-8 flex flex-col items-start gap-4 rounded-[14px] border border-line bg-surface p-5 sm:flex-row sm:items-center sm:p-6">
        <div className="min-w-0 flex-1">
          <div className="text-[15px] font-semibold">Trade forex, gold, indices and crypto with Ezymex</div>
          <div className="mt-1 text-[12.5px] text-fg-2">Raw spreads, fast execution and the same Ezymex Trader terminal these trades were placed on.</div>
        </div>
        <a href={`${cta.replace(/\/$/, "")}/register`} className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-[9px] bg-ember px-4 text-[13px] font-semibold text-white hover:brightness-110">
          Open an account <ArrowRight className="size-4" />
        </a>
      </section>

      <footer className="mt-6 space-y-1.5 text-[11px] leading-relaxed text-fg-3">
        <p>
          Shared from Ezymex Trader by {s.alias}. Live P&L is estimated from Ezymex market prices, before swap and commission. Times are server time (GMT+3). Last updated {fmtServer(s.updated_at, false)}.
        </p>
        <p>CFDs are complex instruments and come with a high risk of losing money rapidly due to leverage. Past performance is not a reliable indicator of future results. Nothing here is investment advice.</p>
      </footer>
    </Page>
  );
}

function Stat({ label, value, sub, tone }: { label: string; value: React.ReactNode; sub: React.ReactNode; tone?: "up" | "down" }) {
  return (
    <div className="min-w-0 bg-surface-2 px-4 py-3.5">
      <div className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-fg-3">{label}</div>
      <div className={cn("k-num mt-1 truncate font-mono text-[20px] font-semibold sm:text-[22px]", tone === "up" && "text-up", tone === "down" && "text-down")}>{value}</div>
      <div className="mt-0.5 truncate text-[11px] text-fg-3">{sub}</div>
    </div>
  );
}

function Section({ title, count, hint, children }: { title: string; count: number; hint?: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <div className="mb-3 flex items-baseline gap-2">
        <h2 className="text-[15px] font-semibold">{title}</h2>
        <span className="k-num rounded-[5px] bg-surface-3 px-1.5 font-mono text-[11px] text-fg-2">{count}</span>
        {hint && <span className="ml-auto text-[11px] text-fg-3">{hint}</span>}
      </div>
      {children}
    </section>
  );
}

function SideChip({ t }: { t: ShareTrade }) {
  const buy = t.side === "buy";
  const label = t.status === "pending" && t.orderType && t.orderType !== "market" ? PENDING_LABEL({ side: t.side, type: t.orderType }) : t.side;
  return (
    <span className={cn("inline-flex h-5 items-center gap-1 rounded-[5px] px-1.5 text-[10.5px] font-semibold uppercase tracking-[0.04em]", buy ? "bg-up-soft text-up" : "bg-down-soft text-down")}>
      {label} <span className="k-num font-mono font-medium opacity-80">{fmtVol(t.volume)}</span>
    </span>
  );
}

function CardHead({ t, right }: { t: ShareTrade; right: React.ReactNode }) {
  const inst = getInstrument(t.symbol);
  return (
    <div className="flex items-start gap-3 px-4 pt-4">
      <SymbolAvatar symbol={t.symbol} size={34} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[15px] font-semibold">{t.symbol}</span>
          <SideChip t={t} />
          {t.source !== "manual" && <span className="rounded-[4px] border border-line px-1 text-[9.5px] font-semibold uppercase tracking-[0.05em] text-fg-3">{SOURCE_LABEL[t.source]}</span>}
        </div>
        <div className="mt-0.5 truncate text-[12px] text-fg-3">{inst.name}</div>
      </div>
      <div className="shrink-0 text-right">{right}</div>
    </div>
  );
}

function Levels({ items }: { items: { k: string; v: React.ReactNode; tone?: "up" | "down" | "gold" }[] }) {
  return (
    <div className="mx-4 mt-3 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-line/70 pt-3 sm:grid-cols-4">
      {items.map((i) => (
        <div key={i.k} className="min-w-0">
          <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-fg-3">{i.k}</div>
          <div className={cn("k-num mt-0.5 truncate font-mono text-[12.5px] text-fg", i.tone === "up" && "text-up", i.tone === "down" && "text-down", i.tone === "gold" && "text-gold")}>{i.v}</div>
        </div>
      ))}
    </div>
  );
}

const px = (t: ShareTrade, v: number | undefined) => (v === undefined ? "—" : v.toFixed(getInstrument(t.symbol).digits));

function OpenCard({ t, live, money, now }: { t: ShareTrade; live?: Live; money: boolean; now: number | null }) {
  const digits = getInstrument(t.symbol).digits;
  return (
    <article className="overflow-hidden rounded-[14px] border border-line bg-surface">
      <CardHead
        t={t}
        right={
          live ? (
            <>
              <div className="text-[17px] font-semibold">
                {money ? <Pnl value={live.profit} text={usd(live.profit)} format={usd} arrow /> : <Pnl value={live.pips} text={`${signed(live.pips)} pips`} format={(v) => `${signed(v)} pips`} arrow />}
              </div>
              <div className={cn("k-num mt-0.5 font-mono text-[11.5px]", live.pct >= 0 ? "text-up/80" : "text-down/80")}>
                {money ? `${signed(live.pips)} pips · ` : ""}
                {signed(live.pct, 2)}%
              </div>
            </>
          ) : (
            <div className="font-mono text-[15px] text-fg-3">—</div>
          )
        }
      />
      <Levels
        items={[
          { k: "Entry", v: px(t, t.openPrice), tone: "gold" },
          { k: "Current", v: live ? <LiveMoney value={live.price} format={(v) => v.toFixed(digits)} /> : "—" },
          { k: "Stop loss", v: px(t, t.sl), tone: t.sl !== undefined ? "down" : undefined },
          { k: "Take profit", v: px(t, t.tp), tone: t.tp !== undefined ? "up" : undefined },
        ]}
      />
      <div className="mt-3 px-2">
        <TradeMiniChart trade={t} />
      </div>
      <div className="flex items-center gap-1.5 border-t border-line/70 px-4 py-2.5 text-[11.5px] text-fg-3">
        <Clock className="size-3.5" />
        Opened {fmtServer(t.openTime, false)}
        {now !== null && <span className="ml-auto font-mono">running {duration(now - Date.parse(t.openTime))}</span>}
      </div>
    </article>
  );
}

function PendingCard({ t, price }: { t: ShareTrade; price?: number }) {
  const digits = getInstrument(t.symbol).digits;
  const dist = price !== undefined ? tradePips({ ...t, side: "buy" }, price) : undefined;
  return (
    <article className="overflow-hidden rounded-[14px] border border-line bg-surface">
      <CardHead
        t={t}
        right={
          <>
            <div className="k-num font-mono text-[16px] font-semibold text-gold">{t.openPrice.toFixed(digits)}</div>
            <div className="mt-0.5 text-[11.5px] text-fg-3">order price</div>
          </>
        }
      />
      <Levels
        items={[
          { k: "Market", v: price !== undefined ? <LiveMoney value={price} format={(v) => v.toFixed(digits)} /> : "—" },
          { k: "Distance", v: dist !== undefined ? `${Math.abs(dist).toFixed(1)} pips` : "—" },
          { k: "Stop loss", v: px(t, t.sl), tone: t.sl !== undefined ? "down" : undefined },
          { k: "Take profit", v: px(t, t.tp), tone: t.tp !== undefined ? "up" : undefined },
        ]}
      />
      <div className="mt-3 px-2">
        <TradeMiniChart trade={t} />
      </div>
      <div className="flex items-center gap-1.5 border-t border-line/70 px-4 py-2.5 text-[11.5px] text-fg-3">
        <Clock className="size-3.5" /> Placed {fmtServer(t.openTime, false)}
      </div>
    </article>
  );
}

const REASON: Record<string, string> = { sl: "Stop loss", tp: "Take profit", manual: "Closed manually", netting: "Netted", "close by": "Close by" };

function ClosedCard({ t, money }: { t: ShareTrade; money: boolean }) {
  if (t.status === "cancelled")
    return (
      <article className="rounded-[14px] border border-line bg-surface pb-4 opacity-75">
        <CardHead t={t} right={<span className="rounded-[5px] border border-line px-1.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.05em] text-fg-3">Cancelled</span>} />
        <Levels items={[{ k: "Order", v: px(t, t.openPrice), tone: "gold" }, { k: "Placed", v: fmtServer(t.openTime, false) }, { k: "Stop loss", v: px(t, t.sl) }, { k: "Take profit", v: px(t, t.tp) }]} />
      </article>
    );
  const exit = t.closePrice!;
  const pips = t.pips ?? tradePips(t, exit);
  const pct = tradePct(t, exit);
  const win = (t.profit ?? pips) > 0;
  return (
    <article className="overflow-hidden rounded-[14px] border border-line bg-surface">
      <CardHead
        t={t}
        right={
          <>
            <div className={cn("k-num font-mono text-[17px] font-semibold", win ? "text-up" : "text-down")}>{money && t.profit !== undefined ? usd(t.profit) : `${signed(pips)} pips`}</div>
            <div className="mt-0.5 flex items-center justify-end gap-1.5">
              <span className={cn("rounded-[4px] px-1 text-[9.5px] font-bold uppercase tracking-[0.06em]", win ? "bg-up-soft text-up" : "bg-down-soft text-down")}>{win ? "Win" : "Loss"}</span>
              <span className={cn("k-num font-mono text-[11.5px]", win ? "text-up/80" : "text-down/80")}>
                {money && t.profit !== undefined ? `${signed(pips)} pips · ` : ""}
                {signed(pct, 2)}%
              </span>
            </div>
          </>
        }
      />
      <Levels
        items={[
          { k: "Entry", v: px(t, t.openPrice), tone: "gold" },
          { k: "Exit", v: px(t, exit) },
          { k: "Duration", v: duration(Date.parse(t.closeTime!) - Date.parse(t.openTime)) },
          { k: "Closed by", v: REASON[t.reason ?? "manual"] ?? t.reason },
        ]}
      />
      <div className="mt-3 px-2">
        <TradeMiniChart trade={t} />
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-line/70 px-4 py-2.5 text-[11.5px] text-fg-3">
        <Clock className="size-3.5" />
        <span>
          {fmtServer(t.openTime, false)} → {fmtServer(t.closeTime!, false)}
        </span>
        <span className="ml-auto font-mono">
          SL {px(t, t.sl)} · TP {px(t, t.tp)}
        </span>
      </div>
    </article>
  );
}
