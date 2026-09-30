// Small building blocks of the Algo screens, on top of @/ui and the tokens: tags, stat tiles, label / value rows,
// the symbol tile, section titles, notes, the house disclosure, stars and a progress bar. Green / red only for
// money (P&L, returns) and trade direction; every other accent comes from the brand palette. Flat fills only.
import * as React from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import { Building2, Star } from "lucide-react-native";
import { useT } from "@/i18n";
import type { Segment } from "@/market/instruments";
import { instrument } from "@/market/instruments";
import { Display, Mono, PressableScale, Text, type Tone as TextTone } from "@/ui";
import { alpha } from "@/theme/alpha";
import { colors, fonts, GUTTER, radius, space } from "@/theme/tokens";
import type { Tone } from "../format";

/** A token colour at an opacity (flat tint for tags and quiet fills): the app's helper (@/theme/alpha). */
export const tint = alpha;

const TAG: Record<Tone, { bg: string; fg: string; border: string }> = {
  neutral: { bg: colors.surface2, fg: colors.text2, border: colors.line },
  ember: { bg: colors.emberSoft, fg: colors.ember, border: tint(colors.ember, 0.3) },
  gold: { bg: colors.goldSoft, fg: colors.gold, border: tint(colors.gold, 0.3) },
  sand: { bg: tint(colors.periwinkle, 0.12), fg: colors.periwinkle, border: tint(colors.periwinkle, 0.3) },
  cream: { bg: colors.cream, fg: colors.ink, border: colors.cream },
  up: { bg: colors.upSoft, fg: colors.up, border: tint(colors.up, 0.3) },
  down: { bg: colors.downSoft, fg: colors.down, border: tint(colors.down, 0.3) },
  warn: { bg: colors.warnSoft, fg: colors.warn, border: tint(colors.warn, 0.3) },
  info: { bg: colors.infoSoft, fg: colors.info, border: tint(colors.info, 0.3) },
};

export const toneColor = (tone: Tone) => TAG[tone].fg;

/** Non-interactive pill label (status, kind, price). In a column give it `alignSelf` so it doesn't stretch. */
export const Tag = React.memo(function Tag({ label, tone = "neutral", icon, dot, style, compact, testID }: { label: string; tone?: Tone; icon?: React.ReactNode; dot?: boolean; style?: StyleProp<ViewStyle>; compact?: boolean; testID?: string }) {
  const c = TAG[tone];
  return (
    <View
      testID={testID}
      style={[
        {
          flexDirection: "row",
          alignItems: "center",
          gap: 5,
          height: compact ? 22 : 24,
          paddingHorizontal: compact ? 7 : 9,
          borderRadius: radius.pill,
          backgroundColor: c.bg,
          borderWidth: 1,
          borderColor: c.border,
          maxWidth: "100%",
        },
        style,
      ]}
    >
      {dot ? <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: c.fg }} /> : null}
      {icon}
      <Text variant="caption" color={c.fg} weight="700" numberOfLines={1} style={[{ flexShrink: 1 }, compact ? { fontSize: 11.5, lineHeight: 14 } : null]}>
        {label}
      </Text>
    </View>
  );
});

/** Small uppercase label over a value (tabular digits unless `plain`). */
export function StatTile({ label, value, tone, color, sub, plain, size = 16, style }: { label: string; value: string; tone?: TextTone; color?: string; sub?: string; plain?: boolean; size?: number; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ flex: 1, minWidth: 0, gap: 3 }, style]}>
      <Text variant="label" tone="tertiary" numberOfLines={2} style={{ fontSize: 10.5 }}>
        {label}
      </Text>
      {plain ? (
        <Text variant="callout" weight="700" tone={tone} color={color} numberOfLines={2}>
          {value}
        </Text>
      ) : (
        <Mono size={size} weight="bold" tone={tone} color={color} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
          {value}
        </Mono>
      )}
      {sub ? (
        <Text variant="caption" tone="tertiary" numberOfLines={2}>
          {sub}
        </Text>
      ) : null}
    </View>
  );
}

export type Stat = { label: string; value: string; tone?: TextTone; color?: string; sub?: string; plain?: boolean };

/** Stat tiles in rows of `columns`, with space between rows. */
export function StatGrid({ items, columns = 3, size }: { items: Stat[]; columns?: number; size?: number }) {
  const rows: Stat[][] = [];
  for (let i = 0; i < items.length; i += columns) rows.push(items.slice(i, i + columns));
  return (
    <View style={{ gap: space[4] }}>
      {rows.map((r, i) => (
        <View key={i} style={{ flexDirection: "row", gap: space[3] }}>
          {r.map((it) => (
            <StatTile key={it.label} {...it} size={size} />
          ))}
          {r.length < columns ? Array.from({ length: columns - r.length }, (_, k) => <View key={`f${k}`} style={{ flex: 1 }} />) : null}
        </View>
      ))}
    </View>
  );
}

/** A label / value row with a hairline under it (statistics, setup, costs). */
export const KV = React.memo(function KV({ label, value, tone, mono = true, last }: { label: string; value: string; tone?: TextTone; mono?: boolean; last?: boolean }) {
  return (
    <View style={{ minHeight: 44, flexDirection: "row", alignItems: "center", gap: space[3], paddingVertical: space[2], borderBottomWidth: last ? 0 : 1, borderBottomColor: colors.line }}>
      <Text variant="callout" tone="secondary" style={{ flex: 1, minWidth: 96 }}>
        {label}
      </Text>
      {mono ? (
        <Mono size={14} weight="medium" tone={tone} style={{ flexShrink: 1, maxWidth: "66%", textAlign: "right" }}>
          {value}
        </Mono>
      ) : (
        <Text variant="callout" weight="600" tone={tone} style={{ flexShrink: 1, maxWidth: "62%" }} align="right">
          {value}
        </Text>
      )}
    </View>
  );
});

