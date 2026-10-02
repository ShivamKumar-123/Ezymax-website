"use client";

// Toolbox › Options: open option positions grouped by strategy (combo), live mark, P&L and Greeks, close / partial
// close per leg and close-the-whole-strategy (all-or-nothing), working option orders, and the totals. CFD and option
// positions share one account, so the footer shows the same equity / margin as the Trade tab.
import * as React from "react";
import { Crosshair, Layers, Scissors, X } from "lucide-react";
import { OPTION_SPEC } from "@kalks/mock/options";
import { cn } from "@kalks/ui";
import { useLocale, useT } from "@kalks/i18n/react";
import { toast } from "@/lib/notify";
import { useMetrics, useTerminal } from "@/lib/store";
import { accCcy, accMoney, fmtServer } from "@/lib/trading";
import { useLivePosition } from "@/lib/engine/live";
import { Td, Th } from "@/components/ui/panel";
import { LiveMoney, Pnl, Stepper } from "@/components/ui/primitives";
import { DropMenu } from "@/components/ui/menu";
import { optionsApi } from "@/lib/options/api";
import { useOptionBook } from "@/lib/options/book";
import { errText } from "@/lib/options/errors";
import { detectTemplate } from "@/lib/options/math";
import { setTradeMode } from "@/lib/options/mode";
import { opt, useOptionsAttach, useSeriesQuote } from "@/lib/options-store";
import type { OptOrder, OptPosition, OptionQuote } from "@/lib/options/types";
import { Countdown, OptAvatar, RightTag, SideTag } from "./bits";
import { expiryLabel, greek, strikeText, usd, usdSigned } from "./format";

/** Live numbers of one position: USD per contract, mark, P&L, Greeks. */
export function useOptionPositionLive(p: OptPosition) {
  const T = useTerminal();
  const q = useSeriesQuote(p.option.series);
  const live = useLivePosition(T.engine ? p.login || T.account.login : null, p.ticket);
  return derive(p, q, live?.profit);
}

function derive(p: OptPosition, q: OptionQuote | null, liveProfit?: number) {
  const usdU = q && q.ask > 0 && q.askUsd > 0 ? q.askUsd / q.ask : p.option.contractSize || 0;
  const k = p.side === "buy" ? 1 : -1;
  const markUnit = q?.mark ?? p.mark;
  const exitUnit = q ? (p.side === "buy" ? q.bid : q.ask) : markUnit;
  const computed = exitUnit !== undefined ? k * (exitUnit - p.openPrice) * usdU * p.contracts - p.commission : undefined;
  const profit = liveProfit ?? p.profit ?? computed ?? 0;
  const g = q
    ? { delta: k * p.contracts * q.delta, gamma: k * p.contracts * q.gamma, theta: k * p.contracts * q.theta, vega: k * p.contracts * q.vega }
    : { delta: p.greeks?.delta ?? 0, gamma: p.greeks?.gamma ?? 0, theta: p.greeks?.theta ?? 0, vega: p.greeks?.vega ?? 0 };
  return { q, usdU, openUsd: p.openPrice * usdU, markUsd: markUnit !== undefined ? markUnit * usdU : undefined, profit, g };
}

const sum = (xs: { profit: number; g: { delta: number; gamma: number; theta: number; vega: number } }[]) =>
  xs.reduce((a, x) => ({ profit: a.profit + x.profit, delta: a.delta + x.g.delta, gamma: a.gamma + x.g.gamma, theta: a.theta + x.g.theta, vega: a.vega + x.g.vega }), { profit: 0, delta: 0, gamma: 0, theta: 0, vega: 0 });

/** Reports each row's numbers up so groups and the footer can total them without re-subscribing. */
type Report = (ticket: string, v: ReturnType<typeof derive>) => void;

