"use client";

// Options mode on phones and small tablets (< 1024 px), the same idea as the desktop panels in tabs:
//   Markets    pick the underlying
//   Chart      the selected option's premium, or the underlying (and Book / Analytics)
//   Chain      pick a strike's call or put (Simple: call price | strike | put price; more columns one side at a time)
//   Trade      Quick trade (the guided Up or Down → date → amount → outcome) or the full order ticket
//   Positions  open options as cards, working book orders, closed trades and settlements
// The expiry chips sit over the chart and the chain; once an option is selected a bar with its sell / buy prices
// follows at the bottom, and Sell / Buy there opens the ticket with that side chosen. Loaded on demand like the
// desktop workspace.
import * as React from "react";
import { CandlestickChart, ChevronDown, Layers, List, ShoppingCart, Table2, Wand2 } from "lucide-react";
import { parseSeriesCode } from "@kalks/mock/options";
import { cn } from "@kalks/ui";
import { useLocale, useT } from "@kalks/i18n/react";
import { useTerminal } from "@/lib/store";
import { GuestNotice } from "@/components/shell/guest";
import { useOptionBook } from "@/lib/options/book";
import { bookApi } from "@/lib/options/book-api";
import { bookOrders, useBookOrders } from "@/lib/options/book-orders";
import { errText } from "@/lib/options/errors";
import { toast } from "@/lib/notify";
import { opt, useBookLive, useOpt, useOptionsAttach, useSeriesQuote, type ChainView, type SidePanel } from "@/lib/options-store";
import type { BookOrder } from "@/lib/options/types";
import { BookBadge, OrderStatusChip, qty as qtyText, useSeriesUnits, useTypeLabel } from "./book-bits";
import { BookPane } from "./depth";
import { ClosedList } from "./closed-tab";
import { Flash, OptAvatar, OptionsUnavailable, Seg } from "./bits";
import { StrategyBuilder } from "./builder";
import { ColumnsMenu, OptionChainTable, useChainCols } from "./chain";
import { useOptionEvents, StreamDot } from "./desktop";
import { AnalyticsPane } from "./analytics";
import { HowItWorks } from "./explain";
import { ExpiryBar } from "./expiry-bar";
import { cutWhen, expiryLabel, money, usd } from "./format";
import { FeedChange, SpotPrice } from "./header";
import { InstrumentList } from "./instruments";
import { OptionPositionsList } from "./positions-tab";
import { OptionChartPane } from "./premium-chart";
import { SettlementsTab } from "./settlements-tab";
import { SimpleMode } from "./simple";
import { OptionTicket } from "./ticket";

type MTab = "instruments" | "chart" | "chain" | "trade" | "positions";

