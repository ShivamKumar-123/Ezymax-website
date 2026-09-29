// Live prices. Each cell is its own tiny subscriber to the quote feed, so a tick re-renders only that text node
// (never the row, list or screen), coalesced to one update per frame. The tick flash is a UI-thread animation.
import * as React from "react";
import { View, type StyleProp, type TextStyle, type ViewStyle } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming, interpolateColor } from "react-native-reanimated";
import { feed, type Quote } from "@/market/feed";
import { fmtPct, fmtPrice, splitPrice } from "@/lib/format";
import { colors, fonts, motion, radius } from "@/theme/tokens";
import { Mono } from "./Text";

/** Subscribe to one symbol's quote with a per-frame coalesced React state (for small leaf components only). */
export function useLiveQuote(symbol: string): Quote | undefined {
  const [q, setQ] = React.useState<Quote | undefined>(() => feed.quote(symbol));
  React.useEffect(() => {
    let raf = 0;
    let pending: Quote | null = null;
    setQ(feed.quote(symbol));
    const off = feed.on(symbol, (next) => {
      pending = next;
      if (!raf)
        raf = requestAnimationFrame(() => {
          raf = 0;
          if (pending) setQ(pending);
        });
    });
    const offSnap = feed.onSnapshot(() => setQ(feed.quote(symbol)));
    return () => {
      off();
      offSnap();
      if (raf) cancelAnimationFrame(raf);
    };
  }, [symbol]);
  return q;
}

type Side = "bid" | "ask";

/**
 * A bid or ask box that flashes green / red on each tick (price direction only; the colours are money colours).
 * `big` renders the MT5-style big figure (pips larger than the leading digits).
 */
export const PriceCell = React.memo(function PriceCell({ symbol, side, digits, big = true, size = 17, style, align = "right" }: { symbol: string; side: Side; digits: number; big?: boolean; size?: number; style?: StyleProp<ViewStyle>; align?: "left" | "right" | "center" }) {
  const flash = useSharedValue(0);
  const dirSv = useSharedValue(0);
  const [text, setText] = React.useState(() => {
    const q = feed.quote(symbol);
    return q ? fmtPrice(q[side], digits) : "—";
  });
  React.useEffect(() => {
    let raf = 0;
    let last = feed.quote(symbol)?.[side];
    let dir = 0;
    const flush = () => {
      raf = 0;
      const q = feed.quote(symbol);
      if (!q) return;
      setText(fmtPrice(q[side], digits));
      dirSv.value = dir;
      flash.value = withSequence(withTiming(1, { duration: 40 }), withTiming(0, { duration: motion.flashMs }));
    };
    const off = feed.on(symbol, (q) => {
      const v = q[side];
      if (v === last) return;
      dir = last === undefined ? 0 : v > last ? 1 : -1;
      last = v;
      if (!raf) raf = requestAnimationFrame(flush);
    });
    const offSnap = feed.onSnapshot(() => {
      const q = feed.quote(symbol);
      if (q) {
        last = q[side];
        setText(fmtPrice(q[side], digits));
      }
    });
    return () => {
      off();
      offSnap();
      if (raf) cancelAnimationFrame(raf);
    };
  }, [symbol, side, digits, flash, dirSv]);

  const anim = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(flash.value, [0, 1], ["rgba(0,0,0,0)", dirSv.value >= 0 ? "rgba(52,199,123,0.22)" : "rgba(240,82,82,0.22)"]),
  }));

  const [lead, pips, pipette] = big ? splitPrice(text, digits) : [text, "", ""];
  const base: TextStyle = { fontFamily: fonts.monoMedium, color: colors.text, fontVariant: ["tabular-nums"] };
  return (
    <Animated.View style={[{ borderRadius: radius.xs, paddingHorizontal: 6, paddingVertical: 3, alignItems: align === "left" ? "flex-start" : align === "center" ? "center" : "flex-end" }, style, anim]}>
      <Animated.Text style={[base, { fontSize: size * 0.8, lineHeight: size * 1.2 }]} numberOfLines={1}>
        {lead}
        {big && pips ? <Animated.Text style={[base, { fontFamily: fonts.monoBold, fontSize: size * 1.12 }]}>{pips}</Animated.Text> : null}
        {big && pipette ? <Animated.Text style={[base, { fontSize: size * 0.7 }]}>{pipette}</Animated.Text> : null}
      </Animated.Text>
    </Animated.View>
  );
});

/** Daily change % of a symbol (green / red: price direction). */
export const ChangeText = React.memo(function ChangeText({ symbol, size = 12.5 }: { symbol: string; size?: number }) {
  const q = useLiveQuote(symbol);
  const v = q && q.open > 0 ? ((q.last - q.open) / q.open) * 100 : undefined;
  return (
    <Mono size={size} weight="medium" tone={v === undefined || v === 0 ? "tertiary" : v > 0 ? "up" : "down"}>
      {fmtPct(v)}
    </Mono>
  );
});

/** Plain live price (no flash), e.g. a chart header. */
export const LivePrice = React.memo(function LivePrice({ symbol, side = "bid", digits, size = 28, weight = "bold" }: { symbol: string; side?: Side; digits: number; size?: number; weight?: "regular" | "medium" | "bold" }) {
  const q = useLiveQuote(symbol);
  return (
    <Mono size={size} weight={weight}>
      {q ? fmtPrice(q[side], digits) : "—"}
    </Mono>
  );
});

export function Spread({ symbol, digits }: { symbol: string; digits: number }) {
  const q = useLiveQuote(symbol);
  const pts = q ? Math.round((q.ask - q.bid) * 10 ** digits) : undefined;
  return (
    <View>
      <Mono size={11} tone="tertiary">
        {pts === undefined ? "—" : String(pts)}
      </Mono>
    </View>
  );
}
