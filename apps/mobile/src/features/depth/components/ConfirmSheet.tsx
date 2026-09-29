// Review sheet for a ladder order when one-tap trading is off: the tapped level (limit) or the live price (market),
// lots, the margin it takes and one confirm button. The order goes through the same path as the Trade tab's ticket
// (placeOrder → /api/mobile/trade/orders → engine); the engine decides, and a rejection is shown in words.
import * as React from "react";
import { View } from "react-native";
import { X } from "lucide-react-native";
import { useT } from "@/i18n";
import { fmtLots, fmtMoney, fmtPrice } from "@/lib/format";
import { feed } from "@/market/feed";
import { instrument } from "@/market/instruments";
import { Banner, Button, Display, Mono, PressableScale, PriceCell, Sheet, Text, useLiveQuote, type SheetRef } from "@/ui";
import { colors, radius, space } from "@/theme/tokens";
import { placeOrder } from "../../trading/actions";
import { useTrade } from "../../trading/live";
import { clampLots, marginFor, useSpec } from "../../trading/specs";
import type { SymbolSpec } from "../../trading/types";
import { Stepper } from "./Stepper";

export type ReviewOrder = { side: "buy" | "sell"; type: "limit" | "market"; price?: number; volume: number };
export type ConfirmSheetHandle = { open: (o: ReviewOrder) => void };

export const ConfirmSheet = React.forwardRef<ConfirmSheetHandle, { symbol: string; onVolume: (v: number) => void }>(function ConfirmSheet({ symbol, onVolume }, ref) {
  const sheet = React.useRef<SheetRef>(null);
  const [order, setOrder] = React.useState<ReviewOrder | null>(null);
  const [key, setKey] = React.useState(0);
  React.useImperativeHandle(ref, () => ({
    open: (o) => {
      setOrder(o);
      setKey((k) => k + 1);
      requestAnimationFrame(() => sheet.current?.present());
    },
  }));
  return (
    <Sheet ref={sheet} onDismiss={() => setOrder(null)}>
      {order ? <Review key={key} symbol={symbol} order={order} onDone={() => sheet.current?.dismiss()} onVolume={onVolume} /> : null}
    </Sheet>
  );
});

/** Whether a limit price is on the wrong side of the market (the engine's rule, stops level included). */
export function limitWrongSide(side: "buy" | "sell", price: number, bid: number, ask: number, spec: SymbolSpec | undefined): boolean {
  const gap = (spec?.stopsLevelPoints ?? 0) * (spec?.point ?? 0);
  return side === "buy" ? price >= ask - gap : price <= bid + gap;
}

function Review({ symbol, order, onDone, onVolume }: { symbol: string; order: ReviewOrder; onDone: () => void; onVolume: (v: number) => void }) {
  const t = useT();
  const digits = instrument(symbol).digits;
  const spec = useSpec(symbol);
  const account = useTrade((s) => s.account);
  const [volume, setVolume] = React.useState(order.volume);
  const [price, setPrice] = React.useState(order.price ?? 0);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const buy = order.side === "buy";
  const limit = order.type === "limit";
  const step = spec?.point ?? 1 / 10 ** digits;
  const lotStep = spec?.lotStep ?? 0.01;

  async function submit() {
    setErr(null);
    setBusy(true);
    const q = feed.quote(symbol);
    const r = await placeOrder(
      limit
        ? { symbol, side: order.side, type: "limit", volume, price }
        : { symbol, side: order.side, type: "market", volume, requestedPrice: q ? (buy ? q.ask : q.bid) : undefined, deviationPoints: 50 },
    );
    setBusy(false);
    if (r.ok) {
      onVolume(volume);
      onDone();
    } else setErr(r.reason);
  }

  const title = limit ? t(buy ? "order.dom.buyLimit" : "order.dom.sellLimit") : t(buy ? "common.buy" : "common.sell");
  const label = limit
    ? t(buy ? "mobileDepth.confirm.buyLimit" : "mobileDepth.confirm.sellLimit", { volume: fmtLots(volume), symbol, price: fmtPrice(price, digits) })
    : `${t(buy ? "mobileTrade.ticket.confirmBuy" : "mobileTrade.ticket.confirmSell", { volume: fmtLots(volume), symbol })} ${t("mobileTrade.ticket.atMarket")}`;

  return (
    <View style={{ gap: space[4] }}>
      <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" }}>
        <View style={{ flexShrink: 1 }}>
          <Text variant="label" tone="tertiary">
            {`${t("mobileDepth.confirm.eyebrow")} · ${symbol}`}
          </Text>
          <Display size="md" color={buy ? colors.up : colors.down}>
            {title}
          </Display>
        </View>
        <PressableScale onPress={onDone} accessibilityLabel={t("mobile.a11y.close")} style={{ width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface2 }}>
          <X size={18} color={colors.text2} />
        </PressableScale>
      </View>

      <NowRow symbol={symbol} digits={digits} />

      {limit ? (
        <Stepper label={t("order.ticket.orderPrice")} value={fmtPrice(price, digits)} onMinus={() => setPrice((p) => +(p - step).toFixed(digits))} onPlus={() => setPrice((p) => +(p + step).toFixed(digits))} />
      ) : null}

      <Stepper
        label={t("order.ticket.volumeLots")}
        value={fmtLots(volume)}
        onMinus={() => setVolume((v) => clampLots(spec, v - lotStep))}
        onPlus={() => setVolume((v) => clampLots(spec, v + lotStep))}
        chips={[0.01, 0.1, 0.5, 1].map((v) => ({ label: fmtLots(v), onPress: () => setVolume(clampLots(spec, v)), selected: Math.abs(volume - clampLots(spec, v)) < 1e-9 }))}
      />

      <Margin symbol={symbol} side={order.side} volume={volume} spec={spec} leverage={account?.leverage ?? 100} cent={account?.cent} currency={account?.currency ?? "USD"} />

      {err ? <Banner tone="error" title={err} /> : null}

      <ConfirmButton symbol={symbol} side={order.side} limit={limit} price={price} spec={spec} label={label} busy={busy} onPress={() => void submit()} />
    </View>
  );
}

