// The daily AI market brief (services/news, written each morning from the stored headlines and the day's calendar)
// as a periwinkle colour block: mood, headline, the first points (the rest on "Read the full brief"), the calendar
// note and the instruments to watch (tap: chart). Hidden when the broker hasn't switched the brief on.
import * as React from "react";
import { View } from "react-native";
import { ChevronDown, ChevronUp, Minus, TrendingDown, TrendingUp } from "lucide-react-native";
import { useFormat, useT } from "@/i18n";
import { useQuery } from "@/lib/query";
import { ColorBlock, PressableScale, Text } from "@/ui";
import { colors, radius, space } from "@/theme/tokens";
import { fetchBrief, keys, type Brief, type BriefMood } from "../api";
import { serverOffset } from "../../chart/data";
import { dayMonth, serverDay } from "../format";
import { SymbolButton } from "./chips";
import { BlockSkeleton } from "./states";
import { onBlock } from "../tint";

const MOOD: Record<BriefMood, "news.mood.riskOn" | "news.mood.riskOff" | "news.mood.mixed" | "news.mood.cautious"> = {
  "risk-on": "news.mood.riskOn",
  "risk-off": "news.mood.riskOff",
  mixed: "news.mood.mixed",
  cautious: "news.mood.cautious",
};
const COLLAPSED_POINTS = 1;

export const BriefCard = React.memo(function BriefCard({ focused }: { focused: boolean }) {
  const t = useT();
  const f = useFormat();
  const q = useQuery(keys.brief, fetchBrief, { persist: true, staleMs: 10 * 60_000, intervalMs: focused ? 15 * 60_000 : undefined });
  const [open, setOpen] = React.useState(false);
  const data: Brief | undefined = q.data;
  const b = data?.brief;

  if (q.loading) return <BlockSkeleton height={236} />;
  if (!b) {
    // switched off for the broker (or not reachable with nothing cached): no card rather than an empty promise
    if (!data || data.configured === false) return null;
    return (
      <ColorBlock color="periwinkle" style={{ gap: space[2] }}>
        <Text variant="label" color={colors.ink2}>
          {t("mobileNews.brief.label")}
        </Text>
        <Text variant="callout" color={colors.ink}>
          {t("news.brief.pending")}
        </Text>
      </ColorBlock>
    );
  }

  const points = open ? b.points : b.points.slice(0, COLLAPSED_POINTS);
  const canExpand = b.points.length > COLLAPSED_POINTS || !!b.calendarNote;
  // the brief's day is a server-time day (New York close)
  const today = data?.day === serverDay(Date.now(), serverOffset(Date.now() / 1000) / 3600);
  return (
    <ColorBlock color="periwinkle" style={{ gap: space[4] }} testID="brief-card">
      <View style={{ flexDirection: "row", alignItems: "center", gap: space[2] }}>
        <Text variant="label" color={colors.ink} numberOfLines={1} style={{ flexShrink: 1 }}>
          {today || !data?.day ? t("mobileNews.brief.label") : `${t("mobileNews.brief.label")} · ${dayMonth(f, data.day)}`}
        </Text>
        <View style={{ flex: 1 }} />
        <View style={{ height: 26, paddingHorizontal: 10, borderRadius: radius.pill, borderWidth: 1, borderColor: onBlock.line, justifyContent: "center" }}>
          <Text variant="label" color={colors.ink} style={{ fontSize: 10.5 }}>
            {MOOD[b.mood] ? t(MOOD[b.mood]) : b.mood}
          </Text>
        </View>
      </View>

      <Text variant="title" color={colors.ink} style={{ fontSize: 21, lineHeight: 27, fontWeight: "800" }}>
        {b.headline}
      </Text>

      <View style={{ gap: space[3] }}>
        {points.map((p, i) => {
          const Icon = p.tone === "up" ? TrendingUp : p.tone === "down" ? TrendingDown : Minus;
          return (
            <View key={i} style={{ flexDirection: "row", gap: space[3], alignItems: "flex-start" }}>
              <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: onBlock.fill, alignItems: "center", justifyContent: "center", marginTop: 1 }}>
                <Icon size={13} color={colors.ink} strokeWidth={2.4} />
              </View>
              <Text variant="callout" color={colors.ink} style={{ flex: 1, fontWeight: "500", lineHeight: 20 }}>
                {p.text}
              </Text>
            </View>
          );
        })}
      </View>

      {open && b.calendarNote ? (
        <View style={{ gap: 4, padding: space[4], borderRadius: radius.md, backgroundColor: onBlock.soft }}>
          <Text variant="label" color={colors.ink2}>
            {t("mobileNews.brief.calendarNote")}
          </Text>
          <Text variant="callout" color={colors.ink} style={{ fontWeight: "500" }}>
            {b.calendarNote}
          </Text>
        </View>
      ) : null}

      {b.watch.length ? (
        <View style={{ gap: space[2] }}>
          <Text variant="label" color={colors.ink2}>
            {t("mobileNews.brief.watch")}
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space[2] }}>
            {b.watch.map((s) => (
              <SymbolButton key={s} symbol={s} ink />
            ))}
          </View>
        </View>
      ) : null}

      {canExpand ? (
        <PressableScale
          testID="brief-toggle"
          onPress={() => setOpen((o) => !o)}
          scaleTo={0.97}
          accessibilityRole="button"
          accessibilityState={{ expanded: open }}
          style={{ minHeight: 44, alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: space[4], borderRadius: radius.pill, backgroundColor: colors.ink }}
        >
          <Text variant="callout" weight="700" color={colors.periwinkle}>
            {open ? t("common.showLess") : t("mobileNews.brief.readMore")}
          </Text>
          {open ? <ChevronUp size={16} color={colors.periwinkle} strokeWidth={2.4} /> : <ChevronDown size={16} color={colors.periwinkle} strokeWidth={2.4} />}
        </PressableScale>
      ) : null}

      <Text variant="caption" color={colors.ink2}>
        {[data?.createdAt ? t("mobileNews.brief.writtenAt", { time: f.dateTime(data.createdAt, { weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: undefined }) }) : null, t("news.brief.disclaimer")].filter(Boolean).join(" · ")}
      </Text>
    </ColorBlock>
  );
});
