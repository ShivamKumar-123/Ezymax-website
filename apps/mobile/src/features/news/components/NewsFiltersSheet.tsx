// News filters in a bottom sheet: importance, tone, currency and instrument (the feed API takes one of each). Each
// chip applies at once and the list behind updates; instruments in today's headlines come first.
import * as React from "react";
import { useWindowDimensions, View } from "react-native";
import { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useT, type MessageKey } from "@/i18n";
import { useQuery } from "@/lib/query";
import { instruments, SEGMENTS, type Segment } from "@/market/instruments";
import { Button, Display, Pill, Sheet, Text, type SheetRef } from "@/ui";
import { GUTTER, space } from "@/theme/tokens";
import { CURRENCIES, fetchMentions, keys, type Importance, type NewsFilters, type Sentiment } from "../api";

const IMPORTANCE: [Importance, MessageKey][] = [
  ["all", "mobileNews.importance.all"],
  ["important", "mobileNews.importance.important"],
  ["top", "mobileNews.importance.top"],
];
const TONES: [Sentiment, MessageKey][] = [
  ["bullish", "news.sentiment.bullish"],
  ["bearish", "news.sentiment.bearish"],
  ["neutral", "news.sentiment.neutral"],
];
const SEGMENT_KEY: Record<Segment, MessageKey> = {
  forex: "news.assetClass.forex",
  metals: "news.assetClass.metals",
  indices: "news.assetClass.indices",
  energies: "news.assetClass.energies",
  crypto: "news.assetClass.crypto",
  stocks: "news.assetClass.stocks",
};

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: space[2] }}>
      <Text variant="label" tone="tertiary">
        {title}
      </Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space[2] }} accessibilityRole="radiogroup">
        {children}
      </View>
    </View>
  );
}

function Symbols({ value, onPick }: { value: string | null; onPick: (s: string | null) => void }) {
  const t = useT();
  const mentions = useQuery(keys.mentions, fetchMentions, { persist: true, staleMs: 5 * 60_000 });
  const top = (mentions.data?.mentions ?? []).slice(0, 8).map((m) => m.symbol);
  const bySeg = React.useMemo(() => {
    const all = instruments();
    return SEGMENTS.map((seg) => ({ seg, list: all.filter((i) => i.segment === seg).map((i) => i.symbol) })).filter((g) => g.list.length);
  }, []);
  return (
    <View style={{ gap: space[4] }}>
      <Group title={t("mobileNews.filter.symbol")}>
        <Pill compact label={t("mobileNews.filter.anySymbol")} selected={!value} onPress={() => onPick(null)} />
        {value && !top.includes(value) && !bySeg.some((g) => g.list.includes(value)) ? <Pill compact label={value} selected onPress={() => onPick(null)} /> : null}
      </Group>
      {top.length ? (
        <Group title={t("mobileNews.filter.mentioned")}>
          {top.map((s) => (
            <Pill key={s} compact label={s} selected={value === s} onPress={() => onPick(value === s ? null : s)} />
          ))}
        </Group>
      ) : null}
      {bySeg.map((g) => (
        <Group key={g.seg} title={t(SEGMENT_KEY[g.seg])}>
          {g.list.map((s) => (
            <Pill key={s} compact label={s} selected={value === s} onPress={() => onPick(value === s ? null : s)} />
          ))}
        </Group>
      ))}
    </View>
  );
}

export const NewsFiltersSheet = React.forwardRef<SheetRef, { value: NewsFilters; onChange: (patch: Partial<NewsFilters>) => void; onClear: () => void }>(function NewsFiltersSheet({ value, onChange, onClear }, ref) {
  const t = useT();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const close = () => (ref as React.RefObject<SheetRef | null>)?.current?.dismiss();
  return (
    <Sheet ref={ref} scroll maxDynamicContentSize={Math.round(height * 0.82)}>
      <BottomSheetScrollView contentContainerStyle={{ paddingHorizontal: GUTTER, paddingTop: space[2], paddingBottom: Math.max(insets.bottom, space[4]) + space[4], gap: space[5] }} showsVerticalScrollIndicator={false}>
        <Display size="md" accessibilityRole="header">
          {t("mobileNews.filters")}
        </Display>
        <Group title={t("mobileNews.importance.label")}>
          {IMPORTANCE.map(([k, label]) => (
            <Pill key={k} compact label={t(label)} selected={value.importance === k} onPress={() => onChange({ importance: k })} />
          ))}
        </Group>
        <Group title={t("mobileNews.filter.tone")}>
          <Pill compact label={t("mobileNews.filter.anyTone")} selected={!value.tone} onPress={() => onChange({ tone: null })} />
          {TONES.map(([k, label]) => (
            <Pill key={k} compact label={t(label)} selected={value.tone === k} onPress={() => onChange({ tone: value.tone === k ? null : k })} />
          ))}
        </Group>
        <Group title={t("mobileNews.filter.currency")}>
          <Pill compact label={t("mobileNews.filter.anyCurrency")} selected={!value.currency} onPress={() => onChange({ currency: null })} />
          {CURRENCIES.map((c) => (
            <Pill key={c} compact label={c} selected={value.currency === c} onPress={() => onChange({ currency: value.currency === c ? null : c })} />
          ))}
        </Group>
        <Symbols value={value.symbol} onPick={(symbol) => onChange({ symbol })} />
        <View style={{ flexDirection: "row", gap: space[3], marginTop: space[1] }}>
          <Button label={t("mobileNews.filter.clear")} variant="ghost" size="md" style={{ flex: 1, paddingHorizontal: space[3] }} onPress={onClear} />
          <Button label={t("common.done")} size="md" style={{ flex: 1, paddingHorizontal: space[3] }} onPress={close} />
        </View>
      </BottomSheetScrollView>
    </Sheet>
  );
});