const SEGMENT_FILL: Record<Segment, string> = {
  forex: colors.periwinkle,
  metals: colors.gold,
  indices: colors.cream,
  energies: colors.mint,
  crypto: colors.ember,
  stocks: colors.cream,
};

/** The instrument as a small colour tile (segment colour, ticker letters). */
export const SymbolTile = React.memo(function SymbolTile({ symbol, size = 44 }: { symbol: string; size?: number }) {
  const inst = instrument(symbol);
  const letters = symbol.replace(/[^A-Z0-9]/gi, "").slice(0, symbol.length > 4 ? 3 : 4).toUpperCase();
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width: size, height: size, borderRadius: size * 0.3, backgroundColor: SEGMENT_FILL[inst.segment] ?? colors.cream, alignItems: "center", justifyContent: "center" }}
    >
      <Text style={{ fontFamily: fonts.display, fontSize: size * 0.34, lineHeight: size * 0.42, color: colors.ink, letterSpacing: 0.3 }}>{letters}</Text>
    </View>
  );
});

/** A section title (display type) with an optional count and an end-side action. */
export function SectionTitle({ title, sub, action, onAction, style, testID }: { title: string; sub?: string; action?: string; onAction?: () => void; style?: StyleProp<ViewStyle>; testID?: string }) {
  return (
    <View style={[{ flexDirection: "row", alignItems: "flex-end", gap: space[3], paddingHorizontal: GUTTER }, style]}>
      <View style={{ flex: 1, gap: 2 }}>
        <Display size="md" accessibilityRole="header" numberOfLines={1}>
          {title}
        </Display>
        {sub ? (
          <Text variant="caption" tone="tertiary" numberOfLines={1}>
            {sub}
          </Text>
        ) : null}
      </View>
      {action && onAction ? (
        <PressableScale testID={testID} onPress={onAction} scaleTo={0.96} haptics="select" style={{ minHeight: 44, justifyContent: "center", paddingStart: space[2] }}>
          <Text variant="callout" weight="700" tone="ember">
            {action}
          </Text>
        </PressableScale>
      ) : null}
    </View>
  );
}

/** A quiet footnote with an optional icon. */
export function Note({ children, icon, style }: { children: string; icon?: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ flexDirection: "row", gap: space[2], alignItems: "flex-start" }, style]}>
      {icon ? <View style={{ marginTop: 2 }}>{icon}</View> : null}
      <Text variant="caption" tone="tertiary" style={{ flex: 1, lineHeight: 17 }}>
        {children}
      </Text>
    </View>
  );
}

/** "House strategy · Operated by Kalks": the label every house listing carries (the web's exact wording). */
export const HouseBadge = React.memo(function HouseBadge({ compact, style }: { compact?: boolean; style?: StyleProp<ViewStyle> }) {
  const t = useT();
  return (
    <Tag
      tone="sand"
      compact={compact}
      label={t("mobileAlgo.house.badge")}
      icon={<Building2 size={compact ? 11 : 12} color={colors.periwinkle} strokeWidth={2.2} />}
      style={[{ alignSelf: "flex-start" }, style]}
      testID="house-badge"
    />
  );
});

/** The full house disclosure (listing, subscribe). */
export function HouseDisclosure({ style }: { style?: StyleProp<ViewStyle> }) {
  const t = useT();
  return (
    <View
      accessibilityRole="text"
      testID="house-disclosure"
      style={[{ flexDirection: "row", gap: space[3], padding: space[4], borderRadius: radius.lg, backgroundColor: tint(colors.periwinkle, 0.08), borderWidth: 1, borderColor: tint(colors.periwinkle, 0.28) }, style]}
    >
      <Building2 size={18} color={colors.periwinkle} strokeWidth={2} style={{ marginTop: 1 }} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="callout" weight="700">
          {t("mobileAlgo.house.badge")}
        </Text>
        <Text variant="caption" tone="secondary" style={{ lineHeight: 18 }}>
          {t("mobileAlgo.house.disclosure")}
        </Text>
      </View>
    </View>
  );
}

/** 0–5 stars (rating), gold. */
export const Stars = React.memo(function Stars({ value, size = 12 }: { value: number; size?: number }) {
  const n = Math.round(value);
  return (
    <View style={{ flexDirection: "row", gap: 2 }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} size={size} color={i <= n ? colors.gold : colors.text3} fill={i <= n ? colors.gold : "transparent"} strokeWidth={2} />
      ))}
    </View>
  );
});

/** A thin progress bar: it moves only when the server reports progress. */
export function ProgressBar({ value, color = colors.ember, track = colors.surface3, height = 6 }: { value: number; color?: string; track?: string; height?: number }) {
  const p = Math.max(0.02, Math.min(1, Number.isFinite(value) ? value : 0));
  return (
    <View style={{ height, borderRadius: height / 2, backgroundColor: track, overflow: "hidden" }} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(p * 100) }}>
      <View style={{ width: `${p * 100}%`, height, borderRadius: height / 2, backgroundColor: color }} />
    </View>
  );
}

/** A labelled group card (quiet dark surface) for sections of rows. */
export function Group({ children, style, testID }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; testID?: string }) {
  return (
    <View testID={testID} style={[{ marginHorizontal: GUTTER, borderRadius: radius.card, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, paddingHorizontal: space[5], paddingVertical: space[2] }, style]}>
      {children}
    </View>
  );
}
