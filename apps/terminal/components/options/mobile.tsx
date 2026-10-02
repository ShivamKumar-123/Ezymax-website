"use client";

// Options mode on phones and small tablets (< 1024 px), the same idea as the desktop panels in tabs: Instruments
// (pick the underlying) · Chart (the selected option's premium, or the underlying) · Chain (pick a strike's call or
// put) · Trade (the ticket: Sell at the bid / Buy at the ask, or simple mode) · Positions (open options and
// settlements). The expiry bar (Daily | Weekly | Monthly + any date) sits over the chart and the chain; once an
// option is selected a bar with its bid and ask follows at the bottom, and Sell / Buy there opens the ticket with
// that side chosen. Loaded on demand like the desktop workspace. While the order book is live the Chart tab also shows
// the selected option's Book (depth + trades) and Positions lists the working book orders. The Chart tab's toggle also
// opens Analytics: the volatility smile, term structure, open interest, put / call and the what-if P&L.
import * as React from "react";
import { CandlestickChart, ChevronRight, Layers, List, ShoppingCart, Table2, Wand2 } from "lucide-react";
import { OPTION_SPEC, parseSeriesCode } from "@kalks/mock/options";
import { cn } from "@kalks/ui";
import { useLocale, useT } from "@kalks/i18n/react";
import { useTerminal } from "@/lib/store";
import { Pnl } from "@/components/ui/primitives";
import { GuestNotice } from "@/components/shell/guest";
import { useOptionBook } from "@/lib/options/book";
import { bookApi } from "@/lib/options/book-api";
import { bookOrders, useBookOrders } from "@/lib/options/book-orders";
import { errText } from "@/lib/options/errors";
import { toast } from "@/lib/notify";
import { opt, useBookLive, useOpt, useOptionsAttach, useSeriesQuote, type SidePanel } from "@/lib/options-store";
import type { BookOrder, OptPosition } from "@/lib/options/types";
import { BookBadge, OrderStatusChip, qty as qtyText, useSeriesUnits, useTypeLabel } from "./book-bits";
import { BookPane } from "./depth";
import { ClosedList } from "./closed-tab";
import { Flash, OptAvatar, OptionsUnavailable, RightTag, Seg, SideTag } from "./bits";
import { StrategyBuilder } from "./builder";
import { OptionChainTable } from "./chain";
import { useOptionEvents, StreamDot } from "./desktop";
import { AnalyticsPane } from "./analytics";
import { ExpiryBar } from "./expiry-bar";
import { expiryLabel, strikeText, usd, usdSigned } from "./format";
import { FeedChange, SpotPrice } from "./header";
import { InstrumentList } from "./instruments";
import { closeOptionPosition, useOptionPositionLive } from "./positions-tab";
import { OptionChartPane } from "./premium-chart";
import { SettlementsTab } from "./settlements-tab";
import { SimpleMode } from "./simple";
import { OptionTicket } from "./ticket";

type MTab = "instruments" | "chart" | "chain" | "trade" | "positions";