function PartialClose({ p, onClose }: { p: OptPosition; onClose: (n: number) => void }) {
  const t = useT();
  const [n, setN] = React.useState(String(Math.max(1, Math.floor(p.contracts / 2))));
  return (
    <DropMenu
      width={210}
      align="end"
      trigger={({ toggle, open }) => (
        <button onClick={toggle} disabled={p.contracts <= 1} title={t("trader.opt.pos.partial")} className={cn("grid size-6 place-items-center rounded-[5px] text-fg-3 hover:bg-surface-3 hover:text-fg disabled:opacity-35", open && "bg-surface-3 text-fg")}>
          <Scissors className="size-3.5" />
        </button>
      )}
    >
      {(close) => (
        <div className="space-y-2 p-2.5">
          <div className="text-[11.5px] font-medium text-fg">{t("trader.opt.pos.partialTitle", { ticket: p.ticket })}</div>
          <Stepper ariaLabel={t("trader.opt.ticket.contracts")} value={n} onChange={setN} step={1} min={1} decimals={0} />
          <div className="text-[10.5px] text-fg-3">{t("trader.opt.pos.ofContracts", { count: p.contracts })}</div>
          <button
            onClick={() => {
              const v = Math.min(p.contracts, Math.max(1, Math.round(parseFloat(n) || 1)));
              close();
              onClose(v);
            }}
            className="h-7 w-full rounded-[6px] bg-ember text-[12px] font-semibold text-white hover:brightness-110"
          >
            {t("trader.opt.pos.closeN", { count: Math.min(p.contracts, Math.max(1, Math.round(parseFloat(n) || 1))) })}
          </button>
        </div>
      )}
    </DropMenu>
  );
}

const PositionRow = React.memo(function PositionRow({ p, indent, readOnly, report, onClose, digits, locale }: { p: OptPosition; indent?: boolean; readOnly: boolean; report: Report; onClose: (p: OptPosition, n?: number) => void; digits: number; locale: string }) {
  const t = useT();
  const v = useOptionPositionLive(p);
  React.useEffect(() => report(p.ticket, v));
  const cut = Date.parse(p.option.expiryAt) || Date.parse(`${p.option.expiry}T14:00:00Z`);
  return (
    <tr className="group hover:bg-surface-2/70">
      <Td className={cn(indent ? "ps-7" : "ps-3")}>
        <span className="flex items-center gap-1.5">
          {!indent && <OptAvatar symbol={p.option.underlying} size={13} />}
          <span className="font-medium">{p.option.underlying}</span>
          <span className="font-mono">{strikeText(p.option.strike, digits)}</span>
          <RightTag right={p.option.right} />
          {p.option.barrier && <span className="rounded-[3px] bg-warn-soft px-1 text-[9.5px] font-semibold text-warn">{t("trader.opt.pos.barrier")}</span>}
        </span>
      </Td>
      <Td mono className="text-fg-3">
        {p.ticket}
      </Td>
      <Td>
        <SideTag side={p.side} />
      </Td>
      <Td right mono>
        {p.contracts}
      </Td>
      <Td right mono className="text-fg-2">
        {usd(v.openUsd)}
      </Td>
      <Td right mono>
        {v.markUsd !== undefined ? usd(v.markUsd) : "—"}
      </Td>
      <Td right className="font-semibold">
        <Pnl value={v.profit} text={usdSigned(v.profit)} format={(x) => usdSigned(x)} />
      </Td>
      <Td right mono className="text-fg-2">
        {greek(v.g.delta, 3)}
      </Td>
      <Td right mono className="text-fg-3">
        {greek(v.g.gamma, 4)}
      </Td>
      <Td right mono className={v.g.theta < 0 ? "text-down/80" : "text-fg-3"}>
        {usd(v.g.theta)}
      </Td>
      <Td right mono className="text-fg-3">
        {usd(v.g.vega)}
      </Td>
      <Td>
        <span className="flex items-center gap-2">
          <span className="text-fg-2">{expiryLabel(p.option.expiry, locale, false)}</span>
          {cut > Date.now() && <Countdown to={cut} className="text-[10.5px] text-fg-3" />}
        </span>
      </Td>
      <Td className="w-[92px] pe-2">
        <span className="flex items-center justify-end gap-0.5">
          <button onClick={() => (opt.showSeries(p.option.series) || opt.selectUnderlying(p.option.underlying), opt.focus(p.ticket), setTradeMode("options"))} title={t("trader.opt.pos.showOnChart")} className="grid size-6 place-items-center rounded-[5px] text-fg-3 hover:bg-surface-3 hover:text-fg">
            <Crosshair className="size-3.5" />
          </button>
          {!readOnly && (
            <>
              <PartialClose p={p} onClose={(n) => onClose(p, n)} />
              <button onClick={() => onClose(p)} title={t("trader.opt.pos.close")} className="grid size-6 place-items-center rounded-[5px] text-fg-3 hover:bg-down-soft hover:text-down">
                <X className="size-3.5" />
              </button>
            </>
          )}
        </span>
      </Td>
    </tr>
  );
});