/** Live bid / ask (leaf). */
function NowRow({ symbol, digits }: { symbol: string; digits: number }) {
  const t = useT();
  return (
    <View style={{ flexDirection: "row", borderRadius: radius.lg, backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.line, paddingVertical: space[2], paddingHorizontal: space[3], alignItems: "center", gap: space[2] }}>
      <Text variant="label" tone="tertiary" style={{ flex: 1 }}>
        {t("mobileDepth.confirm.now")}
      </Text>
      <Text variant="label" tone="tertiary" style={{ fontSize: 10 }}>
        {t("market.bid")}
      </Text>
      <PriceCell symbol={symbol} side="bid" digits={digits} size={15} />
      <Text variant="label" tone="tertiary" style={{ fontSize: 10 }}>
        {t("market.ask")}
      </Text>
      <PriceCell symbol={symbol} side="ask" digits={digits} size={15} />
    </View>
  );
}

/** Margin the order takes at the live price (leaf). */
function Margin({ symbol, side, volume, spec, leverage, cent, currency }: { symbol: string; side: "buy" | "sell"; volume: number; spec: SymbolSpec | undefined; leverage: number; cent?: boolean; currency: string }) {
  const t = useT();
  const q = useLiveQuote(symbol);
  if (!spec || !q) return null;
  const m = marginFor(spec, volume, side === "buy" ? q.ask : q.bid, leverage, cent);
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
      <Text variant="label" tone="tertiary">
        {t("mobileTrade.ticket.required")}
      </Text>
      <Mono size={14} weight="medium">
        {fmtMoney(m, { currency })}
      </Mono>
    </View>
  );
}

/** Whether a limit price is (still) on the wrong side of the live market; re-renders only when that flips. */
function useWrongSide(symbol: string, side: "buy" | "sell", limit: boolean, price: number, spec: SymbolSpec | undefined): boolean {
  const calc = React.useCallback(() => {
    const q = feed.quote(symbol);
    return limit && !!q && limitWrongSide(side, price, q.bid, q.ask, spec);
  }, [symbol, side, limit, price, spec]);
  const [wrong, setWrong] = React.useState(calc);
  React.useEffect(() => {
    setWrong(calc());
    return feed.on(symbol, () => setWrong(calc()));
  }, [symbol, calc]);
  return wrong;
}

/** The confirm button follows the market: a limit price that has become marketable is flagged, not sent. */
function ConfirmButton({ symbol, side, limit, price, spec, label, busy, onPress }: { symbol: string; side: "buy" | "sell"; limit: boolean; price: number; spec: SymbolSpec | undefined; label: string; busy: boolean; onPress: () => void }) {
  const t = useT();
  const wrong = useWrongSide(symbol, side, limit, price, spec);
  return (
    <View style={{ gap: space[3] }}>
      {wrong ? <Banner tone="warn" title={t(side === "buy" ? "mobileDepth.confirm.wrongSide.buy" : "mobileDepth.confirm.wrongSide.sell")} /> : null}
      <Button label={label} variant={side === "buy" ? "buy" : "sell"} loading={busy} disabled={!spec || wrong} onPress={onPress} testID="depth-confirm" />
    </View>
  );
}
