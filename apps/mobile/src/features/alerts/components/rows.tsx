// Price alert rows. Dense and fixed-height for the list: symbol and status, the condition, the live price (on the
// alert's bid or ask) and how far the trigger still is. Live numbers are leaf subscribers, so a tick never
// re-renders a row or the list. Swipe an alert to reveal Delete (screen readers get it as an action); tap to edit.
import * as React from "react";
import { View } from "react-native";
import Animated, { interpolate, useAnimatedStyle, type SharedValue } from "react-native-reanimated";
import ReanimatedSwipeable, { type SwipeableMethods } from "react-native-gesture-handler/ReanimatedSwipeable";
import { Trash2 } from "lucide-react-native";
import { useFormat, useT } from "@/i18n";
import { fmtPrice } from "@/lib/format";
import { haptic } from "@/lib/haptics";
import { feed } from "@/market/feed";
import { instrument } from "@/market/instruments";
import { Mono, PressableScale, PriceCell, Text } from "@/ui";
import { colors, GUTTER, radius, space } from "@/theme/tokens";
import { Tag } from "../../depth/components/Chrome";
import type { AlertBasis, AlertEvent, PriceAlert } from "../api";
import { conditionText, distanceText } from "../format";

export const ALERT_ROW_H = 76;
export const EVENT_ROW_H = 68;

/** "0.42% away", re-rendered only when the text changes. */
const LiveDistance = React.memo(function LiveDistance({ symbol, basis, target }: { symbol: string; basis: AlertBasis; target: number }) {
  const t = useT();
  const read = React.useCallback(() => distanceText(feed.quote(symbol)?.[basis], target), [symbol, basis, target]);
  const [text, setText] = React.useState(read);
  React.useEffect(() => {
    setText(read());
    let raf = 0;
    const off = feed.on(symbol, () => {
      if (!raf)
        raf = requestAnimationFrame(() => {
          raf = 0;
          setText(read());
        });
    });
    return () => {
      off();
      if (raf) cancelAnimationFrame(raf);
    };
  }, [symbol, read]);
  return (
    <Text variant="caption" tone="tertiary" numberOfLines={1}>
      {text ? t("mobileDepth.alerts.row.away", { pct: text }) : " "}
    </Text>
  );
});

function DeleteAction({ drag, onPress, label }: { drag: SharedValue<number>; onPress: () => void; label: string }) {
  const anim = useAnimatedStyle(() => ({ opacity: interpolate(-drag.value, [0, 40, 88], [0, 0.6, 1], "clamp"), transform: [{ scale: interpolate(-drag.value, [0, 88], [0.85, 1], "clamp") }] }));
  return (
    <Animated.View style={[{ width: 96, alignItems: "center", justifyContent: "center" }, anim]}>
      <PressableScale onPress={onPress} accessibilityLabel={label} style={{ width: 76, height: 56, borderRadius: radius.lg, backgroundColor: colors.ember, alignItems: "center", justifyContent: "center", gap: 2 }}>
        <Trash2 size={18} color={colors.ink} strokeWidth={2.2} />
        <Text variant="label" color={colors.ink} style={{ fontSize: 10 }}>
          {label}
        </Text>
      </PressableScale>
    </Animated.View>
  );
}

type AlertRowProps = { a: PriceAlert; readOnly: boolean; onOpen: (a: PriceAlert) => void; onDelete: (a: PriceAlert) => void };

