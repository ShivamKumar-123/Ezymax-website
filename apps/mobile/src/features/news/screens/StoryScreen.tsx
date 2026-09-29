// /news/[id] — one story: kicker, tone and importance, the headline, source and time, the publisher's teaser only
// (licensing: the full article is read at the source, in the in-app browser), the tagged instruments with live prices
// (tap: chart), the currencies (tap: their calendar), and more stories on the same instrument.
// Opens at once from any list (the story is already on the phone); a cold link fetches it.
import * as React from "react";
import { Platform, ScrollView, Share, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { ExternalLink, Share2 } from "lucide-react-native";
import { useFormat, useT } from "@/i18n";
import { useQuery } from "@/lib/query";
import { instrument } from "@/market/instruments";
import { Button, Card, ChangeText, Display, IconButton, LivePrice, PressableScale, Screen, Skeleton, Text, useBottomInset } from "@/ui";
import { colors, GUTTER, radius, space } from "@/theme/tokens";
import { fetchItem, fetchRelated, keys, knownItem, primeStory, relatedOf, type NewsItem } from "../api";
import { openChart, useTradable, warmChart } from "../chart";
import { ImportanceChip, Kicker, ToneChip } from "../components/chips";
import { ForwardIcon, SectionTitle, TopBar, useBack } from "../components/chrome";
import { LoadError } from "../components/states";
import { Ago, Dot } from "../components/StoryRow";
import { hostOf } from "../format";

export function StoryScreen() {
  const t = useT();
  const { id: raw } = useLocalSearchParams<{ id: string }>();
  const id = Number(raw);
  const valid = Number.isInteger(id) && id > 0;
  const bottom = useBottomInset(false);
  const back = useBack("/news");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const fetcher = React.useMemo(() => fetchItem(id), [id]);
  const q = useQuery(valid ? keys.item(id) : null, fetcher, { staleMs: 5 * 60_000 });
  // a story the broker has since hidden (or the publisher removed) answers 404: never show a stale copy of it
  const gone = q.error?.status === 404;
  const n = gone ? undefined : (q.data?.item ?? (valid ? knownItem(id) : undefined));

  const canShare = !!n && !!hostOf(n.link);
  const share = React.useCallback(() => {
    if (!n || !hostOf(n.link)) return;
    const msg = Platform.OS === "ios" ? { message: n.title, url: n.link } : { message: `${n.title}\n${n.link}` };
    void Share.share(msg, { dialogTitle: n.source.name }).catch(() => {});
  }, [n]);

  return (
    <Screen scroll={false} tabBar={false}>
      <TopBar fallback="/news" right={canShare ? <IconButton accessibilityLabel={t("mobileNews.story.share")} icon={<Share2 size={19} color={colors.text} />} onPress={share} /> : null} />
      {!n ? (
        q.error || !valid ? (
          <LoadError
            error={valid ? q.error : { code: "not_found", message: "", status: 404 }}
            onRetry={valid ? () => void q.refresh() : undefined}
            onBack={back}
            notFound={{ title: t("mobileNews.story.notFound.title"), body: t("mobileNews.story.notFound.body"), action: t("mobileNews.story.backToNews") }}
          />
        ) : (
          <StorySkeleton />
        )
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: bottom + space[6] }} showsVerticalScrollIndicator={false}>
          <Body n={n} />
        </ScrollView>
      )}
    </Screen>
  );
}

