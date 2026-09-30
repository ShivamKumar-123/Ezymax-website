// Portfolio rows. Dense like MT5: symbol, side and volume, open → current price, live P&L. Swipe left to reveal
// the close (or cancel) button; tap to expand details and actions. P&L cells are leaf subscribers to the engine's
// equity frames, so a price move never re-renders the list.
import * as React from "react";
import { ActivityIndicator, View } from "react-native";
import Animated, { interpolate, LinearTransition, useAnimatedStyle, type SharedValue } from "react-native-reanimated";
import ReanimatedSwipeable, { type SwipeableMethods } from "react-native-gesture-handler/ReanimatedSwipeable";
import { X } from "lucide-react-native";
import { useFormat, useT } from "@/i18n";
import { fmtLots, fmtMoney, fmtPrice } from "@/lib/format";
import { haptic } from "@/lib/haptics";
import { instrument } from "@/market/instruments";
import { Mono, PressableScale, Text, useLiveQuote } from "@/ui";
import { alpha } from "@/theme/alpha";
import { colors, GUTTER, radius, space } from "@/theme/tokens";
import { usePositionLive } from "../trading/live";
import type { EngOrder, EngPosition } from "../trading/types";

export const POSITION_ROW_H = 72;

function SwipeAction({ label, drag, onPress }: { label: string; drag: SharedValue<number>; onPress: () => void }) {
  const anim = useAnimatedStyle(() => ({ opacity: interpolate(-drag.value, [0, 40, 88], [0, 0.6, 1], "clamp"), transform: [{ scale: interpolate(-drag.value, [0, 88], [0.85, 1], "clamp") }] }));
  return (
    <Animated.View style={[{ width: 96, alignItems: "center", justifyContent: "center" }, anim]}>
      <PressableScale onPress={onPress} haptics="tap" accessibilityLabel={label} style={{ width: 76, height: 56, borderRadius: radius.lg, backgroundColor: colors.down, alignItems: "center", justifyContent: "center", gap: 2 }}>
        <X size={18} color={colors.ink} strokeWidth={2.5} />
        <Text variant="label" color={colors.ink} style={{ fontSize: 10 }}>
          {label}
        </Text>
      </PressableScale>
    </Animated.View>
  );
}

/** Live P&L of one position (engine equity frames), money colours. */
export const LivePnl = React.memo(function LivePnl({ p, currency, size = 16 }: { p: EngPosition; currency: string; size?: number }) {
  const live = usePositionLive(p.ticket);
  const pnl = (live?.profit ?? p.profit ?? 0) + (live?.swap ?? p.swap ?? 0) - Math.abs(p.commission ?? 0);
  return (
    <Mono size={size} weight="bold" tone={pnl > 0 ? "up" : pnl < 0 ? "down" : "primary"}>
      {fmtMoney(pnl, { signed: true, currency })}
    </Mono>
  );
});

const LivePrice = React.memo(function LivePrice({ p, digits }: { p: EngPosition; digits: number }) {
  const t = useT();
  const live = usePositionLive(p.ticket);
  const now = live?.price ?? p.currentPrice;
  return (
    <Text variant="caption" tone="tertiary" numberOfLines={1}>
      {`${t("mobilePortfolio.row.open", { price: fmtPrice(p.openPrice, digits) })} → ${now !== undefined ? fmtPrice(now, digits) : "—"}`}
    </Text>
  );
});

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ width: "50%", paddingVertical: 6, gap: 2 }}>
      <Text variant="label" tone="tertiary" style={{ fontSize: 9.5 }}>
        {label}
      </Text>
      <Mono size={13} weight="medium">
        {value}
      </Mono>
    </View>
  );
}

function ActionPill({ label, onPress, tone = "neutral" }: { label: string; onPress: () => void; tone?: "neutral" | "danger" }) {
  return (
    <PressableScale onPress={onPress} haptics="tap" style={{ flex: 1, height: 40, borderRadius: radius.pill, alignItems: "center", justifyContent: "center", backgroundColor: tone === "danger" ? colors.downSoft : colors.surface3 }}>
      <Text variant="callout" weight="700" tone={tone === "danger" ? "down" : "primary"}>
        {label}
      </Text>
    </PressableScale>
  );
}

/** A close / cancel on its way to the server: the row shows a spinner in place of its number. */
function Busy() {
  return (
    <View style={{ minWidth: 64, alignItems: "flex-end" }}>
      <ActivityIndicator color={colors.text2} />
    </View>
  );
}

