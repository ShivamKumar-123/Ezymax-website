"use client";

// Toolbox › Orders (the options order book, docs/OPTIONS-EXCHANGE.md §12): working orders with inline amend (price
// and quantity: a lower quantity keeps the place in the queue, a new price or a higher quantity goes to the back),
// cancel, cancel all of the selected series or of the underlying; the order history; and the fills (role maker /
// taker, fee or rebate, the position each fill went to). Prices in USD per contract, sent per unit on the tick.
import * as React from "react";
import { Ban, Check as CheckIcon, Pencil, RefreshCw, X } from "lucide-react";
import { OPTION_SPEC, parseSeriesCode } from "@kalks/mock/options";
import { cn } from "@kalks/ui";
import { useLocale, useT } from "@kalks/i18n/react";
import { toast } from "@/lib/notify";
import { useTerminal } from "@/lib/store";
import { fmtServer } from "@/lib/trading";
import { Td, Th } from "@/components/ui/panel";
import { Empty, Stepper } from "@/components/ui/primitives";
import { bookApi } from "@/lib/options/book-api";
import { bookOrders, useBookOrders } from "@/lib/options/book-orders";
import { errText, optionErrorText } from "@/lib/options/errors";
import { toTick } from "@/lib/options/normalize";
import { useBookLive, useOpt, useOptionsAttach } from "@/lib/options-store";
import type { BookFill, BookOrder } from "@/lib/options/types";
import { OptAvatar, RightTag, Seg, SideTag } from "./bits";
import { OrderStatusChip, qty, useSeriesUnits, useTypeLabel } from "./book-bits";
import { expiryLabel, px, usd } from "./format";

type View = "open" | "history" | "fills";

function SeriesCell({ code }: { code: string }) {
  const { locale } = useLocale();
  const p = parseSeriesCode(code.split("-").slice(0, 4).join("-"));
  if (!p) return <span className="font-mono">{code}</span>;
  return (
    <span className="flex items-center gap-1.5">
      <OptAvatar symbol={p.underlying} size={13} />
      <span className="font-medium">{p.underlying}</span>
      <span className="font-mono">{p.strikeLabel}</span>
      <RightTag right={p.right} />
      <span className="text-[11px] text-fg-3">{expiryLabel(p.date, locale, false)}</span>
    </span>
  );
}

function Flags({ o }: { o: BookOrder }) {
  const t = useT();
  const typeLabel = useTypeLabel();
  const digits = OPTION_SPEC[parseSeriesCode(o.series.split("-").slice(0, 4).join("-"))?.underlying ?? ""]?.digits ?? 5;
  const units = useSeriesUnits(o.series);
  return (
    <span className="flex flex-wrap items-center gap-1">
      <span className="text-fg-2">{typeLabel(o.type)}</span>
      {o.type !== "market" && o.type !== "stop_market" && <span className="rounded-[3px] bg-surface-3 px-1 font-mono text-[9.5px] uppercase text-fg-3">{o.tif}</span>}
      {o.flags.includes("post_only") && <span className="rounded-[3px] bg-info-soft px-1 text-[9.5px] font-semibold text-info">{t("trader.opt.bt.postOnly")}</span>}
      {o.flags.includes("reduce_only") && <span className="rounded-[3px] bg-gold-soft px-1 text-[9.5px] font-semibold text-gold">{t("trader.opt.bt.reduceOnly")}</span>}
      {o.trigger && (
        <span className="text-[10.5px] text-fg-3">
          {t("trader.opt.ord.trigger", {
            source: o.trigger.source === "mark" ? t("trader.opt.col.mark") : (parseSeriesCode(o.series.split("-").slice(0, 4).join("-"))?.underlying ?? ""),
            op: o.trigger.op === "below" ? t("trader.opt.ticket.below") : t("trader.opt.ticket.above"),
            price: o.trigger.source === "mark" ? usd(o.trigger.price * units.k) : px(o.trigger.price, digits),
          })}
        </span>
      )}
      {o.tif === "gtd" && o.expireAt && <span className="text-[10.5px] text-fg-3">{t("trader.opt.ord.until", { at: fmtServer(o.expireAt, false) })}</span>}
    </span>
  );
}

