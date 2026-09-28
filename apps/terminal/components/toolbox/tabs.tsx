"use client";

import * as React from "react";
import { toast } from "@/lib/notify";
import { Bell, BellOff, Copy, Newspaper, Pencil, Plus, Trash2 } from "lucide-react";
import { CALENDAR, INSTRUMENTS, NEWS, getInstrument, priceFeed } from "@kalks/mock";
import { Flag, SymbolAvatar, cn, useQuote, useQuotes } from "@kalks/ui";
import { journalTime, useTerminal, type JournalLine } from "@/lib/store";
import { accCcy, accMoney, fmtPrice, fmtServer, fmtVol, splitSymbol } from "@/lib/trading";
import { Td, Th } from "@/components/ui/panel";
import { PickBox } from "@/components/share/share-dialogs";
import { shareUi, useShareUi } from "@/lib/share";
import { useContextMenu } from "@/components/ui/menu";
import { Share2 } from "lucide-react";
import { Badge, Empty, Pnl, Stepper, TButton, TInput, TSelect } from "@/components/ui/primitives";

/* ------------------------------------------------------------------ */
/* History                                                             */
/* ------------------------------------------------------------------ */

const PERIODS = [
  { value: "today", label: "Today", days: 1 },
  { value: "3d", label: "Last 3 days", days: 3 },
  { value: "week", label: "Last week", days: 7 },
  { value: "month", label: "Last month", days: 30 },
  { value: "3m", label: "Last 3 months", days: 90 },
  { value: "all", label: "All history", days: 99999 },
] as const;
type Period = (typeof PERIODS)[number]["value"];