type PositionRowProps = {
  p: EngPosition;
  currency: string;
  expanded: boolean;
  readOnly: boolean;
  busy?: boolean;
  onToggle: (ticket: number) => void;
  onClose: (p: EngPosition) => void;
  onPartial: (p: EngPosition) => void;
  onModify: (p: EngPosition) => void;
};

export const PositionRow = React.memo(function PositionRow({ p, currency, expanded, readOnly, busy, onToggle, onClose, onPartial, onModify }: PositionRowProps) {
  const t = useT();
  const fmt = useFormat();
  const digits = instrument(p.symbol).digits;
  const swipe = React.useRef<SwipeableMethods>(null);
  const buy = p.side === "buy";
  const row = (
    <Animated.View layout={LinearTransition.duration(180)} style={{ backgroundColor: colors.bg, borderBottomWidth: 1, borderBottomColor: colors.line }}>
      <PressableScale onPress={() => onToggle(p.ticket)} scaleTo={0.99} accessibilityState={{ expanded }} style={{ minHeight: POSITION_ROW_H, paddingHorizontal: GUTTER, flexDirection: "row", alignItems: "center", gap: space[3] }}>
        <View style={{ width: 4, alignSelf: "stretch", marginVertical: 14, borderRadius: 2, backgroundColor: buy ? colors.up : colors.down }} />
        <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
          <View style={{ flexDirection: "row", alignItems: "baseline", gap: space[2] }}>
            <Text variant="headline" weight="700">
              {p.symbol}
            </Text>
            <Text variant="caption" weight="700" tone={buy ? "up" : "down"}>
              {`${t(buy ? "common.buy" : "common.sell").toUpperCase()} ${fmtLots(p.volume)}`}
            </Text>
          </View>
          <LivePrice p={p} digits={digits} />
        </View>
        {busy ? <Busy /> : <LivePnl p={p} currency={currency} />}
      </PressableScale>
      {expanded ? (
        <View style={{ paddingHorizontal: GUTTER, paddingBottom: space[4], gap: space[3] }}>
          <View style={{ flexDirection: "row", flexWrap: "wrap", backgroundColor: colors.surface, borderRadius: radius.md, paddingHorizontal: space[4], paddingVertical: space[2] }}>
            <Detail label={t("mobilePortfolio.detail.ticket")} value={`#${p.ticket}`} />
            <Detail label={t("mobilePortfolio.detail.opened")} value={fmt.dateTime(p.openTime)} />
            <Detail label={t("mobilePortfolio.detail.sl")} value={p.sl ? fmtPrice(p.sl, digits) : "—"} />
            <Detail label={t("mobilePortfolio.detail.tp")} value={p.tp ? fmtPrice(p.tp, digits) : "—"} />
            <Detail label={t("mobilePortfolio.detail.swap")} value={fmtMoney(p.swap, { signed: true, currency })} />
            <Detail label={t("mobilePortfolio.detail.commission")} value={fmtMoney(-Math.abs(p.commission ?? 0), { signed: true, currency })} />
          </View>
          {!readOnly && !busy ? (
            <View style={{ flexDirection: "row", gap: space[2] }}>
              <ActionPill label={t("mobilePortfolio.action.modify")} onPress={() => onModify(p)} />
              <ActionPill label={t("mobilePortfolio.action.partial")} onPress={() => onPartial(p)} />
              <ActionPill label={t("mobilePortfolio.action.close")} tone="danger" onPress={() => onClose(p)} />
            </View>
          ) : null}
        </View>
      ) : null}
    </Animated.View>
  );
  if (readOnly) return row;
  return (
    <ReanimatedSwipeable
      ref={swipe}
      enabled={!busy}
      friction={1.6}
      rightThreshold={48}
      overshootRight={false}
      onSwipeableWillOpen={() => haptic.select()}
      renderRightActions={(_progress, drag) => (
        <SwipeAction
          label={t("mobilePortfolio.swipe.close")}
          drag={drag}
          onPress={() => {
            swipe.current?.close();
            onClose(p);
          }}
        />
      )}
    >
      {row}
    </ReanimatedSwipeable>
  );
});

/** A pending order's stops and the live price it waits for (ask for buys, bid for sells): a leaf subscriber. */
const OrderLine = React.memo(function OrderLine({ o, digits }: { o: EngOrder; digits: number }) {
  const t = useT();
  const q = useLiveQuote(o.symbol);
  const now = q ? (o.side === "buy" ? q.ask : q.bid) : undefined;
  const parts = [o.sl ? `SL ${fmtPrice(o.sl, digits)}` : null, o.tp ? `TP ${fmtPrice(o.tp, digits)}` : null, now !== undefined ? t("mobilePortfolio.row.now", { price: fmtPrice(now, digits) }) : null];
  return (
    <Text variant="caption" tone="tertiary" numberOfLines={1}>
      {parts.filter(Boolean).join(" · ") || " "}
    </Text>
  );
});