export function OptionsMobile() {
  const T = useTerminal();
  const t = useT();
  useOptionsAttach({ login: T.account.login, guest: T.guest, engine: T.engine, readOnly: T.readOnly });
  useOptionEvents(T.guest ? null : T.account.login, !!T.account.cent);
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
  const cols = useChainCols();
  const [tab, setTab] = React.useState<MTab>(() => (panel === "simple" ? "trade" : "chain"));
  const [posView, setPosView] = React.useState<"open" | "orders" | "closed" | "settled">("open");
  const [chartView, setChartView] = React.useState<"chart" | "book" | "analytics">("chart");
  const oneCol = cols.length <= 1;

  const tabs: { id: MTab; label: string; icon: React.ReactNode; count?: number }[] = [
    { id: "instruments", label: t("trader.opt.m.markets"), icon: <List /> },
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
        <div className="flex h-12 shrink-0 items-center gap-2 border-b border-line bg-panel px-2">
          <button onClick={() => setTab("instruments")} aria-label={t("trader.opt.pickUnderlying")} className="flex h-9 min-w-0 items-center gap-2 rounded-[10px] border border-line bg-surface-2 ps-2 pe-2">
            <OptAvatar symbol={u} size={18} />
            <span className="text-[14px] font-semibold">{u}</span>
            <SpotPrice symbol={u} className="text-[13px]" fallback={chainSpot} />
            <FeedChange symbol={u} />
            <ChevronDown className="size-3.5 shrink-0 text-fg-3" />
          </button>
          <span className="ms-auto flex items-center gap-1.5">
            {bookLive && <BookBadge />}
            <StreamDot />
            <HowItWorks compact className="h-9 w-9 justify-center rounded-[10px] px-0" />
            {!publicView && (
              <button onClick={() => opt.openBuilder(true)} aria-label={t("trader.opt.builder.open")} className="grid size-9 place-items-center rounded-[10px] border border-ember/40 bg-ember-soft text-ember">
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
        <div className="flex shrink-0 items-center gap-2 border-b border-line bg-panel px-2 py-1.5">
          <Seg<ChainView>
            className="min-w-0 flex-1"
            value={oneCol ? view : view === "puts" ? "puts" : "calls"}
            onChange={(v) => opt.setPrefs({ view: v })}
            options={
              oneCol
                ? [
                    { value: "calls", label: t("trader.opt.calls"), tone: "up" },
                    { value: "both", label: t("trader.opt.both") },
                    { value: "puts", label: t("trader.opt.puts"), tone: "down" },
                  ]
                : [
                    { value: "calls", label: t("trader.opt.calls"), tone: "up" },
                    { value: "puts", label: t("trader.opt.puts"), tone: "down" },
                  ]
            }
          />
          <ColumnsMenu compact />
        </div>
      )}
      <main className="min-h-0 flex-1 overflow-hidden">
        {tab === "instruments" && <InstrumentList mobile onPick={() => setTab(panel === "simple" ? "trade" : "chain")} />}
        {tab === "chart" && (chartView === "analytics" ? <AnalyticsPane compact onOpenChain={() => setTab("chain")} /> : bookLive && chartView === "book" ? <BookPane compact /> : <OptionChartPane compact />)}
        {tab === "chain" && <OptionChainTable compact />}
        {tab === "trade" && (
          <div className="flex h-full min-h-0 flex-col">
            <div className="shrink-0 border-b border-line px-2 py-1.5">
              <Seg<SidePanel>
                value={panel}
                onChange={(v) => opt.setPrefs({ panel: v })}
                options={[
                  { value: "simple", label: t("trader.opt.guide.tab") },
                  { value: "ticket", label: legs.length > 1 ? `${t("trader.opt.ticket.tab")} · ${legs.length}` : t("trader.opt.ticket.tab") },
                ]}
              />
            </div>
            <div className="t-scroll min-h-0 flex-1 overflow-y-auto">{panel === "simple" ? <SimpleMode onDone={() => (setPosView("open"), setTab("positions"))} /> : <OptionTicket onAddLeg={() => setTab("chain")} onOpenChain={() => setTab("chain")} />}</div>
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
                    { value: "open", label: `${t("trader.opt.m.open")}${book.positions.length ? ` · ${book.positions.length}` : ""}` },
                    ...(bookLive ? [{ value: "orders" as const, label: `${t("trader.opt.ord.tab")}${orders.open.length ? ` · ${orders.open.length}` : ""}` }] : []),
                    { value: "closed", label: t("trader.opt.hist.tab") },
                    { value: "settled", label: t("trader.opt.m.settled") },
                  ]}
                />
              </div>
              <div className="min-h-0 flex-1">
                {posView === "open" || (posView === "orders" && !bookLive) ? (
                  <div className="t-scroll h-full overflow-y-auto p-2">
                    <OptionPositionsList mobile onOpenChain={() => (opt.setPrefs({ panel: "simple" }), setTab("trade"))} />
                  </div>
                ) : posView === "orders" ? (
                  <MOrders orders={orders.open} loaded={orders.loaded} />
                ) : posView === "closed" ? (
                  <ClosedList />
                ) : (
                  <SettlementsTab />
                )}
              </div>
            </div>
          ))}
      </main>
      {(tab === "chain" || (tab === "chart" && chartView !== "analytics")) && <SelectionBar onTrade={() => (opt.setPrefs({ panel: "ticket" }), setTab("trade"))} />}
      <nav className="grid h-[58px] shrink-0 grid-cols-5 border-t border-line bg-panel pb-[env(safe-area-inset-bottom)]">
        {tabs.map((x) => (
          <button key={x.id} onClick={() => setTab(x.id)} aria-current={tab === x.id ? "page" : undefined} className={cn("relative flex min-w-0 flex-col items-center justify-center gap-0.5 px-0.5 text-[10.5px] [&_svg]:size-[18px]", tab === x.id ? "text-ember" : "text-fg-3")}>
            {tab === x.id && <span className="absolute inset-x-4 top-0 h-[2px] rounded-full bg-ember" />}
            {x.icon}
            <span className="max-w-full truncate">{x.label}</span>
            {!!x.count && <span className="absolute right-[18%] top-1 grid h-4 min-w-4 place-items-center rounded-full bg-ember px-1 font-mono text-[9.5px] text-white">{x.count}</span>}
          </button>
        ))}
      </nav>
      <StrategyBuilder />
    </div>
  );
}