export function HistoryTab() {
  const T = useTerminal();
  const a = T.account;
  const [period, setPeriod] = React.useState<Period>("month");
  const [sym, setSym] = React.useState("all");
  const days = PERIODS.find((p) => p.value === period)!.days;
  const now = Date.now();
  const since = period === "today" ? new Date(new Date(now + 3 * 3600e3).toISOString().slice(0, 10) + "T00:00:00Z").getTime() - 3 * 3600e3 : now - days * 86400e3;
  const rows = T.history.filter((h) => Date.parse(h.closeTime) >= since && (sym === "all" || h.symbol === sym));
  const syms = [...new Set(T.history.map((h) => h.symbol))].sort();
  const wins = rows.filter((r) => r.profit > 0);
  const losses = rows.filter((r) => r.profit < 0);
  const gp = wins.reduce((s, r) => s + r.profit, 0);
  const gl = losses.reduce((s, r) => s + r.profit, 0);
  const net = gp + gl;
  const pf = gl !== 0 ? gp / Math.abs(gl) : Infinity;
  const shown = rows.slice(0, 300);
  const picking = useShareUi().selecting;
  const cm = useContextMenu(210);
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-8 shrink-0 items-center gap-2 border-b border-line px-2">
        <div className="flex items-center gap-0.5">
          {PERIODS.map((p) => (
            <button key={p.value} onClick={() => setPeriod(p.value)} className={cn("h-6 rounded-[5px] px-2 text-[11px]", period === p.value ? "bg-surface-3 text-fg" : "text-fg-3 hover:text-fg-2")}>
              {p.label}
            </button>
          ))}
        </div>
        <TSelect ariaLabel="Symbol filter" value={sym} onChange={setSym} options={[{ value: "all", label: "All symbols" }, ...syms.map((s) => ({ value: s, label: s }))]} className="h-6 w-[130px] text-[11px]" />
        <div className="ml-auto flex items-center gap-3 font-mono text-[11px] text-fg-3">
          <span>
            Trades <span className="text-fg">{rows.length}</span>
          </span>
          <span>
            Win rate <span className="text-fg">{rows.length ? ((wins.length / rows.length) * 100).toFixed(1) : "0.0"}%</span>
          </span>
          <span className="hidden xl:inline">
            Gross <span className="text-up">{accMoney(a, gp)}</span> / <span className="text-down">{accMoney(a, gl)}</span>
          </span>
          <span>
            PF <span className="text-fg">{Number.isFinite(pf) ? pf.toFixed(2) : "∞"}</span>
          </span>
          <TButton size="xs" variant="outline" onClick={() => toast.success("Report exported", { description: `ReportHistory-${a.login}.html · ${rows.length} deals` })}>
            Report
          </TButton>
        </div>
      </div>
      <div className="t-scroll min-h-0 flex-1 overflow-auto">
        <table className="w-full min-w-[1080px] border-separate border-spacing-0">
          <thead>
            <tr>
              {picking && <Th className="w-7 pl-3" />}
              <Th className={picking ? undefined : "pl-3"}>Open time</Th>
              <Th>Ticket</Th>
              <Th>Symbol</Th>
              <Th>Type</Th>
              <Th right>Volume</Th>
              <Th right>Price</Th>
              <Th right>S / L</Th>
              <Th right>T / P</Th>
              <Th>Close time</Th>
              <Th right>Price</Th>
              <Th right>Swap</Th>
              <Th right>Commission</Th>
              <Th right>Profit</Th>
              <Th>Reason</Th>
            </tr>
          </thead>
          <tbody>
            {shown.map((h) => {
              const d = getInstrument(h.symbol).digits;
              return (
                <tr
                  key={`${h.ticket}-${h.closeTime}`}
                  onClick={picking ? () => shareUi.toggle(h.ticket) : undefined}
                  onContextMenu={(e) => cm.open(e, [{ label: "Share this trade…", icon: <Share2 />, onSelect: () => shareUi.shareOne(h.ticket) }, { label: "Copy ticket", onSelect: () => (navigator.clipboard?.writeText(h.ticket).catch(() => {}), toast("Ticket copied", { description: `#${h.ticket}` })) }], `#${h.ticket} ${h.side} ${fmtVol(h.volume)} ${h.symbol}`)}
                  className="hover:bg-surface-2/70"
                >
                  {picking && (
                    <Td className="w-7 pl-3">
                      <PickBox ticket={h.ticket} />
                    </Td>
                  )}
                  <Td mono className={cn("text-fg-3", !picking && "pl-3")}>
                    {fmtServer(h.openTime)}
                  </Td>
                  <Td mono className="text-fg-3">
                    {h.ticket}
                  </Td>
                  <Td>
                    <span className="flex items-center gap-1.5 font-medium">
                      <SymbolAvatar symbol={h.symbol} size={13} />
                      {h.symbol}
                    </span>
                  </Td>
                  <Td>
                    <span className={h.side === "buy" ? "text-up" : "text-down"}>{h.side}</span>
                  </Td>
                  <Td right mono>
                    {fmtVol(h.volume)}
                  </Td>
                  <Td right mono className="text-fg-2">
                    {h.openPrice.toFixed(d)}
                  </Td>
                  <Td right mono className="text-fg-3">
                    {h.sl !== undefined ? h.sl.toFixed(d) : "—"}
                  </Td>
                  <Td right mono className="text-fg-3">
                    {h.tp !== undefined ? h.tp.toFixed(d) : "—"}
                  </Td>
                  <Td mono className="text-fg-3">
                    {fmtServer(h.closeTime)}
                  </Td>
                  <Td right mono className="text-fg-2">
                    {h.closePrice.toFixed(d)}
                  </Td>
                  <Td right mono className="text-fg-2">
                    {accMoney(a, h.swap)}
                  </Td>
                  <Td right mono className="text-fg-2">
                    {accMoney(a, -h.commission)}
                  </Td>
                  <Td right className="font-semibold">
                    <Pnl value={h.profit} text={accMoney(a, h.profit)} />
                  </Td>
                  <Td className="text-fg-3">
                    <span className="flex items-center gap-1" title={h.comment}>
                      {h.source === "ai" && <Badge tone="ember">AI</Badge>}
                      {h.reason === "sl" ? <Badge tone="down">SL</Badge> : h.reason === "tp" ? <Badge tone="up">TP</Badge> : <span className="text-[11px]">{h.reason ?? h.source}</span>}
                      {h.source === "ai" && h.comment && <span className="max-w-[160px] truncate text-[11px]">{h.comment}</span>}
                    </span>
                  </Td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={picking ? 15 : 14} className="h-12 text-center text-[12px] text-fg-3">
                  No closed trades in this period
                </td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr className="[&>td]:sticky [&>td]:bottom-0 [&>td]:border-t [&>td]:border-line [&>td]:bg-panel-2">
              <td colSpan={picking ? 13 : 12} className="h-[28px] whitespace-nowrap pl-3 font-mono text-[12px] text-fg-2">
                <span className="flex gap-4">
                  <span>
                    <span className="font-sans text-fg-3">Profit:</span> <span className={net >= 0 ? "text-up" : "text-down"}>{accMoney(a, net)}</span>
                  </span>
                  <span>
                    <span className="font-sans text-fg-3">Credit:</span> {accMoney(a, a.cent ? a.credit / 100 : a.credit)}
                  </span>
                  <span>
                    <span className="font-sans text-fg-3">Deposit:</span> {accMoney(a, a.cent ? a.balance / 100 : a.balance)}
                  </span>
                  <span>
                    <span className="font-sans text-fg-3">Withdrawal:</span> 0.00
                  </span>
                  <span>
                    <span className="font-sans text-fg-3">Balance:</span> <span className="text-fg">{accMoney(a, T.balances[a.login] ?? 0)} {accCcy(a)}</span>
                  </span>
                  {rows.length > shown.length && <span className="font-sans text-fg-3">showing latest {shown.length} of {rows.length}</span>}
                </span>
              </td>
              <td className="px-2 text-right text-[12px] font-semibold">
                <Pnl value={net} text={accMoney(a, net)} />
              </td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
      {cm.node}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Exposure                                                            */
/* ------------------------------------------------------------------ */

export function ExposureTab() {
  const T = useTerminal();
  const a = T.account;
  const syms = [...new Set(T.positions.map((p) => p.symbol))];
  const qs = useQuotes(syms.length ? syms : ["EURUSD"]);
  const assets = new Map<string, { vol: number; usd: number; rate: number }>();
  const add = (asset: string, vol: number, usd: number, rate: number) => {
    const cur = assets.get(asset) ?? { vol: 0, usd: 0, rate };
    assets.set(asset, { vol: cur.vol + vol, usd: cur.usd + usd, rate });
  };
  for (const p of T.positions) {
    const q = qs[p.symbol] ?? priceFeed().snapshot(p.symbol)!;
    const inst = getInstrument(p.symbol);
    const { base, quote } = splitSymbol(p.symbol);
    const units = p.volume * inst.contractSize * (p.side === "buy" ? 1 : -1);
    const px = (q.bid + q.ask) / 2;
    const quoteUsd = quote === "USD" ? 1 : base === "USD" ? 1 / px : 1 / (priceFeed().snapshot(`USD${quote}`)?.bid ?? px);
    add(base, units, units * px * quoteUsd, base === "USD" ? 1 : px * quoteUsd);
    add(quote, -units * px, -units * px * quoteUsd, quoteUsd);
  }
  const list = [...assets.entries()].sort((x, y) => Math.abs(y[1].usd) - Math.abs(x[1].usd));
  const max = Math.max(1, ...list.map(([, v]) => Math.abs(v.usd)));
  if (!list.length) return <Empty title="No exposure" sub="Open positions to see your net exposure per asset." />;
  return (
    <div className="t-scroll h-full overflow-auto">
      <table className="w-full min-w-[720px] border-separate border-spacing-0">
        <thead>
          <tr>
            <Th className="pl-3">Asset</Th>
            <Th right>Volume</Th>
            <Th right>Rate</Th>
            <Th right>USD</Th>
            <Th className="w-[40%]">Graph</Th>
          </tr>
        </thead>
        <tbody>
          {list.map(([asset, v]) => (
            <tr key={asset} className="hover:bg-surface-2/70">
              <Td className="pl-3 font-medium">{asset}</Td>
              <Td right mono className={v.vol >= 0 ? "text-up" : "text-down"}>
                {v.vol.toLocaleString("en-US", { maximumFractionDigits: 2 })}
              </Td>
              <Td right mono className="text-fg-2">
                {v.rate.toFixed(v.rate > 100 ? 2 : 5)}
              </Td>
              <Td right mono className={v.usd >= 0 ? "text-up" : "text-down"}>
                {v.usd.toLocaleString("en-US", { maximumFractionDigits: 2, minimumFractionDigits: 2 })}
              </Td>
              <Td>
                <div className="relative h-2.5">
                  <span className="absolute inset-y-0 left-1/2 w-px bg-line" />
                  <span className={cn("absolute inset-y-0 rounded-[2px]", v.usd >= 0 ? "left-1/2 bg-up/70" : "right-1/2 bg-down/70")} style={{ width: `${(Math.abs(v.usd) / max) * 50}%` }} />
                </div>
              </Td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="px-3 py-2 text-[11px] text-fg-3">Net exposure per asset in {accCcy(a) === "USC" ? "USD (account shown in USC)" : "USD"} · long positive, short negative</div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* News                                                                */
/* ------------------------------------------------------------------ */

export function NewsTab() {
  const T = useTerminal();
  return (
    <div className="t-scroll h-full overflow-auto p-2">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {NEWS.map((n) => (
          <button
            key={n.id}
            onClick={() => {
              const s = n.symbols.find((x) => INSTRUMENTS.some((i) => i.symbol === x));
              if (s) T.openSymbol(s);
              toast(n.title, { description: `${n.source} · ${n.minutesAgo} min ago` });
            }}
            className="group flex gap-2.5 rounded-[7px] border border-line bg-surface-2/40 p-1.5 text-left transition-colors hover:border-line-top hover:bg-surface-2"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={n.image} alt="" className="h-[62px] w-[88px] shrink-0 rounded-[5px] object-cover opacity-90 group-hover:opacity-100" />
            <div className="min-w-0 py-0.5">
              <div className="flex items-center gap-1.5 text-[10px] text-fg-3">
                <Flag country={n.country} className="size-3" />
                <span>{n.source}</span>
                <span>· {n.minutesAgo}m</span>
                <Badge tone={n.sentiment === "bullish" ? "up" : n.sentiment === "bearish" ? "down" : "neutral"} className="ml-auto h-4 text-[8.5px]">
                  {n.sentiment}
                </Badge>
              </div>
              <div className="mt-1 line-clamp-2 text-[12px] font-medium leading-[1.3] text-fg">{n.title}</div>
              <div className="mt-1 flex gap-1">
                {n.symbols.slice(0, 3).map((s) => (
                  <span key={s} className="rounded-[3px] bg-surface-3 px-1 font-mono text-[9.5px] text-fg-2">
                    {s}
                  </span>
                ))}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Calendar                                                            */
/* ------------------------------------------------------------------ */

export function CalendarTab() {
  const sorted = [...CALENDAR].sort((a, b) => ((a.time < "06:00" ? "3" : "") + a.time).localeCompare((b.time < "06:00" ? "3" : "") + b.time));
  return (
    <div className="t-scroll h-full overflow-auto">
      <table className="w-full min-w-[760px] border-separate border-spacing-0">
        <thead>
          <tr>
            <Th className="pl-3">Time</Th>
            <Th>Ccy</Th>
            <Th>Impact</Th>
            <Th>Event</Th>
            <Th right>Actual</Th>
            <Th right>Forecast</Th>
            <Th right>Previous</Th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((e) => (
            <tr key={e.id} className="hover:bg-surface-2/70">
              <Td mono className={cn("pl-3", e.impact === 3 ? "shadow-[inset_3px_0_0_var(--k-down)]" : e.impact === 2 ? "shadow-[inset_3px_0_0_var(--k-warn)]" : "shadow-[inset_3px_0_0_var(--k-surface-3)]")}>
                {e.time}
              </Td>
              <Td>
                <span className="flex items-center gap-1.5">
                  <Flag country={e.country} className="size-3.5" />
                  <span className="font-mono text-[11px]">{e.currency}</span>
                </span>
              </Td>
              <Td>
                <span className="flex gap-0.5">
                  {[1, 2, 3].map((i) => (
                    <span key={i} className={cn("h-2.5 w-1 rounded-[1px]", i <= e.impact ? (e.impact === 3 ? "bg-down" : e.impact === 2 ? "bg-warn" : "bg-fg-3") : "bg-surface-3")} />
                  ))}
                </span>
              </Td>
              <Td className="font-medium">{e.title}</Td>
              <Td right mono className={e.actual ? "text-fg" : "text-fg-3"}>
                {e.actual ?? "—"}
              </Td>
              <Td right mono className="text-fg-2">
                {e.forecast}
              </Td>
              <Td right mono className="text-fg-3">
                {e.previous}
              </Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Alerts                                                              */
/* ------------------------------------------------------------------ */

export function AlertsTab() {
  const T = useTerminal();
  const [symbol, setSymbol] = React.useState(T.activeSymbol);
  const q = useQuote(symbol);
  const [cond, setCond] = React.useState<"above" | "below">("above");
  const [price, setPrice] = React.useState("");
  const [note, setNote] = React.useState("");
  const [edit, setEdit] = React.useState<string | null>(null);
  const d = getInstrument(symbol).digits;
  const submit = () => {
    const p = parseFloat(price) || q.bid;
    if (edit) {
      T.updateAlert(edit, { symbol, cond, price: p, note: note || undefined, active: true, triggeredAt: undefined });
      toast.success("Alert updated");
      setEdit(null);
    } else T.addAlert({ symbol, cond, price: p, note: note || undefined });
    setPrice("");
    setNote("");
  };
  return (
    <div className="flex h-full min-h-0">
      <div className="w-[250px] shrink-0 space-y-2 border-r border-line p-2.5">
        <div className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-fg-3">{edit ? "Edit alert" : "New alert"}</div>
        <TSelect ariaLabel="Alert symbol" value={symbol} onChange={setSymbol} options={INSTRUMENTS.map((i) => i.symbol)} />
        <div className="grid grid-cols-2 gap-1.5">
          <TSelect ariaLabel="Condition" value={cond} onChange={setCond} options={[{ value: "above", label: "Bid ≥" }, { value: "below", label: "Bid ≤" }]} />
          <Stepper ariaLabel="Alert price" value={price} onChange={setPrice} step={1 / 10 ** d} placeholder={fmtPrice(symbol, q.bid)} decimals={d} />
        </div>
        <TInput value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)" />
        <div className="flex gap-1.5">
          <TButton variant="ember" className="flex-1" onClick={submit}>
            <Plus /> {edit ? "Save" : "Create alert"}
          </TButton>
          {edit && (
            <TButton variant="ghost" onClick={() => (setEdit(null), setPrice(""), setNote(""))}>
              Cancel
            </TButton>
          )}
        </div>
        <p className="text-[10.5px] leading-snug text-fg-3">{T.guest ? "Alerts are checked in this browser on every live tick while the terminal is open, with a sound + notification when triggered." : "Alerts are evaluated server-side on every tick and play a sound + toast when triggered."} Right-click a chart to set one at a price.</p>
      </div>
      <div className="t-scroll min-h-0 flex-1 overflow-auto">
        <table className="w-full min-w-[600px] border-separate border-spacing-0">
          <thead>
            <tr>
              <Th className="pl-3">Symbol</Th>
              <Th>Condition</Th>
              <Th right>Price</Th>
              <Th right>Current</Th>
              <Th>Note</Th>
              <Th>Status</Th>
              <Th>Created</Th>
              <Th className="w-20" />
            </tr>
          </thead>
          <tbody>
            {T.alerts.map((a) => (
              <AlertRow
                key={a.id}
                a={a}
                onEdit={() => {
                  setEdit(a.id);
                  setSymbol(a.symbol);
                  setCond(a.cond);
                  setPrice(fmtPrice(a.symbol, a.price));
                  setNote(a.note ?? "");
                }}
              />
            ))}
            {!T.alerts.length && (
              <tr>
                <td colSpan={8} className="h-12 text-center text-[12px] text-fg-3">
                  No alerts
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AlertRow({ a, onEdit }: { a: ReturnType<typeof useTerminal>["alerts"][number]; onEdit: () => void }) {
  const T = useTerminal();
  const q = useQuote(a.symbol);
  return (
    <tr className="group hover:bg-surface-2/70">
      <Td className="pl-3">
        <span className="flex items-center gap-1.5 font-medium">
          <SymbolAvatar symbol={a.symbol} size={13} />
          {a.symbol}
        </span>
      </Td>
      <Td className="text-fg-2">Bid {a.cond === "above" ? "≥" : "≤"}</Td>
      <Td right mono className="text-warn">
        {fmtPrice(a.symbol, a.price)}
      </Td>
      <Td right mono>
        {fmtPrice(a.symbol, q.bid)}
      </Td>
      <Td className="max-w-[180px] truncate text-fg-3">{a.note ?? "—"}</Td>
      <Td>{a.active ? <Badge tone="ember">Active</Badge> : a.triggeredAt ? <Badge tone="up">Triggered {fmtServer(a.triggeredAt, false).slice(11)}</Badge> : <Badge>Off</Badge>}</Td>
      <Td mono className="text-fg-3">
        {fmtServer(a.created, false)}
      </Td>
      <Td className="pr-2">
        <span className="flex justify-end gap-0.5">
          <button title={a.active ? "Disable" : "Enable"} onClick={() => T.updateAlert(a.id, { active: !a.active, triggeredAt: undefined })} className="grid size-5 place-items-center rounded-[4px] text-fg-3 hover:bg-surface-3 hover:text-fg">
            {a.active ? <BellOff className="size-3.5" /> : <Bell className="size-3.5" />}
          </button>
          <button title="Edit" onClick={onEdit} className="grid size-5 place-items-center rounded-[4px] text-fg-3 hover:bg-surface-3 hover:text-fg">
            <Pencil className="size-3.5" />
          </button>
          <button title="Delete" onClick={() => T.removeAlert(a.id)} className="grid size-5 place-items-center rounded-[4px] text-fg-3 hover:bg-down-soft hover:text-down">
            <Trash2 className="size-3.5" />
          </button>
        </span>
      </Td>
    </tr>
  );
}

/* ------------------------------------------------------------------ */
/* Journal                                                             */
/* ------------------------------------------------------------------ */

export function JournalTab() {
  const T = useTerminal();
  const [src, setSrc] = React.useState<"all" | JournalLine["src"]>("all");
  const [q, setQ] = React.useState("");
  const ref = React.useRef<HTMLDivElement>(null);
  const lines = T.journal.filter((l) => (src === "all" || l.src === src) && (!q || l.text.toLowerCase().includes(q.toLowerCase())));
  React.useEffect(() => {
    ref.current?.scrollTo({ top: ref.current.scrollHeight });
  }, [lines.length]);
  const text = (l: JournalLine) => `${journalTime(l.ts)}\t${l.src}\t${l.text}`;
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-8 shrink-0 items-center gap-2 border-b border-line px-2">
        {(["all", "Trade", "Network", "Terminal", "Alerts", "Experts", "Account"] as const).map((s) => (
          <button key={s} onClick={() => setSrc(s)} className={cn("h-6 rounded-[5px] px-2 text-[11px]", src === s ? "bg-surface-3 text-fg" : "text-fg-3 hover:text-fg-2")}>
            {s === "all" ? "All" : s}
          </button>
        ))}
        <TInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter…" className="ml-auto h-6 w-[180px] text-[11px]" />
        <TButton
          size="xs"
          variant="ghost"
          onClick={() => {
            navigator.clipboard?.writeText(lines.map(text).join("\n")).catch(() => {});
            toast("Journal copied", { description: `${lines.length} lines` });
          }}
        >
          <Copy /> Copy
        </TButton>
        <TButton size="xs" variant="ghost" onClick={() => T.clearJournal()}>
          <Trash2 /> Clear
        </TButton>
      </div>
      <div ref={ref} className="t-scroll min-h-0 flex-1 overflow-auto py-1 font-mono text-[11.5px] leading-[20px]">
        {lines.map((l) => (
          <div key={l.id} className={cn("flex gap-3 whitespace-nowrap px-3 hover:bg-surface-2/60", l.level === "error" ? "text-down" : l.level === "warn" ? "text-warn" : "text-fg-2")}>
            <span className="text-fg-3">{journalTime(l.ts)}</span>
            <span className={cn("w-16 shrink-0", l.src === "Trade" ? "text-ember" : l.src === "Network" ? "text-up/80" : "text-fg-3")}>{l.src}</span>
            <span>{l.text}</span>
          </div>
        ))}
        {!lines.length && <Empty icon={<Newspaper />} title="Journal is empty" />}
      </div>
    </div>
  );
}
