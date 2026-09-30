// Small labels of the news and calendar screens: category kicker, headline tone, importance tier, event impact bars,
// instrument and currency pills. Tone and impact never use the money green / red: tone is mint / ember with a
// direction glyph, impact is ember / gold / grey bars.
import * as React from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import { Minus, TrendingDown, TrendingUp } from "lucide-react-native";
import { useT, type T } from "@/i18n";
import { ChangeText, Mono, PressableScale, Text } from "@/ui";
import { colors, radius, space } from "@/theme/tokens";
import { tierOf, type Impact, type Sentiment } from "../api";
import { openChart, useTradable, warmChart } from "../chart";
import { emberLine, onBlock } from "../tint";

/* ---- category kicker ---- */

const CATEGORY_COLOR: Record<string, string> = {
  macro: colors.periwinkle,
  forex: colors.mint,
  metals: colors.gold,
  indices: colors.cream,
  energies: colors.ember,
  crypto: colors.periwinkle,
  stocks: colors.mint,
  markets: colors.cream,
};
export const categoryColor = (c: string) => CATEGORY_COLOR[c] ?? colors.cream;
export const categoryLabel = (t: T, c: string) => (c === "macro" ? t("news.category.macroShort") : t.dyn(`news.category.${c}`, c));

/** Newspaper-style section kicker: a colour square and the category in small caps. */
export function Kicker({ category, ink, style }: { category: string; ink?: boolean; style?: StyleProp<ViewStyle> }) {
  const t = useT();
  return (
    <View style={[{ flexDirection: "row", alignItems: "center", gap: 6, flexShrink: 0 }, style]}>
      <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: ink ? colors.ink : categoryColor(category) }} />
      <Text variant="label" color={ink ? colors.ink : colors.text2} numberOfLines={1} style={{ fontSize: 10.5, letterSpacing: 0.8 }}>
        {categoryLabel(t, category)}
      </Text>
    </View>
  );
}

/* ---- pills ---- */

function Chip({ children, border, bg = "transparent", style, accessibilityLabel }: { children: React.ReactNode; border: string; bg?: string; style?: StyleProp<ViewStyle>; accessibilityLabel?: string }) {
  return (
    <View accessibilityLabel={accessibilityLabel} style={[{ height: 24, paddingHorizontal: 9, borderRadius: radius.pill, borderWidth: 1, borderColor: border, backgroundColor: bg, flexDirection: "row", alignItems: "center", gap: 5, alignSelf: "flex-start" }, style]}>
      {children}
    </View>
  );
}

const TONE: Record<Sentiment, { Icon: typeof TrendingUp; key: "news.sentiment.bullish" | "news.sentiment.bearish" | "news.sentiment.neutral" }> = {
  bullish: { Icon: TrendingUp, key: "news.sentiment.bullish" },
  bearish: { Icon: TrendingDown, key: "news.sentiment.bearish" },
  neutral: { Icon: Minus, key: "news.sentiment.neutral" },
};
export const toneKey = (s: Sentiment) => (TONE[s] ?? TONE.neutral).key;
export const importanceKey = (tier: 2 | 3) => (tier === 3 ? "mobileNews.chip.top" : "mobileNews.chip.important");

/** Headline tone: Positive / Negative / Neutral, told by the direction glyph (no colour: green / red are for money,
 *  ember / gold for importance). `ink` for use on a colour block. */
export function ToneChip({ s, ink }: { s: Sentiment; ink?: boolean }) {
  const t = useT();
  const d = TONE[s] ?? TONE.neutral;
  const c = ink ? colors.ink : s === "neutral" ? colors.text3 : colors.text2;
  return (
    <Chip border={ink ? onBlock.line : colors.lineStrong}>
      <d.Icon size={12} color={c} strokeWidth={2.4} />
      <Text variant="caption" color={c} weight="700" style={{ fontSize: 11.5 }}>
        {t(d.key)}
      </Text>
    </Chip>
  );
}