function OpenRow({ o, readOnly }: { o: BookOrder; readOnly: boolean }) {
  const T = useTerminal();
  const t = useT();
  const units = useSeriesUnits(o.series);
  const [edit, setEdit] = React.useState<{ price: string; qty: string } | null>(null);
  const [busy, setBusy] = React.useState(false);
  const priceUsd = o.price !== null ? o.price * units.k : null;
  const canPrice = o.type === "limit" || o.type === "stop_limit";
  const save = async () => {
    if (!edit) return;
    const p = parseFloat(edit.price);
    const n = Math.round(parseFloat(edit.qty));
    const patch: { price?: number; qty?: number } = {};
    if (canPrice && p > 0 && units.k > 0) {
      const unit = toTick(p / units.k, units.tick);
      if (o.price === null || Math.abs(unit - o.price) > units.tick / 2) patch.price = unit;
    }
    if (n > 0 && n !== o.qty) patch.qty = n;
    if (!Object.keys(patch).length) return setEdit(null);
    setBusy(true);
    const r = await bookApi.amend(T.account.login, o.id, patch);
    setBusy(false);
    if (!r.ok) return void toast.error(t("trader.opt.ord.toast.amendRejected"), { description: errText(r.err) });
    if (r.data.status === "rejected") return void toast.error(t("trader.opt.ord.toast.amendRejected"), { description: optionErrorText(r.data.reason ?? "rejected") });
    setEdit(null);
    T.log("Trade", `'${T.account.login}': book order #${o.id} amended${patch.price !== undefined ? ` price ${patch.price}` : ""}${patch.qty !== undefined ? ` qty ${patch.qty}` : ""}`);
    toast.success(t("trader.opt.ord.toast.amended"), { description: `#${o.id}${r.data.fills.length ? ` · ${t("trader.opt.ord.toast.filledNow", { n: r.data.fills.reduce((s, f) => s + f.qty, 0) })}` : ""}` });
    void bookOrders.refresh(T.account.login);
  };
  const cancel = async () => {
    setBusy(true);
    const r = await bookApi.cancel(T.account.login, o.id);
    setBusy(false);
    if (!r.ok) return void toast.error(t("trader.opt.toast.cancelRejected"), { description: errText(r.err) });
    T.log("Trade", `'${T.account.login}': book order #${o.id} cancelled`);
    toast(t("trader.opt.toast.cancelled"), { description: `#${o.id} ${o.series}` });
    void bookOrders.refresh(T.account.login);
  };
  return (
    <tr className={cn("hover:bg-surface-2/70", edit && "bg-ember-soft/20")}>
      <Td mono className="ps-3 text-fg-3">
        {fmtServer(o.createdAt)}
      </Td>
      <Td>
        <SeriesCell code={o.series} />
      </Td>
      <Td>
        <SideTag side={o.side} />
      </Td>
      <Td>
        <Flags o={o} />
      </Td>
      <Td right mono>
        {edit && canPrice ? (
          <span className="inline-block w-[104px]">
            <Stepper ariaLabel={t("trader.opt.bt.limitPrice")} value={edit.price} onChange={(v) => setEdit({ ...edit, price: v })} step={Math.max(0.01, units.tickUsd)} min={0} decimals={2} className="h-6" />
          </span>
        ) : priceUsd !== null ? (
          usd(priceUsd)
        ) : (
          <span className="text-fg-3">{t("trader.opt.ord.type.market")}</span>
        )}
      </Td>
      <Td right mono>
        {edit ? (
          <span className="inline-block w-[84px]">
            <Stepper ariaLabel={t("trader.opt.ticket.contracts")} value={edit.qty} onChange={(v) => setEdit({ ...edit, qty: v })} step={1} min={Math.max(1, o.filled + 1)} decimals={0} className="h-6" />
          </span>
        ) : (
          qty(o.qty)
        )}
      </Td>
      <Td right mono className="text-fg-2">
        {qty(o.filled)}
      </Td>
      <Td right mono>
        {qty(o.left)}
      </Td>
      <Td right mono className="text-fg-2">
        {o.avgPrice !== null ? usd(o.avgPrice * units.k) : "—"}
      </Td>
      <Td right mono className="text-fg-3" >
        {o.reserved > 0 ? usd(o.reserved) : "—"}
      </Td>
      <Td>
        <OrderStatusChip status={o.trigger && o.status === "working" ? "pending" : o.status} />
      </Td>
      <Td className="pe-2">
        {!readOnly && (
          <span className="flex items-center justify-end gap-0.5">
            {edit ? (
              <>
                <button onClick={() => void save()} disabled={busy} title={t("trader.opt.ord.save")} className="grid size-6 place-items-center rounded-[5px] text-up hover:bg-up-soft disabled:opacity-40">
                  <CheckIcon className="size-3.5" />
                </button>
                <button onClick={() => setEdit(null)} title={t("common.cancel")} className="grid size-6 place-items-center rounded-[5px] text-fg-3 hover:bg-surface-3 hover:text-fg">
                  <X className="size-3.5" />
                </button>
              </>
            ) : (
              <>
                <button onClick={() => setEdit({ price: priceUsd !== null ? priceUsd.toFixed(2) : "", qty: String(o.qty) })} disabled={busy} title={t("trader.opt.ord.amend")} className="grid size-6 place-items-center rounded-[5px] text-fg-3 hover:bg-surface-3 hover:text-fg disabled:opacity-40">
                  <Pencil className="size-3.5" />
                </button>
                <button onClick={() => void cancel()} disabled={busy} className="h-6 rounded-[5px] border border-line px-2 text-[11px] text-fg-2 hover:border-down/50 hover:text-down disabled:opacity-40">
                  {t("trader.opt.pos.cancel")}
                </button>
              </>
            )}
          </span>
        )}
      </Td>
    </tr>
  );
}

