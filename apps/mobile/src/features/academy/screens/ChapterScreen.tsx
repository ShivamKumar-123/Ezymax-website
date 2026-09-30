// /academy/chapter/[id]: the chapter reader. The chapter's markdown is drawn natively (no WebView), then the key
// takeaways, the demo exercise, the quiz that completes the chapter, and the way on (next / previous). Reading
// progress is measured on the UI thread (the thin ember line under the bar) and synced to the service; opening a
// chapter is instant when it is cached or was warmed on press-in, and long chapters mount their tail after the push
// transition so the transition itself stays smooth.
import * as React from "react";
import { RefreshControl, View, useWindowDimensions, type LayoutChangeEvent } from "react-native";
import Animated, { runOnJS, useAnimatedScrollHandler, useAnimatedRef, useSharedValue } from "react-native-reanimated";
import { Stack, useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import { ArrowLeft, ArrowRight, BookOpen, Check, Clock, GraduationCap, ListTree } from "lucide-react-native";
import { useFormat, useLocale, useT } from "@/i18n";
import { haptic } from "@/lib/haptics";
import { ColorBlock, Display, IconButton, PressableScale, Text, useBottomInset, type SheetRef } from "@/ui";
import { blockColors, colors, GUTTER, radius, space } from "@/theme/tokens";
import { prefetchAcademy, useChapter, type ChapterView, type QuizReply } from "../api";
import { ContentsSheet } from "../components/ContentsSheet";
import { PracticeCard } from "../components/Practice";
import { ChapterQuiz } from "../components/Quiz";
import { Tag } from "../components/Pills";
import { useRetryOnReconnect } from "../hooks";
import { AcademyState, ReaderSkeleton, RiskNote } from "../components/states";
import { TopBar } from "../components/Bar";
import { inkSoft, levelLabel, phaseColor, TONE, TRACK_LABEL } from "../format";
import { DiagramViewer } from "../markdown/DiagramViewer";
import { Markdown } from "../markdown/Markdown";
import { headingsOf, parseBlocks } from "../markdown/parse";
import { useReadingSync } from "../reading";

const indexIn = (view: ChapterView, slug: string) => view.section.chapters.findIndex((c) => c.slug === slug);

/** Blocks mounted with the first frame; the rest follow once the push transition has finished. */
const FIRST_BLOCKS = 8;

function useAfterTransition(): boolean {
  const navigation = useNavigation();
  const [ready, setReady] = React.useState(false);
  React.useEffect(() => {
    const done = () => setReady(true);
    const off = (navigation as unknown as { addListener: (e: string, f: () => void) => () => void }).addListener("transitionEnd", done);
    // web preview / no animation: no transition event
    const timer = setTimeout(done, 420);
    return () => {
      off();
      clearTimeout(timer);
    };
  }, [navigation]);
  return ready;
}

function Header({ view }: { view: ChapterView }) {
  const t = useT();
  const fmt = useFormat();
  const c = view.chapter;
  const p = view.progress;
  return (
    <View style={{ paddingHorizontal: GUTTER, paddingTop: space[3], gap: space[3] }}>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space[2] }}>
        <Tag label={t(TRACK_LABEL[view.section.track])} color={view.section.track === "fundamental" ? colors.periwinkle : colors.ember} />
        <Tag label={levelLabel(t, view.phase.level)} />
        {p.completed ? <Tag label={t("common.completed")} color={TONE.done} solid testID="chapter-completed" /> : null}
      </View>
      <Display size="lg" accessibilityRole="header" style={{ marginTop: space[1] }}>
        {c.title}
      </Display>
      {c.summary ? (
        <Text style={{ fontSize: 17, lineHeight: 25 }} tone="secondary">
          {c.summary}
        </Text>
      ) : null}
      <View style={{ flexDirection: "row", flexWrap: "wrap", columnGap: space[4], rowGap: space[1], marginTop: space[1] }}>
        <Meta icon={<BookOpen size={14} color={colors.text3} />} text={t("academy.reader.chapterOf", { n: view.section.index, total: view.section.count })} />
        <Meta icon={<Clock size={14} color={colors.text3} />} text={t("academy.reader.minRead", { count: c.minutes })} />
        {c.quiz.length ? <Meta icon={<GraduationCap size={14} color={colors.text3} />} text={t("academy.reader.quizLength", { count: c.quiz.length })} /> : null}
      </View>
      <Text variant="caption" tone="tertiary" testID="chapter-dates">
        {[c.updated_at ? t("mobileAcademy.reader.updated", { date: fmt.date(c.updated_at) }) : null, p.completed && p.completed_at ? t("mobileAcademy.reader.completedOn", { date: fmt.date(p.completed_at) }) : null].filter(Boolean).join(" · ")}
      </Text>
      <View style={{ height: 1, backgroundColor: colors.line, marginTop: space[2] }} />
    </View>
  );
}