/** The selected option with its sell and buy prices: Sell / Buy open the ticket with that side chosen. */
function SelectionBar({ onTrade }: { onTrade: () => void }) {
  const t = useT();
  const { locale } = useLocale();
  const legs = useOpt((s) => s.ticket.legs);
  const sel = useOpt((s) => s.sel);
  const one = legs.length === 1 ? legs[0]! : null;
  const code = one?.series ?? null;
  const q = useSeriesQuote(code);
  const cutAt = useOpt((s) => (one && s.chain?.expiry === one.expiry && s.chain.underlying === one.u ? s.chain.cutAt : null));
  if (legs.length > 1)
    return (
      <div className="shrink-0 border-t border-line bg-panel px-2 py-2">
        <button onClick={onTrade} className="flex h-11 w-full items-center justify-between rounded-[12px] bg-ember px-4 text-[13px] font-semibold text-white shadow-[0_10px_30px_-12px_rgba(255,90,31,0.9)]">
          <span>{t("trader.opt.ticket.strategy", { count: legs.length })}</span>
          <span>{t("trader.opt.ticket.review")}</span>
        </button>
      </div>
    );
  const p = parseSeriesCode(code ?? sel ?? "");
  if (!one || !p) return null;
  const side = (s: "buy" | "sell") => {
    opt.arm(s);
    onTrade();
  };
  return (
    <div className="shrink-0 border-t border-line bg-panel px-2 pb-2 pt-1.5">
      <button onClick={onTrade} className="mb-1.5 flex w-full min-w-0 items-center gap-2 px-0.5 text-start">
        <OptAvatar symbol={p.underlying} size={16} />
        <span className="text-[13px] font-semibold">{p.underlying}</span>
        <span className={cn("rounded-[4px] px-1 text-[10.5px] font-semibold", p.right === "call" ? "bg-up-soft text-up" : "bg-down-soft text-down")}>{p.right === "call" ? t("trader.opt.call") : t("trader.opt.put")}</span>
        <span className="font-mono text-[13px] font-semibold">{p.strikeLabel}</span>
        <span className="ms-auto truncate text-[11px] text-fg-3">{cutAt ? cutWhen(cutAt, locale) : expiryLabel(p.date, locale)}</span>
      </button>
      <div className="grid grid-cols-2 gap-2">
        <button onClick={() => side("sell")} disabled={!q} title={t("trader.opt.clickSell")} className="flex h-12 flex-col items-start justify-center rounded-[12px] bg-down px-3 text-white disabled:opacity-50">
          <span className="text-[10px] font-semibold uppercase tracking-[0.1em] opacity-90">{t("common.sell")}</span>
          <span className="k-num font-mono text-[15px] font-semibold leading-tight">
            <Flash value={q?.bidUsd ?? 0}>{q && q.bidUsd > 0 ? money(q.bidUsd) : "—"}</Flash>
          </span>
        </button>
        <button onClick={() => side("buy")} disabled={!q} title={t("trader.opt.clickBuy")} className="flex h-12 flex-col items-end justify-center rounded-[12px] bg-up px-3 text-white disabled:opacity-50">
          <span className="text-[10px] font-semibold uppercase tracking-[0.1em] opacity-90">{t("common.buy")}</span>
          <span className="k-num font-mono text-[15px] font-semibold leading-tight">
            <Flash value={q?.askUsd ?? 0}>{q && q.askUsd > 0 ? money(q.askUsd) : "—"}</Flash>
          </span>
        </button>
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
    <div className="rounded-[12px] border border-line bg-panel-2/70 p-3">
      <div className="flex items-center gap-2">
        {p && <OptAvatar symbol={p.underlying} size={18} />}
        <span className="text-[13px] font-semibold">{p?.underlying ?? o.series}</span>
        {p && <span className={cn("rounded-[4px] px-1 text-[10.5px] font-semibold", p.right === "call" ? "bg-up-soft text-up" : "bg-down-soft text-down")}>{p.right === "call" ? t("trader.opt.call") : t("trader.opt.put")}</span>}
        {p && <span className="font-mono text-[12.5px] font-semibold">{p.strikeLabel}</span>}
        <OrderStatusChip status={o.trigger && o.status === "working" ? "pending" : o.status} className="ms-auto" />
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-fg-3">
        <span className={cn("font-semibold", o.side === "buy" ? "text-up" : "text-down")}>{o.side === "buy" ? t("common.buy") : t("common.sell")}</span>
        <span className="text-fg-2">{typeLabel(o.type)}</span>
        <span className="font-mono">
          {o.price !== null ? usd(o.price * units.k) : "—"} × {qtyText(o.qty)}
        </span>
        <span>{t("trader.opt.ord.filledOf", { n: qtyText(o.filled), total: qtyText(o.qty) })}</span>
        {p && <span>{expiryLabel(p.date, locale, false)}</span>}
        {!T.readOnly && (
          <button disabled={busy} onClick={() => void cancel()} className="ms-auto h-8 rounded-[8px] border border-line px-3 font-sans text-[12px] font-medium text-fg-2 hover:border-down/50 hover:text-down disabled:opacity-50">
            {t("trader.opt.pos.cancel")}
          </button>
        )}
      </div>
    </div>
  );
}