function HistoryRow({ o }: { o: BookOrder }) {
  const units = useSeriesUnits(o.series);
  const typeLabel = useTypeLabel();
  return (
    <tr className="hover:bg-surface-2/70">
      <Td mono className="ps-3 text-fg-3">
        {fmtServer(o.updatedAt ?? o.createdAt)}
      </Td>
      <Td>
        <SeriesCell code={o.series} />
      </Td>
      <Td>
        <SideTag side={o.side} />
      </Td>
      <Td className="text-fg-2">{typeLabel(o.type)}</Td>
      <Td right mono className="text-fg-2">
        {o.price !== null ? usd(o.price * units.k) : "—"}
      </Td>
      <Td right mono>
        {qty(o.qty)}
      </Td>
      <Td right mono>
        {qty(o.filled)}
      </Td>
      <Td right mono className="text-fg-2">
        {o.avgPrice !== null ? usd(o.avgPrice * units.k) : "—"}
      </Td>
      <Td>
        <OrderStatusChip status={o.status} />
      </Td>
      <Td className="max-w-[240px] truncate pe-3 text-[11.5px] text-fg-3">{o.reason ? optionErrorText(o.reason) : ""}</Td>
    </tr>
  );
}

function FillRow({ f }: { f: BookFill }) {
  const t = useT();
  const units = useSeriesUnits(f.series);
  return (
    <tr className="hover:bg-surface-2/70">
      <Td mono className="ps-3 text-fg-3">
        {fmtServer(f.at)}
      </Td>
      <Td>
        <SeriesCell code={f.series} />
      </Td>
      <Td>
        <SideTag side={f.side} />
      </Td>
      <Td right mono>
        {usd(f.price * units.k)}
      </Td>
      <Td right mono>
        {qty(f.qty)}
      </Td>
      <Td>
        <span className={cn("rounded-[3px] px-1 text-[10px] font-semibold uppercase", f.role === "maker" ? "bg-info-soft text-info" : "bg-surface-3 text-fg-2")}>{t.dyn(`trader.opt.ord.role.${f.role}`, f.role)}</span>
        {f.kind && f.kind !== "book" && <span className="ms-1 rounded-[3px] bg-surface-3 px-1 text-[9.5px] text-fg-3">{t.dyn(`trader.opt.tape.kind.${f.kind}`, f.kind)}</span>}
      </Td>
      <Td right mono className={f.rebate > 0 ? "text-up" : "text-fg-2"}>
        {f.rebate > 0 ? `+${usd(f.rebate)}` : f.fee > 0 ? `−${usd(f.fee)}` : "0.00"}
      </Td>
      <Td mono className="text-fg-3">
        {f.positionTicket ? `#${f.positionTicket}` : "—"}
      </Td>
      <Td mono className="pe-3 text-fg-3">
        {f.orderId ? `#${f.orderId}` : f.comboId ? f.comboId : "—"}
      </Td>
    </tr>
  );
}