function Body({ n }: { n: NewsItem }) {
  const t = useT();
  const f = useFormat();
  const router = useRouter();
  const host = hostOf(n.link);
  const readAtSource = React.useCallback(() => {
    if (!/^https?:\/\//i.test(n.link)) return;
    void WebBrowser.openBrowserAsync(n.link, { dismissButtonStyle: "close", controlsColor: colors.ember, toolbarColor: colors.bg, readerMode: false }).catch(() => {});
  }, [n.link]);
  const published = f.dateTime(n.publishedAt, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: undefined });
  return (
    <View>
      <View style={{ paddingHorizontal: GUTTER, gap: space[4] }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: space[2] }}>
          <Kicker category={n.category} />
          <Dot />
          <Ago iso={n.publishedAt} />
        </View>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
          <ToneChip s={n.sentiment} />
          <ImportanceChip importance={n.importance} />
          {n.pinned ? (
            <View style={{ height: 24, paddingHorizontal: 9, borderRadius: radius.pill, backgroundColor: colors.gold, justifyContent: "center" }}>
              <Text variant="label" color={colors.ink} style={{ fontSize: 10.5 }}>
                {t("news.pinned")}
              </Text>
            </View>
          ) : null}
        </View>
        <Display size={n.title.length > 70 ? "md" : "lg"} accessibilityRole="header" testID="story-title">
          {n.title}
        </Display>
        <View style={{ gap: 2 }}>
          <Text variant="headline" weight="700">
            {n.source.name}
          </Text>
          <Text variant="caption" tone="tertiary">
            {t("mobileNews.story.published", { time: published })}
          </Text>
        </View>

        {n.summary ? (
          <Text style={{ fontSize: 17, lineHeight: 26 }} tone="primary" testID="story-teaser">
            {n.summary}
          </Text>
        ) : (
          <Card tone="raised" style={{ padding: space[4] }}>
            <Text variant="callout" tone="secondary">
              {t("mobileNews.story.noTeaser")}
            </Text>
          </Card>
        )}

        {host ? (
          <View style={{ gap: space[2] }}>
            <Button testID="read-at-source" label={t("mobileNews.story.readAt", { source: n.source.name })} onPress={readAtSource} trailing={<ExternalLink size={17} color={colors.ink} strokeWidth={2.2} />} accessibilityLabel={`${t("mobileNews.story.readAt", { source: n.source.name })}, ${host}`} />
            {host ? (
              <Text variant="caption" tone="tertiary" align="center" numberOfLines={1}>
                {host}
              </Text>
            ) : null}
          </View>
        ) : null}
        <Text variant="caption" tone="tertiary">
          {t("news.story.attribution", { source: n.source.name })}
        </Text>
      </View>

      {n.symbols.length ? (
        <View style={{ marginTop: space[8] }}>
          <SectionTitle title={t("news.story.instruments")} />
          <View style={{ borderTopWidth: 1, borderTopColor: colors.line }}>
            {n.symbols.map((s) => (
              <InstrumentRow key={s} symbol={s} />
            ))}
          </View>
        </View>
      ) : null}

      {n.currencies.length ? (
        <View style={{ marginTop: space[8] }}>
          <SectionTitle title={t("mobileNews.story.currencies")} />
          <View style={{ paddingHorizontal: GUTTER, flexDirection: "row", flexWrap: "wrap", gap: space[2] }}>
            {n.currencies.map((c) => (
              <PressableScale
                key={c}
                onPress={() => router.push(`/calendar?currency=${c}`)}
                haptics="select"
                accessibilityRole="link"
                accessibilityLabel={t("mobileNews.story.calendarFor", { currency: c })}
                style={{ minHeight: 44, paddingHorizontal: space[4], borderRadius: radius.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, flexDirection: "row", alignItems: "center", gap: space[2] }}
              >
                <Text variant="callout" weight="700">
                  {t("mobileNews.story.calendarFor", { currency: c })}
                </Text>
                <ForwardIcon size={16} />
              </PressableScale>
            ))}
          </View>
        </View>
      ) : null}

      <Related n={n} />
    </View>
  );
}