function ComboHeader({ id, legs, totals, readOnly, onClose, locale }: { id: string; legs: OptPosition[]; totals: ReturnType<typeof sum>; readOnly: boolean; onClose: () => void; locale: string }) {
  const t = useT();
  const [confirm, setConfirm] = React.useState(false);
  React.useEffect(() => {
    if (!confirm) return;
    const tm = setTimeout(() => setConfirm(false), 3500);
    return () => clearTimeout(tm);
  }, [confirm]);
  const tpl = detectTemplate(legs.map((l) => ({ right: l.option.right, side: l.side, strike: l.option.strike, contracts: l.contracts })));
  const name = tpl ? t.dyn(`trader.opt.tpl.${tpl}.name`, tpl) : t("trader.opt.pos.strategy");
  const u = legs[0]!.option.underlying;
  return (
    <tr className="bg-surface-2/50">
      <Td className="ps-3" >
        <span className="flex items-center gap-1.5">
          <Layers className="size-3.5 text-ember" />
          <OptAvatar symbol={u} size={13} />
          <span className="font-semibold">{name}</span>
          <span className="text-fg-3">
            {u} · {expiryLabel(legs[0]!.option.expiry, locale, false)} · {t("trader.opt.ticket.strategy", { count: legs.length })}
          </span>
        </span>
      </Td>
      <Td mono className="text-fg-3">
        {id.slice(0, 10)}
      </Td>
      <Td />
      <Td />
      <Td />
      <Td />
      <Td right className="font-semibold">
        <Pnl value={totals.profit} text={usdSigned(totals.profit)} format={(x) => usdSigned(x)} />
      </Td>
      <Td right mono className="font-medium text-fg-2">
        {greek(totals.delta, 3)}
      </Td>
      <Td right mono className="text-fg-3">
        {greek(totals.gamma, 4)}
      </Td>
      <Td right mono className="text-fg-3">
        {usd(totals.theta)}
      </Td>
      <Td right mono className="text-fg-3">
        {usd(totals.vega)}
      </Td>
      <Td />
      <Td className="pe-2 text-end">
        {!readOnly && (
          <button onClick={() => (confirm ? (setConfirm(false), onClose()) : setConfirm(true))} className={cn("h-6 rounded-[5px] border px-2 text-[11px] font-medium transition-colors", confirm ? "border-down bg-down text-white" : "border-line text-fg-2 hover:border-down/50 hover:text-down")}>
            {confirm ? t("trader.opt.pos.confirmClose") : t("trader.opt.pos.closeStrategy")}
          </button>
        )}
      </Td>
    </tr>
  );
}

function OrderRow({ o, readOnly, onCancel, digits }: { o: OptOrder; readOnly: boolean; onCancel: () => void; digits: number }) {
  const t = useT();
  const q = useSeriesQuote(o.option.series);
  const usdU = q && q.ask > 0 ? q.askUsd / q.ask : o.option.contractSize;
  return (
    <tr className="hover:bg-surface-2/70">
      <Td className="ps-3">
        <span className="flex items-center gap-1.5">
          <OptAvatar symbol={o.option.underlying} size={13} />
          <span className="font-medium">{o.option.underlying}</span>
          <span className="font-mono">{strikeText(o.option.strike, digits)}</span>
          <RightTag right={o.option.right} />
        </span>
      </Td>
      <Td mono className="text-fg-3">
        {o.ticket}
      </Td>
      <Td>
        <SideTag side={o.side} />
      </Td>
      <Td right mono>
        {o.contracts}
      </Td>
      <td colSpan={3} className="h-[28px] whitespace-nowrap border-b border-line/60 px-2 text-[12px] text-fg-2">
        {o.trigger ? t("trader.opt.pos.triggerOrder", { u: o.trigger.symbol, op: o.trigger.op === "below" ? t("trader.opt.ticket.below") : t("trader.opt.ticket.above"), price: o.trigger.price }) : t("trader.opt.pos.limitOrder", { price: o.price !== undefined ? usd(o.price * usdU) : "—" })}
      </td>
      <td colSpan={4} className="h-[28px] whitespace-nowrap border-b border-line/60 px-2 text-[12px] text-fg-3">
        {t("trader.opt.pos.placed", { at: fmtServer(o.placedAt, false) })}
      </td>
      <Td />
      <Td className="pe-2 text-end">
        {!readOnly && (
          <button onClick={onCancel} className="h-6 rounded-[5px] border border-line px-2 text-[11px] text-fg-2 hover:border-down/50 hover:text-down">
            {t("trader.opt.pos.cancel")}
          </button>
        )}
      </Td>
    </tr>
  );
}