export const AlertRow = React.memo(function AlertRow({ a, readOnly, onOpen, onDelete }: AlertRowProps) {
  const t = useT();
  const fmt = useFormat();
  const swipe = React.useRef<SwipeableMethods>(null);
  const digits = instrument(a.symbol).digits;
  const live = a.status === "active" || a.status === "paused";
  const cond = conditionText(t, a, digits);
  const extras = [a.repeat ? t("mobileDepth.alerts.row.repeat") : null, a.expiresAt && live ? t("mobileDepth.alerts.row.until", { date: fmt.date(a.expiresAt, { day: "numeric", month: "short" }) }) : null, a.triggerCount > 0 && a.repeat ? t("mobileDepth.alerts.row.fired", { count: a.triggerCount }) : null].filter(Boolean).join(" · ");
  const status = a.status === "paused" ? t("mobileDepth.alerts.status.paused") : a.status === "triggered" ? t("mobileDepth.alerts.status.triggered") : a.status === "expired" ? t("mobileDepth.alerts.status.expired") : null;
  const label = [a.symbol, cond, status, extras].filter(Boolean).join(", ");
  const style = { height: ALERT_ROW_H, paddingHorizontal: GUTTER, flexDirection: "row", alignItems: "center", gap: space[3], backgroundColor: colors.bg, borderBottomWidth: 1, borderBottomColor: colors.line } as const;
  // read-only (staff session): a plain row, no press feedback that promises an editor. The same content either way
  // (a component made inside render would be a new type each time and remount the live leaves).
  const content = (
    <>
      <View style={{ width: 4, height: 36, borderRadius: 2, backgroundColor: live ? (a.status === "paused" ? colors.surface3 : colors.gold) : colors.surface2 }} />
      <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: space[2] }}>
          <Text variant="headline" weight="700" numberOfLines={1} style={{ flexShrink: 1 }}>
            {a.symbol}
          </Text>
          {status ? <Tag label={status} tone={a.status === "triggered" ? "gold" : "muted"} /> : null}
        </View>
        <Text variant="callout" tone={live ? "secondary" : "tertiary"} numberOfLines={1}>
          {cond}
        </Text>
        {extras ? (
          <Text variant="caption" tone="tertiary" numberOfLines={1}>
            {extras}
          </Text>
        ) : null}
      </View>
      <View style={{ alignItems: "flex-end", gap: 2, minWidth: 96 }}>
        {live ? (
          <>
            <PriceCell symbol={a.symbol} side={a.basis} digits={digits} size={17.5} big={false} style={{ paddingHorizontal: 0, paddingVertical: 0 }} />
            <LiveDistance symbol={a.symbol} basis={a.basis} target={a.target} />
          </>
        ) : (
          <>
            <Mono size={14} weight="medium" tone="secondary">
              {a.lastPrice !== null ? fmtPrice(a.lastPrice, digits) : "—"}
            </Mono>
            <Text variant="caption" tone="tertiary" numberOfLines={1}>
              {a.triggeredAt && a.status === "triggered" ? fmt.relative(a.triggeredAt) : a.expiresAt ? fmt.date(a.expiresAt, { day: "numeric", month: "short" }) : " "}
            </Text>
          </>
        )}
      </View>
    </>
  );
  const row = readOnly ? (
    <View accessible accessibilityLabel={label} testID={`alert-${a.id}`} style={style}>
      {content}
    </View>
  ) : (
    <PressableScale
      onPress={() => onOpen(a)}
      scaleTo={0.99}
      accessibilityLabel={label}
      accessibilityActions={[{ name: "delete", label: t("mobileDepth.alerts.swipe.delete") }]}
      onAccessibilityAction={(e) => e.nativeEvent.actionName === "delete" && onDelete(a)}
      testID={`alert-${a.id}`}
      style={style}
    >
      {content}
    </PressableScale>
  );
  if (readOnly) return row;
  return (
    <ReanimatedSwipeable
      ref={swipe}
      friction={1.6}
      rightThreshold={48}
      overshootRight={false}
      onSwipeableWillOpen={() => haptic.select()}
      renderRightActions={(_p, drag) => (
        <DeleteAction
          drag={drag}
          label={t("mobileDepth.alerts.swipe.delete")}
          onPress={() => {
            swipe.current?.close();
            onDelete(a);
          }}
        />
      )}
    >
      {row}
    </ReanimatedSwipeable>
  );
});

export const EventRow = React.memo(function EventRow({ e }: { e: AlertEvent }) {
  const t = useT();
  const fmt = useFormat();
  const digits = instrument(e.symbol).digits;
  const basis = e.basis === "ask" ? t("market.ask") : t("market.bid");
  return (
    <View
      accessible
      accessibilityLabel={[e.symbol, conditionText(t, e, digits), t("mobileDepth.alerts.history.price", { basis, price: fmtPrice(e.price, digits) }), fmt.dateTime(e.triggeredAt)].join(", ")}
      style={{ height: EVENT_ROW_H, paddingHorizontal: GUTTER, flexDirection: "row", alignItems: "center", gap: space[3], borderBottomWidth: 1, borderBottomColor: colors.line }}
    >
      <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
        <View style={{ flexDirection: "row", alignItems: "baseline", gap: space[2] }}>
          <Text variant="headline" weight="700">
            {e.symbol}
          </Text>
          <Text variant="callout" tone="secondary" numberOfLines={1} style={{ flexShrink: 1 }}>
            {conditionText(t, e, digits)}
          </Text>
        </View>
        <Text variant="caption" tone={e.delivery === "failed" ? "gold" : "tertiary"} numberOfLines={1}>
          {e.delivery === "pending" ? t("mobileDepth.alerts.history.pending") : e.delivery === "failed" ? t("mobileDepth.alerts.history.failed") : fmt.dateTime(e.triggeredAt)}
        </Text>
      </View>
      <View style={{ alignItems: "flex-end", gap: 2 }}>
        <Mono size={15} weight="bold">
          {fmtPrice(e.price, digits)}
        </Mono>
        <Text variant="caption" tone="tertiary">
          {`${basis} · ${fmt.relative(e.triggeredAt)}`}
        </Text>
      </View>
    </View>
  );
});