function Meta({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
      {icon}
      <Text variant="caption" tone="tertiary" style={{ fontVariant: ["tabular-nums"] }}>
        {text}
      </Text>
    </View>
  );
}

function Takeaways({ items }: { items: string[] }) {
  const t = useT();
  return (
    <ColorBlock color="cream" testID="takeaways" style={{ gap: space[4], padding: space[5] }}>
      <Display size="sm" color={colors.ink}>
        {t("academy.reader.takeaways")}
      </Display>
      {items.map((tk, i) => (
        <View key={i} style={{ flexDirection: "row", gap: space[3] }}>
          <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: colors.ink, alignItems: "center", justifyContent: "center", marginTop: 1 }}>
            <Check size={13} color={colors.cream} strokeWidth={3} />
          </View>
          <Text style={{ flex: 1, fontSize: 15.5, lineHeight: 23 }} color={colors.ink}>
            {tk}
          </Text>
        </View>
      ))}
    </ColorBlock>
  );
}

function WayOn({ view, onGo, onPressIn }: { view: ChapterView; onGo: (slug: string, dir: "next" | "prev") => void; onPressIn: (slug: string) => void }) {
  const t = useT();
  const router = useRouter();
  const { rtl } = useLocale();
  const flip = rtl ? { transform: [{ scaleX: -1 }] } : undefined;
  return (
    <View style={{ gap: space[3] }}>
      {!view.progress.completed && view.chapter.quiz.length ? (
        <Text variant="caption" tone="tertiary" align="center">
          {t("mobileAcademy.reader.completeHint")}
        </Text>
      ) : null}
      {view.next ? (
        <PressableScale
          onPress={() => onGo(view.next!.slug, "next")}
          onPressIn={() => onPressIn(view.next!.slug)}
          testID="next-chapter"
          accessibilityLabel={`${t("common.next")}: ${view.next.title}`}
          style={{ backgroundColor: blockColors[phaseColor(view.phase.order)], borderRadius: radius.block, padding: space[5], gap: space[2] }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Text variant="label" color={inkSoft}>
              {t("mobileAcademy.reader.upNext")}
            </Text>
            <View style={flip}>
              <ArrowRight size={22} color={colors.ink} strokeWidth={2.2} />
            </View>
          </View>
          <Display size="sm" color={colors.ink} numberOfLines={3}>
            {view.next.title}
          </Display>
        </PressableScale>
      ) : (
        <ColorBlock color="cream" onPress={() => router.push("/academy/progress")} style={{ padding: space[5], gap: space[2] }} testID="end-of-course">
          <Display size="sm" color={colors.ink}>
            {t("academy.reader.end")}
          </Display>
        </ColorBlock>
      )}
      {view.prev ? (
        <PressableScale onPress={() => onGo(view.prev!.slug, "prev")} onPressIn={() => onPressIn(view.prev!.slug)} scaleTo={0.985} testID="prev-chapter" accessibilityLabel={`${t("academy.reader.previous")}: ${view.prev.title}`} style={{ minHeight: 64, borderRadius: radius.card, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, flexDirection: "row", alignItems: "center", gap: space[3], paddingHorizontal: space[4] }}>
          <View style={flip}>
            <ArrowLeft size={18} color={colors.text3} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="label" tone="tertiary">
              {t("academy.reader.previous")}
            </Text>
            <Text variant="callout" weight="600" numberOfLines={1}>
              {view.prev.title}
            </Text>
          </View>
        </PressableScale>
      ) : null}
    </View>
  );
}

function Reader({ view, refresh, resume }: { view: ChapterView; refresh: () => Promise<void>; resume?: boolean }) {
  const t = useT();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const bottom = useBottomInset(false);
  const c = view.chapter;
  const contentW = Math.min(width, 720) - GUTTER * 2;
  const blocks = React.useMemo(() => parseBlocks(c.body), [c.body]);
  const headings = React.useMemo(() => headingsOf(blocks), [blocks]);
  const settled = useAfterTransition();
  const [diagram, setDiagram] = React.useState<{ svg: string; caption: string | null } | null>(null);
  const openDiagram = React.useCallback((svg: string, caption: string | null) => setDiagram({ svg, caption }), []);
  const contents = React.useRef<SheetRef>(null);
  const scroll = useAnimatedRef<Animated.ScrollView>();

  // positions (JS side, for jumps) and measurements (UI thread, for the reading progress)
  const pos = React.useRef({ article: 0, articleH: 0, markdown: 0, tail: 0, quiz: 0, headings: new Map<string, number>() });
  const y = useSharedValue(0);
  const artTop = useSharedValue(0);
  const artH = useSharedValue(0);
  const viewH = useSharedValue(0);
  const cur = useSharedValue(0);
  const seen = useSharedValue(view.progress.read_pct);
  const lastReport = useSharedValue(view.progress.read_pct);

  const sync = useReadingSync(c.slug, c.lang, view.progress.read_pct);
  const warmedNext = React.useRef(false);
  const onSeen = React.useCallback(
    (p: number) => {
      sync.report(p);
      if (p >= 50 && view.next && !warmedNext.current) {
        warmedNext.current = true;
        prefetchAcademy.chapter(view.next.slug);
      }
    },
    [sync, view.next],
  );

  const onScroll = useAnimatedScrollHandler((e) => {
    y.value = e.contentOffset.y;
    if (artH.value <= 0) return;
    const p = Math.max(0, Math.min(100, Math.round(((e.contentOffset.y + e.layoutMeasurement.height - artTop.value) / artH.value) * 100)));
    cur.value = p;
    if (p > seen.value) {
      seen.value = p;
      if (p - lastReport.value >= 3 || p === 100) {
        lastReport.value = p;
        runOnJS(onSeen)(p);
      }
    }
  });

  // what is visible before any scrolling counts as read too (like the web)
  const measureVisible = React.useCallback(() => {
    if (artH.value <= 0 || viewH.value <= 0) return;
    const p = Math.max(0, Math.min(100, Math.round(((y.value + viewH.value - artTop.value) / artH.value) * 100)));
    cur.value = p;
    if (p > seen.value) {
      seen.value = p;
      lastReport.value = p;
      onSeen(p);
    }
  }, [artH, viewH, y, artTop, cur, seen, lastReport, onSeen]);

  const onArticleLayout = (e: LayoutChangeEvent) => {
    pos.current.article = e.nativeEvent.layout.y;
    pos.current.articleH = e.nativeEvent.layout.height;
    // measured only once every block is mounted, so a half-built article never counts as read
    if (!settled) return;
    artTop.value = e.nativeEvent.layout.y;
    artH.value = e.nativeEvent.layout.height;
    measureVisible();
    restore();
  };
  // "Resume chapter": once the whole article is laid out, open where the learner stopped reading (the furthest point
  // seen sits a little below the middle of the screen)
  const restored = React.useRef(!resume);
  const restore = React.useCallback(() => {
    if (restored.current || artH.value <= 0 || viewH.value <= 0) return;
    restored.current = true;
    const p = view.progress.read_pct;
    if (view.progress.completed || p < 10 || p > 95) return;
    const target = artTop.value + (p / 100) * artH.value - viewH.value * 0.6;
    if (target > 0) scroll.current?.scrollTo({ y: target, animated: false });
  }, [artH, viewH, artTop, view.progress.read_pct, view.progress.completed, scroll]);

  // a short chapter may not change size when its tail mounts (no new layout event): use the last layout
  React.useEffect(() => {
    if (!settled) return;
    const id = setTimeout(() => {
      if (artH.value > 0 || pos.current.articleH <= 0) return;
      artTop.value = pos.current.article;
      artH.value = pos.current.articleH;
      measureVisible();
      restore();
    }, 250);
    return () => clearTimeout(id);
  }, [settled, artH, artTop, measureVisible, restore]);

  const jumpTo = (target: number) => {
    haptic.select();
    scroll.current?.scrollTo({ y: Math.max(0, target - space[3]), animated: true });
  };
  const onHeading = (id: string) => {
    const hy = pos.current.headings.get(id);
    if (hy !== undefined) jumpTo(pos.current.article + pos.current.markdown + hy);
  };
  const toQuiz = () => jumpTo(pos.current.tail + pos.current.quiz);
  const onHeadingLayout = React.useCallback((id: string, hy: number) => void pos.current.headings.set(id, hy), []);

  const go = React.useCallback((slug: string, d: "next" | "prev") => router.replace(`/academy/chapter/${slug}?dir=${d}`), [router]);
  const warm = React.useCallback((slug: string) => prefetchAcademy.chapter(slug), []);
  const onQuizDone = React.useCallback((r: QuizReply) => {
    // the quiz is the end of the chapter: count it as read through
    if (r.all_answered) onSeen(100);
  }, [onSeen]);

  const [refreshing, setRefreshing] = React.useState(false);
  const pull = async () => {
    haptic.select();
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  return (
    <>
      <TopBar
        title={c.title}
        y={y}
        progress={cur}
        right={
          <>
            <IconButton tone="ghost" accessibilityLabel={t("mobileAcademy.a11y.contents")} icon={<ListTree size={20} color={colors.text} />} onPress={() => contents.current?.present()} />
            {c.quiz.length ? <IconButton tone="ghost" accessibilityLabel={t("academy.reader.goToQuiz")} icon={<GraduationCap size={21} color={colors.text} />} onPress={toQuiz} /> : null}
          </>
        }
      />
      <Animated.ScrollView
        ref={scroll}
        onScroll={onScroll}
        scrollEventThrottle={16}
        onLayout={(e) => {
          viewH.value = e.nativeEvent.layout.height;
          measureVisible();
        }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: bottom + space[6] }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={pull} tintColor={colors.text3} colors={[colors.ember]} progressBackgroundColor={colors.surface} />}
        testID="chapter-scroll"
      >
        <View onLayout={onArticleLayout} testID="chapter-article">
          <Header view={view} />
          <View style={{ paddingHorizontal: GUTTER, paddingTop: space[5] }} onLayout={(e) => void (pos.current.markdown = e.nativeEvent.layout.y)}>
            <Markdown blocks={blocks} width={contentW} limit={settled ? undefined : FIRST_BLOCKS} onOpenDiagram={openDiagram} onHeadingLayout={onHeadingLayout} />
          </View>
          {settled && c.takeaways.length ? (
            <View style={{ paddingHorizontal: GUTTER, marginTop: space[8] }}>
              <Takeaways items={c.takeaways} />
            </View>
          ) : null}
        </View>
        {settled ? (
          <View style={{ paddingHorizontal: GUTTER, gap: space[4], marginTop: space[4] }} onLayout={(e) => void (pos.current.tail = e.nativeEvent.layout.y)}>
            {c.practice ? <PracticeCard practice={c.practice} /> : null}
            {c.quiz.length ? (
              <View onLayout={(e) => void (pos.current.quiz = e.nativeEvent.layout.y)}>
                <ChapterQuiz key={c.slug} slug={c.slug} lang={c.lang} questions={c.quiz} passedBefore={view.progress.completed} onDone={onQuizDone} />
              </View>
            ) : null}
            <View style={{ marginTop: space[4] }}>
              <WayOn view={view} onGo={go} onPressIn={warm} />
            </View>
          </View>
        ) : null}
        {settled ? <RiskNote /> : null}
      </Animated.ScrollView>
      <ContentsSheet ref={contents} view={view} headings={headings} onHeading={onHeading} onQuiz={toQuiz} onChapter={(slug) => go(slug, indexIn(view, slug) < view.section.index - 1 ? "prev" : "next")} onChapterPressIn={warm} />
      <DiagramViewer svg={diagram?.svg ?? null} caption={diagram?.caption} onClose={() => setDiagram(null)} />
    </>
  );
}

export function ChapterScreen() {
  const params = useLocalSearchParams<{ id: string; dir?: string; resume?: string }>();
  const slug = typeof params.id === "string" ? params.id : null;
  const q = useChapter(slug);
  useRetryOnReconnect(q);
  const view = q.data && q.data.chapter.slug === slug ? q.data : undefined;
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* "previous" slides in from the start edge, "next" from the end */}
      <Stack.Screen options={{ animationTypeForReplace: params.dir === "prev" ? "pop" : "push" }} />
      {view ? (
        <Reader view={view} refresh={q.refresh} resume={params.resume === "1"} />
      ) : (
        <>
          <TopBar />
          {q.error ? <AcademyState error={q.error} onRetry={() => void q.refresh()} /> : <ReaderSkeleton />}
        </>
      )}
    </View>
  );
}
