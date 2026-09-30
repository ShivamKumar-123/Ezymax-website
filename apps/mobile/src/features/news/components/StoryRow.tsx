// One story in the feed: kicker, source and age, up to three lines of headline, tone / importance chips and the
// first instruments. Fixed height and memoised on the story object (kept identical between polls), so a refresh or
// a tick elsewhere never re-renders it; only its age text follows the minute clock.
import * as React from "react";
import { View } from "react-native";
import { Pin } from "lucide-react-native";
import { useT, type T } from "@/i18n";
import { PressableScale, Text } from "@/ui";
import { colors, GUTTER, space, type TextVariant } from "@/theme/tokens";
import { tierOf, type NewsItem } from "../api";
import { useMinute } from "../clock";
import { ago } from "../format";
import { ImportanceChip, importanceKey, Kicker, SymbolTag, ToneChip, toneKey } from "./chips";

/** Rows have one of three fixed heights, by the headline's estimated line count (one, two, up to three). */
export type StoryLines = 1 | 2 | 3;
export const storyRowHeight = (lines: StoryLines) => 90 + 22 * lines;
/** Characters per headline line at this width: the system font at 16.5 pt semibold averages about 7.8 pt per
 *  character (measured on the feed's real headlines at 350 pt: one line holds up to ~40 characters, two up to ~83,
 *  three from ~78). A misjudged headline ends in an ellipsis; the story screen shows it whole. */
export const charsPerLine = (width: number) => Math.max(24, Math.floor((width - GUTTER * 2) / 7.8));
export const linesOf = (title: string, perLine: number): StoryLines => (title.length > perLine * 1.85 ? 3 : title.length <= perLine * 0.9 ? 1 : 2);

/** Estimated width of a chip label: about 6.9 pt per character at 11.5 pt (Latin, Cyrillic, Arabic), a full em for
 *  CJK characters. */
const textW = (s: string) => {
  let w = 0;
  for (const ch of s) w += ch.charCodeAt(0) >= 0x2e80 ? 11.5 : 6.9;
  return w;
};
const GAP = 6;
/** How many instrument tags fit on the chips line after the tone and importance chips (the rest fold into "+N"), in
 *  `avail` pt. An estimate like the headline's line count, so the line never ends in a cut chip on a narrow phone or
 *  in a longer language. */
export function tagsThatFit(t: T, n: Pick<NewsItem, "sentiment" | "importance" | "symbols">, avail: number): number {
  const tier = tierOf(n.importance);
  // chip: padding 9 + 9, border 1 + 1, glyph 12 (tone) or bars 13 (importance), gap 5
  let used = 37 + textW(t(toneKey(n.sentiment)));
  if (tier !== 1) used += GAP + 38 + textW(t(importanceKey(tier)));
  let fit = 0;
  const max = Math.min(2, n.symbols.length);
  for (let i = 0; i < max; i++) {
    const tag = GAP + 16 + n.symbols[i]!.length * 7;
    const plus = n.symbols.length > i + 1 ? GAP + 20 : 0;
    if (used + tag + plus > avail) break;
    used += tag;
    fit++;
  }
  return fit;
}

/** "2h 10m ago", refreshed on the minute (a leaf: the row around it doesn't render). */
export function Ago({ iso, variant = "caption", color, tone = "tertiary" }: { iso: string; variant?: TextVariant; color?: string; tone?: "tertiary" | "secondary" }) {
  const t = useT();
  const now = useMinute();
  return (
    <Text variant={variant} tone={tone} color={color} numberOfLines={1} style={{ flexShrink: 0 }}>
      {ago(t, iso, now)}
    </Text>
  );
}

/** Separator between meta items (its own element, so right-to-left text never moves it). */
export function Dot() {
  return (
    <Text variant="caption" tone="tertiary" accessibilityElementsHidden importantForAccessibility="no">
      ·
    </Text>
  );
}

export const StoryRow = React.memo(function StoryRow({ n, lines, avail, onOpen, onPressIn }: { n: NewsItem; lines: StoryLines; /** width of the text column */ avail: number; onOpen: (n: NewsItem) => void; onPressIn: (n: NewsItem) => void }) {
  const t = useT();
  const shown = n.symbols.slice(0, tagsThatFit(t, n, avail));
  const more = n.symbols.length - shown.length;
  return (
    <PressableScale
      testID="story-row"
      onPress={() => onOpen(n)}
      onPressIn={() => onPressIn(n)}
      scaleTo={0.985}
      accessibilityRole="link"
      accessibilityLabel={`${n.source.name}. ${n.title}`}
      style={{ height: storyRowHeight(lines), paddingHorizontal: GUTTER, paddingTop: space[4], paddingBottom: space[4], borderBottomWidth: 1, borderBottomColor: colors.line }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: space[2] }}>
        <Kicker category={n.category} />
        <Dot />
        <Text variant="caption" tone="tertiary" numberOfLines={1} style={{ flexShrink: 1 }}>
          {n.source.name}
        </Text>
        <Dot />
        <Ago iso={n.publishedAt} />
        {n.pinned ? <View style={{ flex: 1 }} /> : null}
        {n.pinned ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }} accessibilityLabel={t("news.pinned")}>
            <Pin size={12} color={colors.gold} strokeWidth={2.2} />
            <Text variant="label" color={colors.gold} style={{ fontSize: 10 }}>
              {t("news.pinned")}
            </Text>
          </View>
        ) : null}
      </View>
      <Text variant="headline" weight="600" numberOfLines={lines} style={{ marginTop: space[2], fontSize: 16.5, lineHeight: 22 }}>
        {n.title}
      </Text>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: "auto", overflow: "hidden" }}>
        <ToneChip s={n.sentiment} />
        <ImportanceChip importance={n.importance} />
        {shown.map((s) => (
          <SymbolTag key={s} symbol={s} />
        ))}
        {more > 0 ? (
          <Text variant="caption" tone="tertiary">
            {`+${more}`}
          </Text>
        ) : null}
      </View>
    </PressableScale>
  );
});
