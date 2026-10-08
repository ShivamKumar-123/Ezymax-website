"use client";

import * as React from "react";
import { AlertTriangle, Route as RouteIcon } from "lucide-react";
import { Button, Chip, Dialog, DialogClose, Field, Input, PriceText, Segmented, Toggle, cn, formatNumber, useQuote } from "@ezymex/ui";
import { getInstrument, priceFeed } from "@ezymex/mock";
import {
  accountMetrics,
  clientName,
  getAccount,
  marginFor,
  notionalUsd,
  openPriceOf,
  resolveRoute,
  symbolSpec,
  volumeError,
  useDesk,
  type Book,
  type TradeType,
} from "@/lib/trading-desk";
import { AccountPicker, AuditNotice, BookChip, ErrorBanner, MetaTile, ReasonFields, Stepper, SymbolPicker, money, parseNum, reportResult, useReason } from "./kit";

const TYPES: { value: TradeType; label: string }[] = [
  { value: "market", label: "Market" },
  { value: "limit", label: "Limit" },
  { value: "stop", label: "Stop" },
  { value: "stop-limit", label: "Stop-limit" },
];

export function CreateTradeDrawer({ open, onOpenChange, initialLogin, initialSymbol, initialType }: { open: boolean; onOpenChange: (o: boolean) => void; initialLogin?: string; initialSymbol?: string; initialType?: TradeType }) {
  const { state, api } = useDesk();
  const [login, setLogin] = React.useState<string | null>(initialLogin ?? null);
  const [symbol, setSymbol] = React.useState(initialSymbol ?? "XAUUSD");
  const [side, setSide] = React.useState<"buy" | "sell">("buy");
  const [type, setType] = React.useState<TradeType>("market");
  const [vol, setVol] = React.useState("0.10");
  const [manual, setManual] = React.useState(false);
  const [price, setPrice] = React.useState("");
  const [stopLimit, setStopLimit] = React.useState("");
  const [sl, setSl] = React.useState("");
  const [tp, setTp] = React.useState("");
  const [bookOverride, setBookOverride] = React.useState<Book | null>(null);
  const [comment, setComment] = React.useState("");
  const [expiry, setExpiry] = React.useState<"GTC" | "Today">("GTC");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const r = useReason();
  const q = useQuote(symbol);
  const inst = getInstrument(symbol);
  const spec = symbolSpec(symbol);

  React.useEffect(() => {
    if (open) {
      if (initialLogin) setLogin(initialLogin);
      if (initialSymbol) setSymbol(initialSymbol);
      if (initialType) setType(initialType);
    } else {
      setError(null);
      setBusy(false);
      setPrice("");
      setStopLimit("");
      setSl("");
      setTp("");
      setComment("");
      setManual(false);
      setBookOverride(null);
      r.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  React.useEffect(() => {
    setVol(spec.min >= 1 ? "1" : spec.min >= 0.1 ? "1.0" : "0.10");
    setPrice("");
    setStopLimit("");
    setSl("");
    setTp("");
  }, [symbol, spec.min]);

  const acc = login ? getAccount(login) : undefined;
  const client = acc ? { name: clientName(acc.clientId, acc.login) } : null;
  const volume = Number(vol) || 0;
  const ctl = login ? state.accountControls.find((c) => c.login === login) : undefined;
  const volErr = volumeError(symbol, volume, ctl?.maxLot);
  const route = acc ? resolveRoute(state.routingRules, { login: acc.login, group: acc.group, symbol, volume, clientId: acc.clientId }) : null;
  const book: Book = bookOverride ?? route?.book ?? "B";
  const mkt = openPriceOf(side, q);
  const execPrice = type === "market" ? (manual ? parseNum(price) ?? 0 : mkt) : parseNum(price) ?? 0;
  const feedQuote = React.useCallback((s: string) => priceFeed().quote(s), []);
  const metrics = login ? accountMetrics(state, login, feedQuote) : null;
  const need = acc && execPrice > 0 ? marginFor(symbol, volume, execPrice, acc.leverage, feedQuote) : 0;
  const freeAfter = metrics ? metrics.freeMargin - need : 0;
  const symCtl = state.symbolControls.find((c) => c.symbol === symbol && (c.group === "all" || c.group === acc?.group));
  const warnings = [
    acc && acc.status !== "active" && `Account is ${acc.status}`,
    ctl?.tradingDisabled && "Trading disabled on this account",
    ctl?.closeOnly && "Account is close-only",
    symCtl && `${symbol} is ${symCtl.mode === "halt" ? "halted" : "close-only"}${symCtl.group === "all" ? "" : ` for ${symCtl.group}`}`,
    ctl && ctl.execDelayMs > 0 && type === "market" && !manual && (state.tenant.execDelayEnabled ? `Execution delay ${Math.min(ctl.execDelayMs, state.tenant.execDelayCapMs)} ms applies (tenant policy on)` : null),
    metrics && need > metrics.freeMargin && "Required margin exceeds free margin",
  ].filter(Boolean) as string[];
  const blocking = !login ? "Select an account" : volErr ? volErr : type !== "market" && !(parseNum(price)! > 0) ? "Enter the order price" : type === "market" && manual && !(parseNum(price)! > 0) ? "Enter the manual price" : type === "market" && manual && !r.note.trim() ? "Manual price needs a note" : r.error;

  const submit = async () => {
    if (!login) return;
    setBusy(true);
    setError(null);
    const res = await api.createTrade(
      {
        login,
        symbol,
        side,
        type,
        volume,
        price: type === "market" ? (manual ? parseNum(price) : undefined) : parseNum(price),
        stopLimit: type === "stop-limit" ? parseNum(stopLimit) : undefined,
        sl: parseNum(sl) || undefined,
        tp: parseNum(tp) || undefined,
        book,
        comment: comment.trim() || undefined,
        expiry: type === "market" ? undefined : expiry,
      },
      r.reason,
    );
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      reportResult(res, "");
      return;
    }
    reportResult(res, (d) => (d.kind === "position" ? `#${d.ticket} ${side.toUpperCase()} ${volume} ${symbol} @ ${formatNumber(d.price, inst.digits)} · ${d.book}-book` : `Order #${d.ticket} placed · ${d.book}-book`), res.data.delayMs ? `delay ${res.data.delayMs} ms` : undefined);
    onOpenChange(false);
  };

  const label = type === "market" ? `${side === "buy" ? "Buy" : "Sell"} ${vol} ${symbol}` : `Place ${side === "buy" ? "Buy" : "Sell"} ${TYPES.find((t) => t.value === type)!.label}`;

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      side="right"
      title="Create trade"
      description="Dealer ticket on a client account. Source “dealer”, visible in the client’s history."
      footer={
        <>
          <span className="mr-auto max-w-[240px] truncate text-[11.5px] text-fg-3">{blocking}</span>
          <DialogClose asChild>
            <Button variant="ghost" size="sm">
              Cancel
            </Button>
          </DialogClose>
          <Button variant={side === "buy" ? "buy" : "sell"} size="sm" disabled={!!blocking || busy} onClick={submit}>
            {busy ? "Executing…" : label}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <AccountPicker value={login} onChange={setLogin} />
        {acc && client && metrics && (
          <div className="grid grid-cols-4 gap-2">
            <MetaTile label="Balance" value={money(metrics.balance, 0)} />
            <MetaTile label="Equity" value={money(metrics.equity, 0)} />
            <MetaTile label="Free margin" value={money(metrics.freeMargin, 0)} tone={metrics.freeMargin < 0 ? "down" : undefined} />
            <MetaTile label="Margin lvl" value={metrics.level === Infinity ? "—" : `${formatNumber(metrics.level, 0)}%`} tone={metrics.level < 100 ? "down" : metrics.level < 200 ? "warn" : undefined} />
          </div>
        )}
        <SymbolPicker value={symbol} onChange={setSymbol} />

        <div className="grid grid-cols-2 gap-2">
          {(["sell", "buy"] as const).map((s) => {
            const on = side === s;
            const px = s === "buy" ? q.ask : q.bid;
            return (
              <button
                key={s}
                type="button"
                onClick={() => setSide(s)}
                aria-pressed={on}
                className={cn(
                  "rounded-[14px] border px-3.5 py-2.5 text-left transition-colors",
                  on ? (s === "buy" ? "border-up/50 bg-up-soft" : "border-down/50 bg-down-soft") : "border-line bg-surface-2 hover:border-fg-3",
                )}
              >
                <div className={cn("text-[11px] font-semibold uppercase tracking-wider", s === "buy" ? "text-up" : "text-down")}>{s === "buy" ? "Buy · ask" : "Sell · bid"}</div>
                <PriceText symbol={symbol} value={px} dir={q.dir} className="text-[18px]" />
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Segmented size="sm" value={type} onChange={setType} options={TYPES} />
          {type !== "market" && <Segmented size="xs" value={expiry} onChange={setExpiry} options={[{ value: "GTC", label: "GTC" }, { value: "Today", label: "Today" }]} />}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="mb-1.5 flex items-center justify-between text-[12.5px] font-medium text-fg-2">
              Volume <span className="font-normal text-fg-3">{spec.min}–{ctl?.maxLot ? Math.min(ctl.maxLot, spec.max) : spec.max} · step {spec.step}</span>
            </div>
            <Stepper value={vol} onChange={setVol} step={spec.step} min={spec.min} digits={spec.step >= 1 ? 0 : spec.step >= 0.1 ? 1 : 2} suffix="lots" ariaLabel="Volume" />
            {volErr && vol && <div className="mt-1 text-[11.5px] text-down">{volErr}</div>}
          </div>
          {type === "market" ? (
            <div>
              <div className="mb-1.5 flex items-center justify-between text-[12.5px] font-medium text-fg-2">
                Fill price
                <span className="flex items-center gap-1.5 font-normal text-fg-3">
                  Manual <Toggle checked={manual} onChange={setManual} label="Manual price" />
                </span>
              </div>
              {manual ? (
                <Input value={price} onChange={(e) => setPrice(e.target.value)} placeholder={formatNumber(mkt, inst.digits)} aria-label="Manual price" className="border-warn/40 font-mono" />
              ) : (
                <div className="flex h-11 items-center justify-between rounded-[14px] border border-line bg-surface-2/60 px-3.5">
                  <span className="text-[11.5px] text-fg-3">at market</span>
                  <PriceText symbol={symbol} value={mkt} dir={q.dir} className="text-[14px]" />
                </div>
              )}
            </div>
          ) : (
            <Field label={type === "limit" ? "Limit price" : "Stop price"} hint={`mkt ${formatNumber(mkt, inst.digits)}`}>
              <Input value={price} onChange={(e) => setPrice(e.target.value)} placeholder={formatNumber(mkt, inst.digits)} aria-label="Order price" className="font-mono" />
            </Field>
          )}
          {type === "stop-limit" && (
            <Field label="Limit price" hint="after the stop triggers">
              <Input value={stopLimit} onChange={(e) => setStopLimit(e.target.value)} placeholder="—" aria-label="Stop-limit price" className="font-mono" />
            </Field>
          )}
          <Field label="Stop loss">
            <Input value={sl} onChange={(e) => setSl(e.target.value)} placeholder="None" aria-label="Stop loss" className="font-mono" />
          </Field>
          <Field label="Take profit">
            <Input value={tp} onChange={(e) => setTp(e.target.value)} placeholder="None" aria-label="Take profit" className="font-mono" />
          </Field>
        </div>
        {manual && type === "market" && (
          <div className="flex items-start gap-2.5 rounded-[14px] border border-warn/30 bg-warn-soft px-3.5 py-2.5 text-[12px] text-fg-2">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-warn" />
            Manual prices are flagged “manual price” in the audit log and need a note with the price source (e.g. recorded phone order, LP fill).
          </div>
        )}

        <div className="rounded-[14px] border border-line bg-surface-2 p-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-[12.5px] font-medium text-fg-2">
              <RouteIcon className="size-3.5 text-fg-3" /> Book
            </div>
            <Segmented size="xs" value={book} onChange={(b) => setBookOverride(b)} options={[{ value: "A", label: "A-book" }, { value: "B", label: "B-book" }]} />
          </div>
          <div className="mt-2 text-[11.5px] text-fg-3">
            {route ? (
              <>
                Routing: {route.rule ? <span className="text-fg-2">{route.rule.id} · {route.rule.name}</span> : "default rule"} → <BookChip book={route.book} />
                {route.pct < 100 && ` (${route.pct}%)`}
                {bookOverride && bookOverride !== route.book && <Chip size="sm" tone="warn" className="ml-2">Dealer override</Chip>}
              </>
            ) : (
              "Select an account to evaluate the routing rules."
            )}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <MetaTile label="Notional" value={execPrice ? money(notionalUsd(symbol, volume, execPrice, feedQuote), 0) : "—"} />
          <MetaTile label="Required margin" value={need ? money(need) : "—"} />
          <MetaTile label="Free after" value={metrics ? money(freeAfter, 0) : "—"} tone={metrics && freeAfter < 0 ? "down" : undefined} />
        </div>

        {warnings.length > 0 && (
          <div className="space-y-1.5">
            {warnings.map((w) => (
              <div key={w} className="flex items-center gap-2 text-[12px] text-warn">
                <AlertTriangle className="size-3.5 shrink-0" /> {w}
              </div>
            ))}
          </div>
        )}

        <Field label="Comment" hint="shown on the ticket">
          <Input value={comment} onChange={(e) => setComment(e.target.value)} placeholder="e.g. Phone order, recording #4471" aria-label="Comment" maxLength={64} />
        </Field>
        <ReasonFields r={r} noteRequiredHint={manual && type === "market"} />
        <ErrorBanner error={error} />
        <AuditNotice />
      </div>
    </Dialog>
  );
}
