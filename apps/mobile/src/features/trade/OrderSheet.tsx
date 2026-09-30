// Order ticket as a bottom sheet: Sell / Buy, market / limit / stop, volume, optional stop loss and take profit
// (type a number or step it), a live margin / pip-value preview from the engine's contract specs, and one confirm
// button. The engine decides: a rejection is shown in words (order.reject.<code>) with a plain-language hint and the
// engine's own detail. The sheet scrolls, so on a small phone (or above the keyboard) the confirm button is always
// reachable.
import * as React from "react";
import { Keyboard, View } from "react-native";
import { Plus, X } from "lucide-react-native";
import { useT } from "@/i18n";
import { fmtLots, fmtMoney, fmtPrice } from "@/lib/format";
import { feed } from "@/market/feed";
import { instrument } from "@/market/instruments";
import { useSession } from "@/session";
import { RestrictionBanner } from "@/shell/RestrictionBanner";
import { Banner, Button, Display, Mono, PressableScale, PriceCell, Sheet, Text, useLiveQuote, type SheetRef } from "@/ui";
import { colors, radius, space } from "@/theme/tokens";
import { newClientOrderId, placeOrder } from "../trading/actions";
import { useAccountLive, useTrade } from "../trading/live";
import { clampLots, marginFor, pipValue, profitAt, useSpec } from "../trading/specs";
import { Stepper } from "../trading/Stepper";
import type { SymbolSpec } from "../trading/types";

export type TicketPreset = { symbol: string; side: "buy" | "sell"; volume: number };
type OrderType = "market" | "limit" | "stop";

export type OrderSheetHandle = { open: (p: TicketPreset) => void };

export const OrderSheet = React.forwardRef<OrderSheetHandle, { onVolume?: (symbol: string, v: number) => void }>(function OrderSheet({ onVolume }, ref) {
  const sheet = React.useRef<SheetRef>(null);
  const [preset, setPreset] = React.useState<TicketPreset | null>(null);
  const [key, setKey] = React.useState(0);
  React.useImperativeHandle(ref, () => ({
    open: (p) => {
      setPreset(p);
      setKey((k) => k + 1);
      requestAnimationFrame(() => sheet.current?.present());
    },
  }));
  return (
    <Sheet ref={sheet} scrollable onDismiss={() => setPreset(null)}>
      {preset ? <Ticket key={key} preset={preset} onDone={() => sheet.current?.dismiss()} onVolume={onVolume} /> : null}
    </Sheet>
  );
});

/** Decimals of a lot step (0.01 -> 2, 1 -> 0). */
const stepDigits = (step: number) => Math.max(0, -Math.floor(Math.log10(step) + 1e-9));