export function OrdersTab() {
  const T = useTerminal();
  const t = useT();
  useOptionsAttach({ login: T.account.login, guest: T.guest, engine: T.engine, readOnly: T.readOnly });
  const live = useBookLive();
  const login = T.guest ? null : T.account.login;
  const open = useBookOrders(login, true);
  const sel = useOpt((s) => s.sel);
  const u = useOpt((s) => s.u);
  const [view, setView] = React.useState<View>("open");
  const [hist, setHist] = React.useState<BookOrder[] | null>(null);
  const [fills, setFills] = React.useState<BookFill[] | null>(null);
  const [busy, setBusy] = React.useState(false);

  const loadHistory = React.useCallback(async () => {
    if (!login) return;
    if (view === "history") {
      const r = await bookApi.orders(login, { status: "history" });
      if (r.ok) setHist([...r.data].sort((a, b) => Date.parse(b.updatedAt ?? b.createdAt) - Date.parse(a.updatedAt ?? a.createdAt)));
    } else if (view === "fills") {
      const r = await bookApi.fills(login, { from: new Date(Date.now() - 30 * 86_400_000).toISOString() });
      if (r.ok) setFills([...r.data].sort((a, b) => Date.parse(b.at) - Date.parse(a.at)));
    }
  }, [login, view]);
  React.useEffect(() => {
    if (view === "open") return;
    void loadHistory();
    const id = setInterval(() => document.visibilityState === "visible" && void loadHistory(), 8_000);
    const off = bookOrders.subscribe(() => void loadHistory());
    return () => {
      clearInterval(id);
      off();
    };
  }, [view, loadHistory]);

  const cancelAll = async (scope: { series?: string; underlying?: string }) => {
    if (!login) return;
    setBusy(true);
    const r = await bookApi.cancelAll(login, scope);
    setBusy(false);
    if (!r.ok) return void toast.error(t("trader.opt.toast.cancelRejected"), { description: errText(r.err) });
    T.log("Trade", `'${login}': cancel all book orders ${scope.series ?? scope.underlying}: ${r.data.cancelled}`);
    toast(t("trader.opt.ord.toast.cancelledAll", { count: r.data.cancelled }), { description: scope.series ?? scope.underlying });
    void bookOrders.refresh(login);
  };

  const ro = T.readOnly;
  const selOpen = sel ? open.open.filter((o) => o.series === sel).length : 0;
  const uOpen = open.open.filter((o) => parseSeriesCode(o.series.split("-").slice(0, 4).join("-"))?.underlying === u).length;
  const selP = sel ? parseSeriesCode(sel) : null;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-8 shrink-0 items-center gap-2 border-b border-line px-2">
        <Seg<View>
          size="sm"
          className="w-[250px]"
          value={view}
          onChange={setView}
          options={[
            { value: "open", label: `${t("trader.opt.ord.open")}${open.open.length ? ` · ${open.open.length}` : ""}` },
            { value: "history", label: t("trader.opt.ord.history") },
            { value: "fills", label: t("trader.opt.ord.fills") },
          ]}
        />
        {!live && <span className="text-[11px] text-fg-3">{t("trader.opt.ord.notLive")}</span>}
        <span className="ms-auto flex items-center gap-1">
          {view === "open" && !ro && (
            <>
              {selP && (
                <button onClick={() => void cancelAll({ series: sel! })} disabled={busy || !selOpen} className="flex h-6 items-center gap-1 rounded-[5px] border border-line px-2 text-[11px] text-fg-2 hover:border-down/50 hover:text-down disabled:opacity-40">
                  <Ban className="size-3" /> {t("trader.opt.ord.cancelSeries", { series: `${selP.strikeLabel} ${selP.right === "call" ? "C" : "P"}` })}
                </button>
              )}
              <button onClick={() => void cancelAll({ underlying: u })} disabled={busy || !uOpen} className="flex h-6 items-center gap-1 rounded-[5px] border border-line px-2 text-[11px] text-fg-2 hover:border-down/50 hover:text-down disabled:opacity-40">
                <Ban className="size-3" /> {t("trader.opt.ord.cancelUnderlying", { u })}
              </button>
            </>
          )}
          {view !== "open" && (
            <button onClick={() => void loadHistory()} title={t("trader.opt.ord.refresh")} className="grid size-6 place-items-center rounded-[5px] text-fg-3 hover:bg-surface-3 hover:text-fg">
              <RefreshCw className="size-3.5" />
            </button>
          )}
        </span>
      </div>
      <div className="t-scroll min-h-0 flex-1 overflow-auto">
        {view === "open" && (
          <table className="w-full min-w-[1120px] border-separate border-spacing-0">
            <thead>
              <tr>
                <Th className="ps-3">{t("trader.opt.ord.col.time")}</Th>
                <Th>{t("trader.opt.col.series")}</Th>
                <Th>{t("trader.opt.col.side")}</Th>
                <Th>{t("trader.opt.col.type")}</Th>
                <Th right>{t("trader.opt.col.price")}</Th>
                <Th right>{t("trader.opt.ticket.contracts")}</Th>
                <Th right>{t("trader.opt.ord.col.filled")}</Th>
                <Th right>{t("trader.opt.ord.col.left")}</Th>
                <Th right>{t("trader.opt.ord.col.avg")}</Th>
                <Th right>{t("trader.opt.ord.col.reserved")}</Th>
                <Th>{t("trader.opt.ord.col.status")}</Th>
                <Th className="w-[110px]" />
              </tr>
            </thead>
            <tbody>
              {open.open.map((o) => (
                <OpenRow key={o.id} o={o} readOnly={ro} />
              ))}
            </tbody>
          </table>
        )}
        {view === "open" && !open.open.length && <Empty title={open.loaded ? t("trader.opt.ord.emptyOpen") : t("trader.opt.ord.loading")} sub={open.loaded ? t("trader.opt.ord.emptyOpenSub") : undefined} />}
        {view === "open" && open.open.length > 0 && <div className="border-t border-line/60 px-3 py-1.5 text-[10.5px] text-fg-3">{t("trader.opt.ord.amendHint")}</div>}
        {view === "history" && (
          <>
            <table className="w-full min-w-[980px] border-separate border-spacing-0">
              <thead>
                <tr>
                  <Th className="ps-3">{t("trader.opt.ord.col.time")}</Th>
                  <Th>{t("trader.opt.col.series")}</Th>
                  <Th>{t("trader.opt.col.side")}</Th>
                  <Th>{t("trader.opt.col.type")}</Th>
                  <Th right>{t("trader.opt.col.price")}</Th>
                  <Th right>{t("trader.opt.ticket.contracts")}</Th>
                  <Th right>{t("trader.opt.ord.col.filled")}</Th>
                  <Th right>{t("trader.opt.ord.col.avg")}</Th>
                  <Th>{t("trader.opt.ord.col.status")}</Th>
                  <Th className="pe-3">{t("trader.opt.ord.col.reason")}</Th>
                </tr>
              </thead>
              <tbody>
                {(hist ?? []).slice(0, 300).map((o) => (
                  <HistoryRow key={o.id} o={o} />
                ))}
              </tbody>
            </table>
            {!hist?.length && <Empty title={hist ? t("trader.opt.ord.emptyHistory") : t("trader.opt.ord.loading")} />}
          </>
        )}
        {view === "fills" && (
          <>
            <table className="w-full min-w-[980px] border-separate border-spacing-0">
              <thead>
                <tr>
                  <Th className="ps-3">{t("trader.opt.ord.col.time")}</Th>
                  <Th>{t("trader.opt.col.series")}</Th>
                  <Th>{t("trader.opt.col.side")}</Th>
                  <Th right>{t("trader.opt.col.price")}</Th>
                  <Th right>{t("trader.opt.ticket.contracts")}</Th>
                  <Th>{t("trader.opt.ord.col.role")}</Th>
                  <Th right>{t("trader.opt.ord.col.fee")}</Th>
                  <Th>{t("trader.opt.ord.col.position")}</Th>
                  <Th className="pe-3">{t("trader.opt.ord.col.order")}</Th>
                </tr>
              </thead>
              <tbody>
                {(fills ?? []).slice(0, 300).map((f) => (
                  <FillRow key={`${f.fillId}-${f.side}-${f.orderId ?? ""}`} f={f} />
                ))}
              </tbody>
            </table>
            {!fills?.length && <Empty title={fills ? t("trader.opt.ord.emptyFills") : t("trader.opt.ord.loading")} />}
          </>
        )}
      </div>
    </div>
  );
}