/** Close one option position (all of it, or `n` contracts), with the toast and journal line. */
export async function closeOptionPosition(T: ReturnType<typeof useTerminal>, t: ReturnType<typeof useT>, p: OptPosition, n?: number) {
  const part = n !== undefined && n < p.contracts;
  const r = await optionsApi.closePosition(T.account.login, p.ticket, part ? n : undefined);
  const what = `${p.option.underlying} ${strikeText(p.option.strike, OPTION_SPEC[p.option.underlying]?.digits ?? 5)} ${p.option.right === "call" ? "C" : "P"} #${p.ticket}`;
  if (!r.ok) return void toast.error(t("trader.opt.toast.closeRejected"), { description: `${what} · ${errText(r.err)}` });
  T.log("Trade", `'${T.account.login}': option position #${p.ticket} ${p.option.series} ${part ? `partially closed (${n} of ${p.contracts})` : "closed"}`);
  const pr = r.data.profit;
  (pr === undefined || pr >= 0 ? toast.success : toast.error)(part ? t("trader.opt.toast.closedPartial", { count: n! }) : t("trader.opt.toast.closed"), { description: pr !== undefined ? `${what} · ${usdSigned(pr)} USD` : what });
}

export function OptionsPositionsTab() {
  const T = useTerminal();
  const t = useT();
  const { locale } = useLocale();
  useOptionsAttach({ login: T.account.login, guest: T.guest, engine: T.engine, readOnly: T.readOnly });
  const login = T.guest ? null : T.account.login;
  const book = useOptionBook(login);
  const m = useMetrics();
  const a = m.account;
  // row numbers reported up for the group / footer totals (re-rendered on a light timer, not per tick)
  const vals = React.useRef(new Map<string, ReturnType<typeof derive>>());
  const [, bump] = React.useReducer((x: number) => x + 1, 0);
  const report = React.useCallback<Report>((ticket, v) => void vals.current.set(ticket, v), []);
  React.useEffect(() => {
    const id = setInterval(bump, 600);
    return () => clearInterval(id);
  }, []);

  const close = (p: OptPosition, n?: number) => closeOptionPosition(T, t, p, n);
  const closeCombo = async (id: string) => {
    const r = await optionsApi.closeCombo(T.account.login, id);
    if (!r.ok) return void toast.error(t("trader.opt.toast.closeRejected"), { description: errText(r.err) });
    T.log("Trade", `'${T.account.login}': option strategy ${id} closed`);
    toast.success(t("trader.opt.toast.strategyClosed"), { description: r.data.profit !== undefined ? `${usdSigned(r.data.profit)} USD` : undefined });
  };
  const cancel = async (o: OptOrder) => {
    const r = await optionsApi.cancelOrder(T.account.login, o.ticket);
    if (!r.ok) return void toast.error(t("trader.opt.toast.cancelRejected"), { description: errText(r.err) });
    toast(t("trader.opt.toast.cancelled"), { description: `#${o.ticket} ${o.option.series}` });
  };

  const singles = book.positions.filter((p) => !p.comboId);
  const combos = new Map<string, OptPosition[]>();
  for (const p of book.positions) if (p.comboId) (combos.get(p.comboId) ?? combos.set(p.comboId, []).get(p.comboId)!).push(p);
  const present = (ps: OptPosition[]) => ps.map((p) => vals.current.get(p.ticket)).filter((x): x is ReturnType<typeof derive> => !!x);
  const total = sum(present(book.positions));
  const digitsOf = (u: string) => OPTION_SPEC[u]?.digits ?? 5;
  const ro = T.readOnly;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="t-scroll min-h-0 flex-1 overflow-auto">
        <table className="w-full min-w-[1180px] border-separate border-spacing-0">
          <thead>
            <tr>
              <Th className="ps-3">{t("trader.opt.col.series")}</Th>
              <Th>{t("toolbox.col.ticket")}</Th>
              <Th>{t("trader.opt.col.side")}</Th>
              <Th right>{t("trader.opt.ticket.contracts")}</Th>
              <Th right>{t("trader.opt.col.openPremium")}</Th>
              <Th right>{t("trader.opt.col.mark")}</Th>
              <Th right>{t("trader.opt.col.pnl")}</Th>
              <Th right>Δ</Th>
              <Th right>Γ</Th>
              <Th right>Θ</Th>
              <Th right>Vega</Th>
              <Th>{t("trader.opt.col.expiry")}</Th>
              <Th className="w-[92px]" />
            </tr>
          </thead>
          <tbody>
            {[...combos.entries()].map(([id, legs]) => (
              <React.Fragment key={id}>
                <ComboHeader id={id} legs={legs} totals={sum(present(legs))} readOnly={ro} onClose={() => void closeCombo(id)} locale={locale} />
                {legs.map((p) => (
                  <PositionRow key={p.ticket} p={p} indent readOnly={ro} report={report} onClose={(x, n) => void close(x, n)} digits={digitsOf(p.option.underlying)} locale={locale} />
                ))}
              </React.Fragment>
            ))}
            {singles.map((p) => (
              <PositionRow key={p.ticket} p={p} readOnly={ro} report={report} onClose={(x, n) => void close(x, n)} digits={digitsOf(p.option.underlying)} locale={locale} />
            ))}
            {!book.positions.length && (
              <tr>
                <td colSpan={13} className="h-14 border-b border-line/60 text-center text-[12px] text-fg-3">
                  {t("trader.opt.pos.empty")}{" "}
                  <button onClick={() => setTradeMode("options")} className="text-ember hover:underline">
                    {t("trader.opt.pos.openWorkspace")}
                  </button>
                </td>
              </tr>
            )}
            {book.orders.length > 0 && (
              <tr>
                <td colSpan={13} className="h-6 border-b border-line bg-panel-2 ps-3 text-[10px] font-semibold uppercase tracking-[0.08em] text-fg-3">
                  {t("trader.opt.pos.workingOrders", { count: book.orders.length })}
                </td>
              </tr>
            )}
            {book.orders.map((o) => (
              <OrderRow key={o.ticket} o={o} readOnly={ro} onCancel={() => void cancel(o)} digits={digitsOf(o.option.underlying)} />
            ))}
          </tbody>
          <tfoot>
            <tr className="[&>td]:sticky [&>td]:bottom-0 [&>td]:z-[1] [&>td]:border-t [&>td]:border-line [&>td]:bg-panel-2">
              <td colSpan={6} className="h-[28px] whitespace-nowrap ps-3 text-[12px]">
                <span className="flex items-center gap-4 font-mono text-fg-2">
                  <span className="k-num">
                    <span className="font-sans text-fg-3">{t("toolbox.summary.equity")}:</span> <LiveMoney value={m.equity} format={(x) => accMoney(a, x)} className="px-0.5 text-fg" />
                  </span>
                  <span className="k-num">
                    <span className="font-sans text-fg-3">{t("toolbox.summary.margin")}:</span> <span className="text-fg">{accMoney(a, m.margin)}</span>
                  </span>
                  <span className="k-num">
                    <span className="font-sans text-fg-3">{t("toolbox.summary.freeMargin")}:</span> <span className={m.free < 0 ? "text-down" : "text-fg"}>{accMoney(a, m.free)}</span> <span className="font-sans text-[10.5px] text-fg-3">{accCcy(a)}</span>
                  </span>
                  <span className="font-sans text-[10.5px] text-fg-3">{t("trader.opt.pos.sharedAccount")}</span>
                </span>
              </td>
              <td className="h-[28px] whitespace-nowrap px-2 text-end text-[12px] font-semibold">
                <Pnl value={total.profit} text={usdSigned(total.profit)} format={(x) => usdSigned(x)} arrow />
              </td>
              <td className="px-2 text-end font-mono text-[12px] text-fg">{greek(total.delta, 3)}</td>
              <td className="px-2 text-end font-mono text-[12px] text-fg-2">{greek(total.gamma, 4)}</td>
              <td className={cn("px-2 text-end font-mono text-[12px]", total.theta < 0 ? "text-down" : "text-fg-2")}>{usd(total.theta)}</td>
              <td className="px-2 text-end font-mono text-[12px] text-fg-2">{usd(total.vega)}</td>
              <td colSpan={2} className="pe-3 text-end text-[10.5px] text-fg-3">
                {t("trader.opt.pos.greeksTotal")}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