function Ticket({ preset, onDone, onVolume }: { preset: TicketPreset; onDone: () => void; onVolume?: (symbol: string, v: number) => void }) {
  const t = useT();
  const { symbol } = preset;
  const inst = instrument(symbol);
  const digits = inst.digits;
  const spec = useSpec(symbol);
  const account = useTrade((s) => s.account);
  const readOnly = useTrade((s) => s.readOnly);
  const restricted = useSession((s) => s.restricted);
  const [side, setSide] = React.useState(preset.side);
  const [type, setType] = React.useState<OrderType>("market");
  const [volume, setVolume] = React.useState(preset.volume);
  const pip = spec?.pipSize ?? 1 / 10 ** Math.max(0, digits - 1);
  const lotStep = spec?.lotStep || 0.01;
  const marketFor = (s: "buy" | "sell") => {
    const q = feed.quote(symbol);
    return q ? (s === "buy" ? q.ask : q.bid) : 0;
  };
  const [price, setPrice] = React.useState<number>(() => defaultPending(preset.side, "limit", marketFor(preset.side), pip, digits));
  const [sl, setSl] = React.useState<number | null>(null);
  const [tp, setTp] = React.useState<number | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<{ title: string; body: string } | null>(null);
  // one idempotency key per order: kept for a retry after no answer, new as soon as the order changes
  const cid = React.useRef(newClientOrderId());
  React.useEffect(() => {
    cid.current = newClientOrderId();
  }, [side, type, volume, price, sl, tp]);

  const entryFor = (ty: OrderType = type, p: number = price) => (ty === "market" ? marketFor(side) : p);

  // a new side / type: the pending price and the stops start from the market again
  const first = React.useRef(true);
  React.useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const np = type === "market" ? price : defaultPending(side, type, marketFor(side), pip, digits);
    if (type !== "market") setPrice(np);
    const entry = type === "market" ? marketFor(side) : np;
    setSl((v) => (v === null ? null : defaultStop(side, "sl", entry, pip, digits)));
    setTp((v) => (v === null ? null : defaultStop(side, "tp", entry, pip, digits)));
    setErr(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [side, type]);

  const closeOnly = restricted.includes("close_only") || !!account?.controls?.closeOnly;
  // close-only still lets a netting account reduce its position; the engine decides that case
  const blocked = readOnly || restricted.includes("trading") || !!account?.controls?.tradingDisabled || (closeOnly && account?.mode !== "netting");

  const normPrice = React.useCallback((v: number) => (v > 0 ? +v.toFixed(digits) : price), [digits, price]);
  const normLots = React.useCallback((v: number) => clampLots(spec, v), [spec]);

  async function submit() {
    Keyboard.dismiss();
    setErr(null);
    setBusy(true);
    const vol = clampLots(spec, volume);
    const q = feed.quote(symbol);
    const r = await placeOrder({
      symbol,
      side,
      type,
      volume: vol,
      price: type === "market" ? undefined : +price.toFixed(digits),
      sl,
      tp,
      requestedPrice: type === "market" && q ? (side === "buy" ? q.ask : q.bid) : undefined,
      deviationPoints: type === "market" ? 50 : undefined,
      clientOrderId: cid.current,
    });
    setBusy(false);
    if (r.ok) {
      onVolume?.(symbol, vol);
      onDone();
      return;
    }
    // a clear answer: the next confirm is a new order; no answer: the same key again, so it can't fill twice
    if (!r.uncertain) cid.current = newClientOrderId();
    setErr({ title: r.title, body: r.uncertain ? `${r.body}\n${t("mobileTrade.reject.uncertain.ticket")}` : r.body });
  }

  const buy = side === "buy";
  const confirm = t(buy ? "mobileTrade.ticket.confirmBuy" : "mobileTrade.ticket.confirmSell", { volume: fmtLots(volume), symbol });
  const suffix = type === "market" ? t("mobileTrade.ticket.atMarket") : t("mobileTrade.ticket.at", { price: fmtPrice(price, digits) });

  return (
    <View style={{ gap: space[4] }}>
      <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" }}>
        <View>
          <Text variant="label" tone="tertiary">
            {t("mobileTrade.ticket.title")}
          </Text>
          <Display size="md">{symbol}</Display>
        </View>
        <PressableScale onPress={onDone} accessibilityLabel={t("mobile.a11y.close")} style={{ width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface2 }}>
          <X size={18} color={colors.text2} />
        </PressableScale>
      </View>

      {/* Sell | Buy with live prices */}
      <View style={{ flexDirection: "row", gap: space[2] }}>
        {(["sell", "buy"] as const).map((s) => {
          const on = side === s;
          const tint = s === "buy" ? colors.up : colors.down;
          return (
            <PressableScale
              key={s}
              onPress={() => setSide(s)}
              haptics="select"
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              testID={`ticket-${s}`}
              style={{ flex: 1, height: 64, borderRadius: radius.lg, paddingHorizontal: space[4], justifyContent: "center", backgroundColor: on ? tint : colors.surface2, borderWidth: 1, borderColor: on ? tint : colors.line }}
            >
              <Text variant="label" color={on ? colors.ink : colors.text3}>
                {t(s === "buy" ? "common.buy" : "common.sell")}
              </Text>
              <PriceCell symbol={symbol} side={s === "buy" ? "ask" : "bid"} digits={digits} size={17} align="left" flash={!on} color={on ? colors.ink : undefined} style={{ paddingHorizontal: 0, marginStart: -2 }} />
            </PressableScale>
          );
        })}
      </View>

      {/* order type */}
      <View style={{ flexDirection: "row", gap: space[2] }}>
        {(["market", "limit", "stop"] as const).map((k) => (
          <PressableScale key={k} onPress={() => setType(k)} haptics="select" accessibilityRole="tab" accessibilityState={{ selected: type === k }} testID={`ticket-type-${k}`} style={{ flex: 1, height: 40, borderRadius: radius.pill, alignItems: "center", justifyContent: "center", backgroundColor: type === k ? colors.cream : colors.surface2 }}>
            <Text variant="callout" weight="700" color={type === k ? colors.ink : colors.text2}>
              {t(k === "market" ? "order.type.market" : k === "limit" ? "order.type.limit" : "order.type.stop")}
            </Text>
          </PressableScale>
        ))}
      </View>

      {type !== "market" ? <Stepper label={t("order.ticket.orderPrice")} value={price} digits={digits} step={pip} normalize={normPrice} onChange={setPrice} testID="ticket-price" /> : null}

      <Stepper
        label={t("order.ticket.volumeLots")}
        value={volume}
        digits={Math.max(2, stepDigits(lotStep))}
        step={lotStep}
        normalize={normLots}
        onChange={setVolume}
        chips={[0.01, 0.1, 0.5, 1].map((v) => ({ label: fmtLots(v), value: v }))}
        testID="ticket-volume"
      />

      <StopRow kind="sl" side={side} spec={spec} value={sl} digits={digits} pip={pip} volume={volume} entry={entryFor} onChange={setSl} cent={account?.cent} currency={account?.currency ?? "USD"} />
      <StopRow kind="tp" side={side} spec={spec} value={tp} digits={digits} pip={pip} volume={volume} entry={entryFor} onChange={setTp} cent={account?.cent} currency={account?.currency ?? "USD"} />

      <Preview symbol={symbol} side={side} volume={volume} spec={spec} leverage={account?.leverage ?? 100} cent={account?.cent} currency={account?.currency ?? "USD"} />

      {blocked ? <RestrictionBanner kinds={["trading", "close_only"]} /> : null}
      {readOnly ? <Banner tone="info" title={t("order.ticket.readOnlyTitle")} body={t("mobileTrade.state.readOnly")} /> : null}
      {err ? <Banner tone="error" title={err.title} body={err.body || undefined} /> : null}

      <Button label={`${confirm} ${suffix}`} variant={buy ? "buy" : "sell"} loading={busy} disabled={blocked || !spec} onPress={() => void submit()} testID="confirm-order" />
    </View>
  );
}