export function OptionsMobile() {
  const T = useTerminal();
  const t = useT();
  useOptionsAttach({ login: T.account.login, guest: T.guest, engine: T.engine, readOnly: T.readOnly });
  useOptionEvents(T.guest ? null : T.account.login);
  const avail = useOpt((s) => s.avail);
  const u = useOpt((s) => s.u);
  const view = useOpt((s) => s.prefs.view);
  const panel = useOpt((s) => s.prefs.panel);
  const legs = useOpt((s) => s.ticket.legs);
  const chainSpot = useOpt((s) => s.chain?.spot?.mid);
  const publicView = useOpt((s) => s.publicView);
  const book = useOptionBook(T.guest ? null : T.account.login);
  const bookLive = useBookLive();
  const orders = useBookOrders(T.guest ? null : T.account.login, bookLive);
  const [tab, setTab] = React.useState<MTab>("chain");
  const [posView, setPosView] = React.useState<"open" | "orders" | "closed" | "settled">("open");
  const [chartView, setChartView] = React.useState<"chart" | "book" | "analytics">("chart");

  const tabs: { id: MTab; label: string; icon: React.ReactNode; count?: number }[] = [
    { id: "instruments", label: t("trader.opt.inst.title"), icon: <List /> },
    { id: "chart", label: t("trader.opt.chart"), icon: <CandlestickChart /> },
    { id: "chain", label: t("trader.opt.m.chain"), icon: <Table2 /> },
    { id: "trade", label: t("trader.mobile.tab.trade"), icon: <ShoppingCart />, count: legs.length > 1 ? legs.length : undefined },
    { id: "positions", label: t("trader.opt.m.positions"), icon: <Layers />, count: book.positions.length },
  ];

  if (avail === "soon" || avail === "error") return <OptionsUnavailable kind={avail} onRetry={() => opt.retry()} />;

  const withHeader = tab === "chart" || tab === "chain" || tab === "trade";
  return (
    <div className="flex h-full min-h-0 flex-col">
      {withHeader && (
        <div className="flex h-11 shrink-0 items-center gap-2 border-b border-line bg-panel px-2">
          <button onClick={() => setTab("instruments")} aria-label={t("trader.opt.pickUnderlying")} className="flex h-8 min-w-0 items-center gap-2 rounded-[7px] border border-line bg-surface-2 ps-2 pe-1.5">
            <OptAvatar symbol={u} size={15} />
            <span className="text-[13px] font-semibold">{u}</span>
            <SpotPrice symbol={u} className="text-[12.5px]" fallback={chainSpot} />
            <FeedChange symbol={u} />
            <ChevronRight className="size-3.5 text-fg-3" />
          </button>
          <span className="ms-auto flex items-center gap-1">
            {bookLive && <BookBadge />}
            <StreamDot />
            {!publicView && (
              <button onClick={() => opt.openBuilder(true)} aria-label={t("trader.opt.builder.open")} className="grid size-8 place-items-center rounded-[7px] bg-ember text-white">
                <Wand2 className="size-4" />
              </button>
            )}
          </span>
        </div>
      )}
      {(tab === "chart" || tab === "chain") && <ExpiryBar compact className="bg-panel" />}
      {tab === "chart" && (
        <div className="shrink-0 border-b border-line bg-panel px-2 py-1.5">
          <Seg
            value={chartView === "book" && !bookLive ? "chart" : chartView}
            onChange={setChartView}
            options={[
              { value: "chart", label: t("trader.opt.chart") },
              ...(bookLive ? [{ value: "book" as const, label: t("trader.opt.book.tab") }] : []),
              { value: "analytics", label: t("trader.opt.an.tab") },
            ]}
          />
        </div>
      )}
      {tab === "chain" && (
        <div className="shrink-0 border-b border-line bg-panel px-2 py-1.5">
          <Seg
            value={view === "puts" ? "puts" : "calls"}
            onChange={(v) => opt.setPrefs({ view: v })}
            options={[
              { value: "calls", label: t("trader.opt.calls"), tone: "up" },
              { value: "puts", label: t("trader.opt.puts"), tone: "down" },
            ]}
          />
        </div>
      )}
      <main className="min-h-0 flex-1 overflow-hidden">
        {tab === "instruments" && <InstrumentList mobile onPick={() => setTab("chain")} />}
        {tab === "chart" && (chartView === "analytics" ? <AnalyticsPane compact onOpenChain={() => setTab("chain")} /> : bookLive && chartView === "book" ? <BookPane compact /> : <OptionChartPane compact />)}
        {tab === "chain" && <OptionChainTable compact />}
        {tab === "trade" && (
          <div className="flex h-full min-h-0 flex-col">
            <div className="shrink-0 border-b border-line px-2 py-1.5">
              <Seg<SidePanel>
                value={panel}
                onChange={(v) => opt.setPrefs({ panel: v })}
                options={[
                  { value: "ticket", label: t("trader.opt.ticket.tab") },
                  { value: "simple", label: t("trader.opt.simple.tab") },
                ]}
              />
            </div>
            <div className="t-scroll min-h-0 flex-1 overflow-y-auto">{panel === "simple" ? <SimpleMode /> : <OptionTicket onAddLeg={() => setTab("chain")} onOpenChain={() => setTab("chain")} />}</div>
          </div>
        )}
        {tab === "positions" &&
          (T.guest ? (
            <GuestNotice icon={<Layers />} text={t("trader.opt.guest.text")} />
          ) : (
            <div className="flex h-full min-h-0 flex-col">
              <div className="shrink-0 border-b border-line px-2 py-1.5">
                <Seg
                  value={posView === "orders" && !bookLive ? "open" : posView}
                  onChange={setPosView}
                  options={[
                    { value: "open", label: `${t("trader.opt.m.positions")}${book.positions.length ? ` · ${book.positions.length}` : ""}` },
                    ...(bookLive ? [{ value: "orders" as const, label: `${t("trader.opt.ord.tab")}${orders.open.length ? ` · ${orders.open.length}` : ""}` }] : []),
                    { value: "closed", label: t("trader.opt.hist.tab") },
                    { value: "settled", label: t("trader.opt.set.tab") },
                  ]}
                />
              </div>
              <div className="min-h-0 flex-1">{posView === "open" || (posView === "orders" && !bookLive) ? <MPositions positions={book.positions} onOpenChain={() => setTab("chain")} /> : posView === "orders" ? <MOrders orders={orders.open} loaded={orders.loaded} /> : posView === "closed" ? <ClosedList /> : <SettlementsTab />}</div>
            </div>
          ))}
      </main>
      {(tab === "chain" || (tab === "chart" && chartView !== "analytics")) && <SelectionBar onTrade={() => setTab("trade")} />}
      <nav className="grid h-[58px] shrink-0 grid-cols-5 border-t border-line bg-panel pb-[env(safe-area-inset-bottom)]">
        {tabs.map((x) => (
          <button key={x.id} onClick={() => setTab(x.id)} className={cn("relative flex min-w-0 flex-col items-center justify-center gap-0.5 px-0.5 text-[10px] [&_svg]:size-[17px]", tab === x.id ? "text-ember" : "text-fg-3")}>
            {tab === x.id && <span className="absolute inset-x-4 top-0 h-[2px] rounded-full bg-ember" />}
            {x.icon}
            <span className="max-w-full truncate">{x.label}</span>
            {!!x.count && <span className="absolute right-[18%] top-1 grid h-3.5 min-w-3.5 place-items-center rounded-full bg-ember px-1 font-mono text-[9px] text-white">{x.count}</span>}
          </button>
        ))}
      </nav>
      <StrategyBuilder />
    </div>
  );
}