/** Importance tier of a story (nothing for ordinary stories). */
export function ImportanceChip({ importance, ink }: { importance: number; ink?: boolean }) {
  const t = useT();
  const tier = tierOf(importance);
  if (tier === 1) return null;
  return (
    <Chip border={ink ? onBlock.line : tier === 3 ? emberLine : colors.lineStrong} bg={!ink && tier === 3 ? colors.emberSoft : "transparent"}>
      <ImpactBars impact={tier} color={ink ? colors.ink : undefined} size={9} />
      <Text variant="caption" color={ink ? colors.ink : tier === 3 ? colors.ember : colors.text2} weight="700" style={{ fontSize: 11.5 }}>
        {t(importanceKey(tier))}
      </Text>
    </Chip>
  );
}

/** A lead-time pill (5 / 15 / 30 / 60 min, four to a row in the reminder and alert sheets): narrow padding so the
 *  label stays on one line on a 360 pt phone. */
export const LEAD_PILL = { flex: 1, alignItems: "center", paddingHorizontal: space[1] } as const;

/* ---- impact ---- */

export const impactColor = (impact: number) => (impact >= 3 ? colors.ember : impact === 2 ? colors.gold : impact === 1 ? colors.text3 : colors.periwinkle);

/** Three rising bars, filled up to the impact (1–3). */
export const ImpactBars = React.memo(function ImpactBars({ impact, color, size = 12 }: { impact: number; color?: string; size?: number }) {
  const fill = color ?? impactColor(impact);
  const w = Math.max(3, Math.round(size / 3.2));
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 2, height: size }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {[1, 2, 3].map((i) => (
        <View key={i} style={{ width: w, height: Math.round(size * (0.45 + i * 0.18)), borderRadius: 1.5, backgroundColor: i <= impact ? fill : color ? onBlock.track : colors.surface3 }} />
      ))}
    </View>
  );
});

/* ---- instruments and currencies ---- */

/** A symbol as plain text (list rows: the row itself is the button). */
export function SymbolTag({ symbol, ink }: { symbol: string; ink?: boolean }) {
  return (
    <View style={{ height: 24, paddingHorizontal: 8, borderRadius: radius.pill, backgroundColor: ink ? onBlock.fill : colors.surface2, justifyContent: "center" }}>
      <Mono size={11.5} weight="medium" color={ink ? colors.ink : colors.text2} numberOfLines={1}>
        {symbol}
      </Mono>
    </View>
  );
}

/** A tappable instrument: opens its chart (candles warmed on press-in); `change` adds the live daily move. */
export const SymbolButton = React.memo(function SymbolButton({ symbol, ink, change }: { symbol: string; ink?: boolean; change?: boolean }) {
  const t = useT();
  const tradable = useTradable(symbol);
  if (!tradable) return <SymbolTag symbol={symbol} ink={ink} />;
  return (
    <PressableScale
      onPressIn={() => warmChart(symbol)}
      onPress={() => openChart(symbol)}
      haptics="select"
      accessibilityRole="link"
      accessibilityLabel={t("mobileNews.story.openChart", { symbol })}
      hitSlop={8}
      style={{ minHeight: 34, paddingHorizontal: space[3], borderRadius: radius.pill, backgroundColor: ink ? onBlock.fill : colors.surface2, borderWidth: ink ? 0 : 1, borderColor: colors.line, flexDirection: "row", alignItems: "center", gap: space[2] }}
    >
      <Mono size={12.5} weight="bold" color={ink ? colors.ink : colors.text}>
        {symbol}
      </Mono>
      {change && !ink ? <ChangeText symbol={symbol} size={11.5} /> : null}
    </PressableScale>
  );
});

/** A currency pill (Mono), optionally tappable. */
export function CurrencyPill({ currency, onPress, ink, accessibilityLabel }: { currency: string; onPress?: () => void; ink?: boolean; accessibilityLabel?: string }) {
  const body = (
    <Mono size={12.5} weight="bold" color={ink ? colors.ink : colors.text}>
      {currency}
    </Mono>
  );
  const style: StyleProp<ViewStyle> = { minHeight: 34, paddingHorizontal: space[3], borderRadius: radius.pill, backgroundColor: ink ? onBlock.fill : colors.surface2, borderWidth: ink ? 0 : 1, borderColor: colors.line, alignItems: "center", justifyContent: "center" };
  if (!onPress) return <View style={style}>{body}</View>;
  return (
    <PressableScale onPress={onPress} haptics="select" hitSlop={8} accessibilityRole="link" accessibilityLabel={accessibilityLabel ?? currency} style={style}>
      {body}
    </PressableScale>
  );
}