function defaultPending(side: "buy" | "sell", type: "limit" | "stop", at: number, pip: number, digits: number): number {
  // limits wait for a better price, stops for a breakout: 20 pips from the market
  const away = pip * 20;
  const below = (side === "buy" && type === "limit") || (side === "sell" && type === "stop");
  return at ? +(at + (below ? -away : away)).toFixed(digits) : 0;
}

function defaultStop(side: "buy" | "sell", kind: "sl" | "tp", entry: number, pip: number, digits: number): number {
  const away = pip * 20;
  const lower = (side === "buy") === (kind === "sl");
  return +(entry + (lower ? -away : away)).toFixed(digits);
}

function StopRow({ kind, side, spec, value, digits, pip, volume, entry, onChange, cent, currency }: { kind: "sl" | "tp"; side: "buy" | "sell"; spec: SymbolSpec | undefined; value: number | null; digits: number; pip: number; volume: number; entry: () => number; onChange: (v: number | null) => void; cent?: boolean; currency: string }) {
  const t = useT();
  const label = t(kind === "sl" ? "order.ticket.stopLoss" : "order.ticket.takeProfit");
  const norm = React.useCallback((v: number) => (v > 0 ? +v.toFixed(digits) : (value ?? v)), [digits, value]);
  if (value === null) {
    return (
      <PressableScale onPress={() => onChange(defaultStop(side, kind, entry(), pip, digits))} haptics="select" testID={`ticket-add-${kind}`} style={{ height: 48, borderRadius: radius.md, borderWidth: 1, borderStyle: "dashed", borderColor: colors.lineStrong, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: space[2] }}>
        <Plus size={16} color={colors.text2} />
        <Text variant="callout" weight="600" tone="secondary">
          {t(kind === "sl" ? "mobileTrade.ticket.addSl" : "mobileTrade.ticket.addTp")}
        </Text>
      </PressableScale>
    );
  }
  const e = entry();
  const money = spec && e ? profitAt(spec, side, volume, e, value, cent) : null;
  const pips = e ? Math.round(Math.abs(value - e) / pip) : 0;
  return (
    <Stepper
      label={label}
      value={value}
      digits={digits}
      step={pip}
      normalize={norm}
      onChange={onChange}
      testID={`ticket-${kind}`}
      labelEnd={
        <PressableScale onPress={() => onChange(null)} scaleTo={1} accessibilityLabel={`${label} ×`} style={{ minHeight: 28, minWidth: 44, alignItems: "flex-end", justifyContent: "center" }}>
          <X size={16} color={colors.text3} />
        </PressableScale>
      }
      caption={
        <Text variant="caption" tone={money === null ? "tertiary" : money >= 0 ? "up" : "down"} numberOfLines={1}>
          {money === null ? t("mobileTrade.ticket.distance", { n: pips }) : `${t("mobileTrade.ticket.ifHit", { money: fmtMoney(money, { signed: true, currency }) })} · ${t("mobileTrade.ticket.distance", { n: pips })}`}
        </Text>
      }
    />
  );
}