/** The selected option with its bid and ask: Sell / Buy open the ticket with that side chosen. */
function SelectionBar({ onTrade }: { onTrade: () => void }) {
  const t = useT();
  const { locale } = useLocale();
  const legs = useOpt((s) => s.ticket.legs);
  const sel = useOpt((s) => s.sel);
  const one = legs.length === 1 ? legs[0]! : null;
  const code = one?.series ?? null;
  const q = useSeriesQuote(code);
  if (legs.length > 1)
    return (
      <button onClick={onTrade} className="mx-2 mb-2 flex h-10 shrink-0 items-center justify-between rounded-[9px] bg-ember px-3 text-[12.5px] font-semibold text-white shadow-[0_10px_30px_-12px_rgba(255,90,31,0.9)]">
        <span>{t("trader.opt.ticket.strategy", { count: legs.length })}</span>
        <span>{t("trader.opt.ticket.review")}</span>
      </button>
    );
  const p = parseSeriesCode(code ?? sel ?? "");
  if (!one || !p) return null;
  const side = (s: "buy" | "sell") => {
    opt.arm(s);
    onTrade();
  };
  return (
    <div className="grid shrink-0 grid-cols-[1fr_auto_auto] items-center gap-1.5 border-t border-line bg-panel px-2 py-1.5">
      <button onClick={onTrade} className="flex min-w-0 items-center gap-1.5 text-start">
        <RightTag right={p.right} />
        <span className="min-w-0 leading-tight">
          <span className="block truncate font-mono text-[12.5px] font-semibold">
            {p.underlying} {p.strikeLabel}
          </span>
          <span className="block truncate text-[10px] text-fg-3">{expiryLabel(p.date, locale)}</span>
        </span>
      </button>
      <button onClick={() => side("sell")} disabled={!q} title={t("trader.opt.clickSell")} className="min-w-[86px] rounded-[8px] bg-down px-2 py-1 text-start text-white disabled:opacity-50">
        <div className="text-[9px] font-semibold uppercase tracking-[0.1em] opacity-85">{t("common.sell")}</div>
        <div className="k-num font-mono text-[13.5px] font-semibold leading-tight">
          <Flash value={q?.bidUsd ?? 0}>{q && q.bidUsd > 0 ? usd(q.bidUsd) : "—"}</Flash>
        </div>
      </button>
      <button onClick={() => side("buy")} disabled={!q} title={t("trader.opt.clickBuy")} className="min-w-[86px] rounded-[8px] bg-up px-2 py-1 text-end text-white disabled:opacity-50">
        <div className="text-[9px] font-semibold uppercase tracking-[0.1em] opacity-85">{t("common.buy")}</div>
        <div className="k-num font-mono text-[13.5px] font-semibold leading-tight">
          <Flash value={q?.askUsd ?? 0}>{q && q.askUsd > 0 ? usd(q.askUsd) : "—"}</Flash>
        </div>
      </button>
    </div>
  );
}