type OrderRowProps = { o: EngOrder; expanded: boolean; readOnly: boolean; busy?: boolean; onToggle: (ticket: number) => void; onCancel: (o: EngOrder) => void; onEdit: (o: EngOrder) => void };

const PENDING_BUY = alpha(colors.up, 0.5);
const PENDING_SELL = alpha(colors.down, 0.5);

export const OrderRow = React.memo(function OrderRow({ o, expanded, readOnly, busy, onToggle, onCancel, onEdit }: OrderRowProps) {
  const t = useT();
  const fmt = useFormat();
  const digits = instrument(o.symbol).digits;
  const swipe = React.useRef<SwipeableMethods>(null);
  const label = t.dyn(`order.pending.${o.side}.${o.type === "stop_limit" ? "stop-limit" : o.type}`, `${o.side} ${o.type}`).toUpperCase();
  const row = (
    <Animated.View layout={LinearTransition.duration(180)} style={{ backgroundColor: colors.bg, borderBottomWidth: 1, borderBottomColor: colors.line }}>
      <PressableScale onPress={() => onToggle(o.ticket)} scaleTo={0.99} accessibilityState={{ expanded }} style={{ minHeight: POSITION_ROW_H, paddingHorizontal: GUTTER, flexDirection: "row", alignItems: "center", gap: space[3] }}>
        <View style={{ width: 4, alignSelf: "stretch", marginVertical: 14, borderRadius: 2, backgroundColor: o.side === "buy" ? PENDING_BUY : PENDING_SELL }} />
        <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
          <View style={{ flexDirection: "row", alignItems: "baseline", gap: space[2] }}>
            <Text variant="headline" weight="700">
              {o.symbol}
            </Text>
            <Text variant="caption" weight="700" tone="secondary">
              {`${label} ${fmtLots(o.volume)}`}
            </Text>
          </View>
          <OrderLine o={o} digits={digits} />
        </View>
        {busy ? (
          <Busy />
        ) : (
          <Mono size={15} weight="bold">
            {fmtPrice(o.price, digits)}
          </Mono>
        )}
      </PressableScale>
      {expanded ? (
        <View style={{ paddingHorizontal: GUTTER, paddingBottom: space[4], gap: space[3] }}>
          <View style={{ flexDirection: "row", flexWrap: "wrap", backgroundColor: colors.surface, borderRadius: radius.md, paddingHorizontal: space[4], paddingVertical: space[2] }}>
            <Detail label={t("mobilePortfolio.detail.ticket")} value={`#${o.ticket}`} />
            <Detail label={t("mobilePortfolio.detail.placed")} value={fmt.dateTime(o.placedAt)} />
            <Detail label={t("mobilePortfolio.detail.sl")} value={o.sl ? fmtPrice(o.sl, digits) : "—"} />
            <Detail label={t("mobilePortfolio.detail.tp")} value={o.tp ? fmtPrice(o.tp, digits) : "—"} />
            <Detail label={t("mobilePortfolio.detail.expiry")} value={o.expiryAt ? fmt.dateTime(o.expiryAt) : o.expiry} />
          </View>
          {!readOnly && !busy ? (
            <View style={{ flexDirection: "row", gap: space[2] }}>
              <ActionPill label={t("mobilePortfolio.action.edit")} onPress={() => onEdit(o)} />
              <ActionPill label={t("mobilePortfolio.action.cancel")} tone="danger" onPress={() => onCancel(o)} />
            </View>
          ) : null}
        </View>
      ) : null}
    </Animated.View>
  );
  if (readOnly) return row;
  return (
    <ReanimatedSwipeable
      ref={swipe}
      enabled={!busy}
      friction={1.6}
      rightThreshold={48}
      overshootRight={false}
      onSwipeableWillOpen={() => haptic.select()}
      renderRightActions={(_progress, drag) => (
        <SwipeAction
          label={t("mobilePortfolio.swipe.cancel")}
          drag={drag}
          onPress={() => {
            swipe.current?.close();
            onCancel(o);
          }}
        />
      )}
    >
      {row}
    </ReanimatedSwipeable>
  );
});