/** An instrument of the story: live bid and daily change (leaf subscribers); tap opens its chart. */
const InstrumentRow = React.memo(function InstrumentRow({ symbol }: { symbol: string }) {
  const t = useT();
  const inst = instrument(symbol);
  const tradable = useTradable(symbol);
  const body = (
    <>
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Text variant="headline" weight="700">
          {symbol}
        </Text>
        <Text variant="caption" tone="tertiary" numberOfLines={1}>
          {inst.name}
        </Text>
      </View>
      {tradable ? (
        <View style={{ alignItems: "flex-end", gap: 2 }}>
          <LivePrice symbol={symbol} digits={inst.digits} size={15} weight="medium" />
          <ChangeText symbol={symbol} size={12} />
        </View>
      ) : null}
      {tradable ? <ForwardIcon /> : null}
    </>
  );
  const style = { height: 64, flexDirection: "row" as const, alignItems: "center" as const, gap: space[3], paddingHorizontal: GUTTER, borderBottomWidth: 1, borderBottomColor: colors.line };
  if (!tradable) return <View style={style}>{body}</View>;
  return (
    <PressableScale testID={`story-symbol-${symbol}`} onPressIn={() => warmChart(symbol)} onPress={() => openChart(symbol)} scaleTo={0.985} accessibilityRole="link" accessibilityLabel={t("mobileNews.story.openChart", { symbol })} style={style}>
      {body}
    </PressableScale>
  );
});

/** Up to four more stories on the story's first instrument (else its first currency). */
function Related({ n }: { n: NewsItem }) {
  const t = useT();
  const router = useRouter();
  const by = relatedOf(n);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const fetcher = React.useMemo(() => (by ? fetchRelated(by) : null), [by?.symbol, by?.currency]);
  const q = useQuery(by && fetcher ? keys.related(by) : null, fetcher ?? (async () => ({ ok: false as const, status: 0, error: { code: "aborted", message: "" } })), { staleMs: 120_000 });
  const items = (q.data?.items ?? []).filter((x) => x.id !== n.id).slice(0, 4);
  if (!by || !items.length) return null;
  return (
    <View style={{ marginTop: space[8] }}>
      <SectionTitle title={by.symbol ? t("mobileNews.story.relatedSymbol", { symbol: by.symbol }) : t("mobileNews.story.relatedCurrency", { currency: by.currency ?? "" })} />
      <View style={{ borderTopWidth: 1, borderTopColor: colors.line }}>
        {items.map((x) => (
          <PressableScale
            key={x.id}
            testID="related-story"
            onPressIn={() => primeStory(x)}
            onPress={() => router.push(`/news/${x.id}`)}
            scaleTo={0.985}
            accessibilityRole="link"
            accessibilityLabel={`${x.source.name}. ${x.title}`}
            style={{ minHeight: 84, paddingHorizontal: GUTTER, paddingVertical: space[4], gap: 6, borderBottomWidth: 1, borderBottomColor: colors.line }}
          >
            <Text variant="headline" weight="600" numberOfLines={2} style={{ fontSize: 16 }}>
              {x.title}
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: space[2] }}>
              <Text variant="caption" tone="tertiary" numberOfLines={1} style={{ flexShrink: 1 }}>
                {x.source.name}
              </Text>
              <Dot />
              <Ago iso={x.publishedAt} />
            </View>
          </PressableScale>
        ))}
      </View>
    </View>
  );
}

function StorySkeleton() {
  return (
    <View style={{ paddingHorizontal: GUTTER, gap: space[4] }} accessible accessibilityLabel="Loading">
      <Skeleton w={160} h={11} />
      <View style={{ flexDirection: "row", gap: 6 }}>
        <Skeleton w={84} h={24} r={12} />
        <Skeleton w={96} h={24} r={12} />
      </View>
      <Skeleton w="96%" h={30} r={8} />
      <Skeleton w="88%" h={30} r={8} />
      <Skeleton w="60%" h={30} r={8} />
      <Skeleton w={140} h={15} style={{ marginTop: space[2] }} />
      <Skeleton w="100%" h={16} style={{ marginTop: space[3] }} />
      <Skeleton w="94%" h={16} />
      <Skeleton w="72%" h={16} />
      <Skeleton w="100%" h={54} r={27} style={{ marginTop: space[4] }} />
    </View>
  );
}