function MPositions({ positions, onOpenChain }: { positions: OptPosition[]; onOpenChain: () => void }) {
  const t = useT();
  if (!positions.length)
    return (
      <div className="p-8 text-center text-[12.5px] text-fg-3">
        {t("trader.opt.pos.empty")}
        <div className="mt-3">
          <button onClick={onOpenChain} className="inline-flex h-8 items-center gap-1.5 rounded-[8px] bg-ember px-3 text-[12px] font-semibold text-white">
            <Table2 className="size-3.5" /> {t("trader.opt.pos.openWorkspace")}
          </button>
        </div>
      </div>
    );
  return (
    <div className="t-scroll h-full space-y-1.5 overflow-y-auto p-2">
      {positions.map((p) => (
        <MPositionCard key={p.ticket} p={p} />
      ))}
    </div>
  );
}

function MPositionCard({ p }: { p: OptPosition }) {
  const T = useTerminal();
  const t = useT();
  const { locale } = useLocale();
  const v = useOptionPositionLive(p);
  const [busy, setBusy] = React.useState(false);
  return (
    <div className="rounded-[9px] border border-line bg-panel p-2.5">
      <div className="flex items-center gap-2">
        <OptAvatar symbol={p.option.underlying} size={16} />
        <span className="text-[13px] font-semibold">{p.option.underlying}</span>
        <span className="font-mono text-[12.5px]">{strikeText(p.option.strike, OPTION_SPEC[p.option.underlying]?.digits ?? 5)}</span>
        <RightTag right={p.option.right} />
        <span className="text-[11px] text-fg-3">{expiryLabel(p.option.expiry, locale, false)}</span>
        <span className="ms-auto text-[14px] font-semibold">
          <Pnl value={v.profit} text={usdSigned(v.profit)} format={(x) => usdSigned(x)} />
        </span>
      </div>
      <div className="mt-1.5 flex items-center gap-3 font-mono text-[11px] text-fg-3">
        <SideTag side={p.side} />
        <span>× {p.contracts}</span>
        <span>
          {t("trader.opt.col.openPremium")} <span className="text-fg-2">{usd(v.openUsd)}</span>
        </span>
        <span>
          {t("trader.opt.col.mark")} <span className="text-fg-2">{v.markUsd !== undefined ? usd(v.markUsd) : "—"}</span>
        </span>
        {!T.readOnly && (
          <button disabled={busy} onClick={() => (setBusy(true), void closeOptionPosition(T, t, p).finally(() => setBusy(false)))} className="ms-auto h-7 rounded-[6px] border border-line px-2.5 font-sans text-[11.5px] font-medium text-fg-2 hover:border-down/50 hover:text-down disabled:opacity-50">
            {t("trader.opt.pos.close")}
          </button>
        )}
      </div>
    </div>
  );
}

