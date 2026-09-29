// Order ticket as a bottom sheet: Sell / Buy, market / limit / stop, volume stepper, optional stop loss and
// take profit, a live margin / pip-value preview from the engine's contract specs, and one confirm button.
// The engine decides: a rejection is shown in words (order.reject.<code>) with the engine's own detail.
import * as React from "react";
import { View } from "react-native";
import { Minus, Plus, X } from "lucide-react-native";
import { useT } from "@/i18n";
import { fmtLots, fmtMoney, fmtPrice } from "@/lib/format";
import { feed } from "@/market/feed";
import { instrument } from "@/market/instruments";
import { isRestricted } from "@/session";
import { RestrictionBanner } from "@/shell/RestrictionBanner";
import { Banner, Button, Display, Mono, PressableScale, PriceCell, Sheet, Text, useLiveQuote, type SheetRef } from "@/ui";
import { colors, radius, space } from "@/theme/tokens";
import { placeOrder } from "../trading/actions";
import { useAccountLive, useTrade } from "../trading/live";
import { clampLots, marginFor, pipValue, profitAt, useSpec } from "../trading/specs";
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
    <Sheet ref={sheet} onDismiss={() => setPreset(null)}>
      {preset ? <Ticket key={key} preset={preset} onDone={() => sheet.current?.dismiss()} onVolume={onVolume} /> : null}
    </Sheet>
  );
});

function Ticket({ preset, onDone, onVolume }: { preset: TicketPreset; onDone: () => void; onVolume?: (symbol: string, v: number) => void }) {
  const t = useT();
  const { symbol } = preset;
  const inst = instrument(symbol);
  const digits = inst.digits;
  const spec = useSpec(symbol);
  const account = useTrade((s) => s.account);
  const readOnly = useTrade((s) => s.readOnly);
  const [side, setSide] = React.useState(preset.side);
  const [type, setType] = React.useState<OrderType>("market");
  const [volume, setVolume] = React.useState(preset.volume);
  const pip = spec?.pipSize ?? 1 / 10 ** Math.max(0, digits - 1);
  const ref = () => {
    const q = feed.quote(symbol);
    return q ? (side === "buy" ? q.ask : q.bid) : 0;
  };
  const [price, setPrice] = React.useState<number>(() => defaultPending(preset.side, "limit", ref(), pip));
  const [sl, setSl] = React.useState<number | null>(null);
  const [tp, setTp] = React.useState<number | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  // a new side / type: pending price and stops start from the market again
  React.useEffect(() => {
    if (type !== "market") setPrice(defaultPending(side, type, ref(), pip));
    setSl((v) => (v === null ? null : defaultStop(side, "sl", entryFor(), pip)));
    setTp((v) => (v === null ? null : defaultStop(side, "tp", entryFor(), pip)));
    setErr(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [side, type]);

  const entryFor = () => (type === "market" ? ref() : price);
  const blocked = readOnly || isRestricted("trading") || isRestricted("close_only") || !!account?.controls?.tradingDisabled || !!account?.controls?.closeOnly;

  async function submit() {
    setErr(null);
    setBusy(true);
    const q = feed.quote(symbol);
    const r = await placeOrder({
      symbol,
      side,
      type,
      volume,
      price: type === "market" ? undefined : price,
      sl,
      tp,
      requestedPrice: type === "market" && q ? (side === "buy" ? q.ask : q.bid) : undefined,
      deviationPoints: type === "market" ? 50 : undefined,
    });
    setBusy(false);
    if (r.ok) {
      onVolume?.(symbol, volume);
      onDone();
    } else setErr(r.reason);
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
              style={{ flex: 1, height: 64, borderRadius: radius.lg, paddingHorizontal: space[4], justifyContent: "center", backgroundColor: on ? tint : colors.surface2, borderWidth: 1, borderColor: on ? tint : colors.line }}
            >
              <Text variant="label" color={on ? colors.ink : colors.text3}>
                {t(s === "buy" ? "common.buy" : "common.sell")}
              </Text>
              <PriceCell symbol={symbol} side={s === "buy" ? "ask" : "bid"} digits={digits} size={17} align="left" style={{ paddingHorizontal: 0, marginStart: -2 }} />
            </PressableScale>
          );
        })}
      </View>

      {/* order type */}
      <View style={{ flexDirection: "row", gap: space[2] }}>
        {(["market", "limit", "stop"] as const).map((k) => (
          <PressableScale key={k} onPress={() => setType(k)} haptics="select" accessibilityRole="tab" accessibilityState={{ selected: type === k }} style={{ flex: 1, height: 40, borderRadius: radius.pill, alignItems: "center", justifyContent: "center", backgroundColor: type === k ? colors.cream : colors.surface2 }}>
            <Text variant="callout" weight="700" color={type === k ? colors.ink : colors.text2}>
              {t(k === "market" ? "order.type.market" : k === "limit" ? "order.type.limit" : "order.type.stop")}
            </Text>
          </PressableScale>
        ))}
      </View>

      {type !== "market" ? <Stepper label={t("order.ticket.orderPrice")} value={fmtPrice(price, digits)} onMinus={() => setPrice((p) => +(p - pip).toFixed(digits))} onPlus={() => setPrice((p) => +(p + pip).toFixed(digits))} /> : null}

      <Stepper
        label={t("order.ticket.volumeLots")}
        value={fmtLots(volume)}
        onMinus={() => setVolume((v) => clampLots(spec, v - (spec?.lotStep ?? 0.01)))}
        onPlus={() => setVolume((v) => clampLots(spec, v + (spec?.lotStep ?? 0.01)))}
        chips={[0.01, 0.1, 0.5, 1].map((v) => ({ label: fmtLots(v), onPress: () => setVolume(clampLots(spec, v)) }))}
      />

      <StopRow kind="sl" side={side} spec={spec} value={sl} digits={digits} pip={pip} volume={volume} entry={entryFor} onChange={setSl} cent={account?.cent} />
      <StopRow kind="tp" side={side} spec={spec} value={tp} digits={digits} pip={pip} volume={volume} entry={entryFor} onChange={setTp} cent={account?.cent} />

      <Preview symbol={symbol} side={side} volume={volume} spec={spec} leverage={account?.leverage ?? 100} cent={account?.cent} currency={account?.currency ?? "USD"} />

      {blocked ? <RestrictionBanner kinds={["trading", "close_only"]} /> : null}
      {readOnly ? <Banner tone="info" title={t("order.ticket.readOnlyTitle")} body={t("mobileTrade.state.readOnly")} /> : null}
      {err ? <Banner tone="error" title={err} /> : null}

      <Button label={`${confirm} ${suffix}`} variant={buy ? "buy" : "sell"} loading={busy} disabled={blocked || !spec} onPress={() => void submit()} testID="confirm-order" />
    </View>
  );
}

