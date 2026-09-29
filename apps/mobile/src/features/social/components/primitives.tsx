// Small building blocks of the social screens (on top of @/ui): tags, stat tiles, key / value lists, section
// titles. Green / red appear only for money (returns, P&L); everything else uses the brand palette.
import * as React from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import { Display, Mono, Text, type Tone } from "@/ui";
import { colors, radius, space } from "@/theme/tokens";

export type TagTone = "neutral" | "ember" | "gold" | "mint" | "periwinkle" | "cream" | "up" | "down" | "warn";

const TAG: Record<TagTone, { bg: string; fg: string; border: string }> = {
  neutral: { bg: colors.surface2, fg: colors.text2, border: colors.line },
  ember: { bg: "rgba(242,106,61,0.14)", fg: colors.ember, border: "rgba(242,106,61,0.28)" },
  gold: { bg: "rgba(242,184,75,0.14)", fg: colors.gold, border: "rgba(242,184,75,0.28)" },
  mint: { bg: "rgba(127,209,185,0.14)", fg: colors.mint, border: "rgba(127,209,185,0.28)" },
  periwinkle: { bg: "rgba(140,140,240,0.16)", fg: colors.periwinkle, border: "rgba(140,140,240,0.32)" },
  cream: { bg: colors.cream, fg: colors.ink, border: colors.cream },
  up: { bg: colors.upSoft, fg: colors.up, border: "rgba(52,199,123,0.28)" },
  down: { bg: colors.downSoft, fg: colors.down, border: "rgba(240,82,82,0.28)" },
  warn: { bg: colors.warnSoft, fg: colors.gold, border: "rgba(242,184,75,0.28)" },
};