/** Margin / pip value / free margin after: re-renders with the price (a leaf of the ticket). */
function Preview({ symbol, side, volume, spec, leverage, cent, currency }: { symbol: string; side: "buy" | "sell"; volume: number; spec: SymbolSpec | undefined; leverage: number; cent?: boolean; currency: string }) {
  const t = useT();
  const q = useLiveQuote(symbol);
  const acc = useAccountLive();
  if (!spec || !q) {
    return (
      <Text variant="caption" tone="tertiary">
        {t("mobileTrade.ticket.noSpecs")}
      </Text>
    );
  }
  const price = side === "buy" ? q.ask : q.bid;
  const margin = marginFor(spec, volume, price, leverage, cent);
  const pv = pipValue(spec, volume, price, cent);
  const free = acc ? acc.freeMargin - margin : null;
  const cells: [string, string, boolean?][] = [
    [t("mobileTrade.ticket.required"), fmtMoney(margin, { currency })],
    [t("mobileTrade.ticket.pip"), fmtMoney(pv, { currency })],
    [t("mobileTrade.ticket.after"), free === null ? "—" : fmtMoney(free, { currency }), free !== null && free < 0],
  ];
  return (
    <View style={{ gap: space[2] }}>
      <View style={{ flexDirection: "row", borderRadius: radius.lg, backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.line, paddingVertical: space[3] }}>
        {cells.map(([k, v, bad], i) => (
          <View key={k} style={{ flex: 1, paddingHorizontal: space[3], borderStartWidth: i ? 1 : 0, borderStartColor: colors.line, gap: 4 }}>
            <Text variant="label" tone="tertiary" numberOfLines={1} style={{ fontSize: 9.5 }}>
              {k}
            </Text>
            <Mono size={13} weight="medium" tone={bad ? "down" : "primary"} numberOfLines={1} adjustsFontSizeToFit>
              {v}
            </Mono>
          </View>
        ))}
      </View>
      {free !== null && free < 0 ? (
        <Text variant="caption" tone="down">
          {t("mobileTrade.ticket.notEnough")}
        </Text>
      ) : null}
    </View>
  );
}