function defaultPending(side: "buy" | "sell", type: "limit" | "stop", at: number, pip: number): number {
  // limits wait for a better price, stops for a breakout: 20 pips from the market
  const away = pip * 20;
  const below = (side === "buy" && type === "limit") || (side === "sell" && type === "stop");
  return at ? at + (below ? -away : away) : 0;
}

function defaultStop(side: "buy" | "sell", kind: "sl" | "tp", entry: number, pip: number): number {
  const away = pip * 20;
  const lower = (side === "buy") === (kind === "sl");
  return entry + (lower ? -away : away);
}

function Stepper({ label, value, onMinus, onPlus, chips }: { label: string; value: string; onMinus: () => void; onPlus: () => void; chips?: { label: string; onPress: () => void }[] }) {
  return (
    <View style={{ gap: space[2] }}>
      <Text variant="label" tone="tertiary">
        {label}
      </Text>
      <View style={{ flexDirection: "row", alignItems: "center", gap: space[2] }}>
        <StepButton icon="minus" onPress={onMinus} label={`${label} −`} />
        <View style={{ flex: 1, height: 52, borderRadius: radius.md, backgroundColor: colors.surface2, alignItems: "center", justifyContent: "center" }}>
          <Mono size={20} weight="bold">
            {value}
          </Mono>
        </View>
        <StepButton icon="plus" onPress={onPlus} label={`${label} +`} />
      </View>
      {chips ? (
        <View style={{ flexDirection: "row", gap: space[2] }}>
          {chips.map((c) => (
            <PressableScale key={c.label} onPress={c.onPress} haptics="select" style={{ flex: 1, height: 34, borderRadius: radius.pill, backgroundColor: colors.surface2, alignItems: "center", justifyContent: "center" }}>
              <Mono size={12.5} weight="medium" tone="secondary">
                {c.label}
              </Mono>
            </PressableScale>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function StepButton({ icon, onPress, label }: { icon: "minus" | "plus"; onPress: () => void; label: string }) {
  const Icon = icon === "minus" ? Minus : Plus;
  return (
    <PressableScale onPress={onPress} haptics="select" accessibilityLabel={label} style={{ width: 52, height: 52, borderRadius: radius.md, backgroundColor: colors.surface3, alignItems: "center", justifyContent: "center" }}>
      <Icon size={20} color={colors.text} />
    </PressableScale>
  );
}

function StopRow({ kind, side, spec, value, digits, pip, volume, entry, onChange, cent }: { kind: "sl" | "tp"; side: "buy" | "sell"; spec: SymbolSpec | undefined; value: number | null; digits: number; pip: number; volume: number; entry: () => number; onChange: (v: number | null) => void; cent?: boolean }) {
  const t = useT();
  const label = t(kind === "sl" ? "order.ticket.stopLoss" : "order.ticket.takeProfit");
  if (value === null) {
    return (
      <PressableScale onPress={() => onChange(defaultStop(side, kind, entry(), pip))} haptics="select" style={{ height: 48, borderRadius: radius.md, borderWidth: 1, borderStyle: "dashed", borderColor: colors.lineStrong, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: space[2] }}>
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
    <View style={{ gap: space[2] }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Text variant="label" tone="tertiary">
          {label}
        </Text>
        <PressableScale onPress={() => onChange(null)} scaleTo={1} accessibilityLabel={`${label} ×`} style={{ minHeight: 28, minWidth: 44, alignItems: "flex-end", justifyContent: "center" }}>
          <X size={16} color={colors.text3} />
        </PressableScale>
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: space[2] }}>
        <StepButton icon="minus" onPress={() => onChange(+(value - pip).toFixed(digits))} label={`${label} −`} />
        <View style={{ flex: 1, height: 52, borderRadius: radius.md, backgroundColor: colors.surface2, alignItems: "center", justifyContent: "center" }}>
          <Mono size={18} weight="bold">
            {fmtPrice(value, digits)}
          </Mono>
          <Text variant="caption" tone={money === null ? "tertiary" : money >= 0 ? "up" : "down"}>
            {money === null ? t("mobileTrade.ticket.distance", { n: pips }) : `${t("mobileTrade.ticket.ifHit", { money: fmtMoney(money, { signed: true }) })} · ${t("mobileTrade.ticket.distance", { n: pips })}`}
          </Text>
        </View>
        <StepButton icon="plus" onPress={() => onChange(+(value + pip).toFixed(digits))} label={`${label} +`} />
      </View>
    </View>
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