/** Non-interactive pill label (status, terms, programme). In a column, give it `alignSelf` so it doesn't stretch. */
export const Tag = React.memo(function Tag({
  label,
  tone = "neutral",
  icon,
  style,
  compact,
}: {
  label: string;
  tone?: TagTone;
  icon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  compact?: boolean;
}) {
  const c = TAG[tone];
  return (
    <View
      style={[
        {
          flexDirection: "row",
          alignItems: "center",
          gap: compact ? 4 : 5,
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
      {icon}
      <Text variant="caption" color={c.fg} weight="700" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={[{ flexShrink: 1 }, compact ? { fontSize: 11.5, lineHeight: 14 } : null]}>
        {label}
      </Text>
    </View>
  );
});

export const tagColor = (tone: TagTone) => TAG[tone].fg;

/** Small uppercase label over a value (tabular). */
export function StatTile({
  label,
  value,
  tone,
  sub,
  style,
  valueSize = 15,
  text: plain,
}: {
  label: string;
  value: React.ReactNode;
  tone?: Tone;
  sub?: string;
  style?: StyleProp<ViewStyle>;
  valueSize?: number;
  text?: boolean;
}) {
  return (
    <View style={[{ flex: 1, minWidth: 0, gap: 3 }, style]}>
      <Text variant="label" tone="tertiary" numberOfLines={1}>
        {label}
      </Text>
      {typeof value === "string" ? (
        plain ? (
          <Text variant="callout" weight="700" tone={tone} numberOfLines={2}>
            {value}
          </Text>
        ) : (
          <Mono size={valueSize} weight="medium" tone={tone} numberOfLines={1} adjustsFontSizeToFit>
            {value}
          </Mono>
        )
      ) : (
        value
      )}
      {sub ? (
        <Text variant="caption" tone="tertiary" numberOfLines={1}>
          {sub}
        </Text>
      ) : null}
    </View>
  );
}

/** A grid of stat tiles, `columns` per row, with hairlines between rows. */
export function StatGrid({ items, columns = 3 }: { items: { label: string; value: React.ReactNode; tone?: Tone; sub?: string; text?: boolean }[]; columns?: number }) {
  const rows: (typeof items)[] = [];
  for (let i = 0; i < items.length; i += columns) rows.push(items.slice(i, i + columns));
  return (
    <View style={{ gap: space[4] }}>
      {rows.map((r, i) => (
        <View key={i} style={{ flexDirection: "row", gap: space[3] }}>
          {r.map((it) => (
            <StatTile key={it.label} label={it.label} value={it.value} tone={it.tone} sub={it.sub} text={it.text} />
          ))}
          {r.length < columns ? Array.from({ length: columns - r.length }, (_, k) => <View key={`f${k}`} style={{ flex: 1 }} />) : null}
        </View>
      ))}
    </View>
  );
}

/** Huge number with a small label (editorial). */
export function BigStat({
  label,
  value,
  tone,
  color,
  size = 40,
  sub,
  align = "left",
}: {
  label: string;
  value: string;
  tone?: Tone;
  color?: string;
  size?: number;
  sub?: React.ReactNode;
  align?: "left" | "center";
}) {
  return (
    <View style={{ gap: 2, alignItems: align === "center" ? "center" : "flex-start", minWidth: 0 }}>
      <Text variant="label" color={color ? color : undefined} tone={color ? undefined : "tertiary"} style={color ? { opacity: 0.7 } : undefined} numberOfLines={1}>
        {label}
      </Text>
      <Mono size={size} weight="bold" tone={tone} color={color} numberOfLines={1} adjustsFontSizeToFit style={{ letterSpacing: -0.5 }}>
        {value}
      </Mono>
      {sub ? (
        typeof sub === "string" ? (
          <Text variant="caption" tone="tertiary">
            {sub}
          </Text>
        ) : (
          sub
        )
      ) : null}
    </View>
  );
}

/** Label / value rows (terms, review). */
export function KeyValues({ rows, ink }: { rows: [string, React.ReactNode][]; ink?: boolean }) {
  return (
    <View>
      {rows.map(([k, v], i) => (
        <View
          key={k}
          style={{
            minHeight: 44,
            flexDirection: "row",
            alignItems: "center",
            gap: space[3],
            paddingVertical: space[2],
            borderTopWidth: i ? 1 : 0,
            borderTopColor: ink ? "rgba(14,14,16,0.12)" : colors.line,
          }}
        >
          <Text variant="callout" color={ink ? colors.ink2 : colors.text2} style={{ flex: 1 }}>
            {k}
          </Text>
          <View style={{ flexShrink: 1, maxWidth: "62%", alignItems: "flex-end" }}>
            {typeof v === "string" ? (
              <Text variant="callout" weight="600" color={ink ? colors.ink : colors.text} align="right">
                {v}
              </Text>
            ) : (
              v
            )}
          </View>
        </View>
      ))}
    </View>
  );
}

/** Section title: small display heading, optional subtitle and an end-side element. */
export function SectionTitle({ title, sub, right, style }: { title: string; sub?: string; right?: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ flexDirection: "row", alignItems: "flex-end", gap: space[3], marginBottom: space[3] }, style]}>
      <View style={{ flex: 1, gap: 2 }}>
        <Display size="sm" accessibilityRole="header">
          {title}
        </Display>
        {sub ? (
          <Text variant="caption" tone="tertiary">
            {sub}
          </Text>
        ) : null}
      </View>
      {right}
    </View>
  );
}

/** Quiet note with a leading icon (disclaimers, rules). */
export function Note({ children, icon, style }: { children: React.ReactNode; icon?: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ flexDirection: "row", gap: space[2], alignItems: "flex-start" }, style]}>
      {icon ? <View style={{ marginTop: 2 }}>{icon}</View> : null}
      <Text variant="caption" tone="tertiary" style={{ flex: 1, lineHeight: 18 }}>
        {children}
      </Text>
    </View>
  );
}

/** Hairline-separated block on the dark canvas. */
export function Hairline({ style }: { style?: StyleProp<ViewStyle> }) {
  return <View style={[{ height: 1, backgroundColor: colors.line }, style]} />;
}

/** Numbered terms ("1. … 2. …") as separate paragraphs. */
export function Paragraphs({ text, tone = "secondary", size = "callout" }: { text: string; tone?: Tone; size?: "callout" | "caption" }) {
  const parts = text
    .split(/\n+|(?=\s\d+\.\s)/)
    .map((p) => p.trim())
    .filter(Boolean);
  return (
    <View style={{ gap: space[2] }}>
      {parts.map((p, i) => (
        <Text key={i} variant={size} tone={tone} style={{ lineHeight: size === "callout" ? 20 : 18 }}>
          {p}
        </Text>
      ))}
    </View>
  );
}