/** Working book orders as cards (phones): price, size, filled, status, cancel. */
function MOrders({ orders, loaded }: { orders: BookOrder[]; loaded: boolean }) {
  const t = useT();
  if (!orders.length) return <div className="p-8 text-center text-[12.5px] text-fg-3">{loaded ? t("trader.opt.ord.emptyOpen") : t("trader.opt.ord.loading")}</div>;
  return (
    <div className="t-scroll h-full space-y-1.5 overflow-y-auto p-2">
      {orders.map((o) => (
        <MOrderCard key={o.id} o={o} />
      ))}
    </div>
  );
}

function MOrderCard({ o }: { o: BookOrder }) {
  const T = useTerminal();
  const t = useT();
  const { locale } = useLocale();
  const units = useSeriesUnits(o.series);
  const typeLabel = useTypeLabel();
  const [busy, setBusy] = React.useState(false);
  const p = parseSeriesCode(o.series.split("-").slice(0, 4).join("-"));
  const cancel = async () => {
    setBusy(true);
    const r = await bookApi.cancel(T.account.login, o.id);
    setBusy(false);
    if (!r.ok) return void toast.error(t("trader.opt.toast.cancelRejected"), { description: errText(r.err) });
    toast(t("trader.opt.toast.cancelled"), { description: `#${o.id} ${o.series}` });
    void bookOrders.refresh(T.account.login);
  };
  return (
    <div className="rounded-[9px] border border-line bg-panel p-2.5">
      <div className="flex items-center gap-2">
        {p && <OptAvatar symbol={p.underlying} size={16} />}
        <span className="text-[13px] font-semibold">{p?.underlying ?? o.series}</span>
        {p && <span className="font-mono text-[12.5px]">{p.strikeLabel}</span>}
        {p && <RightTag right={p.right} />}
        {p && <span className="text-[11px] text-fg-3">{expiryLabel(p.date, locale, false)}</span>}
        <OrderStatusChip status={o.trigger && o.status === "working" ? "pending" : o.status} className="ms-auto" />
      </div>
      <div className="mt-1.5 flex items-center gap-3 font-mono text-[11px] text-fg-3">
        <SideTag side={o.side} />
        <span className="font-sans text-fg-2">{typeLabel(o.type)}</span>
        <span>
          {o.price !== null ? usd(o.price * units.k) : "—"} × {qtyText(o.qty)}
        </span>
        <span>{t("trader.opt.ord.filledOf", { n: qtyText(o.filled), total: qtyText(o.qty) })}</span>
        {!T.readOnly && (
          <button disabled={busy} onClick={() => void cancel()} className="ms-auto h-7 rounded-[6px] border border-line px-2.5 font-sans text-[11.5px] font-medium text-fg-2 hover:border-down/50 hover:text-down disabled:opacity-50">
            {t("trader.opt.pos.cancel")}
          </button>
        )}
      </div>
    </div>
  );
}
