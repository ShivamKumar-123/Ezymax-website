// /academy/[phase]: the phase as a colour block (level, summary, reading time, progress and the next step), a track
// filter, the chapters of each track with their completion (memoised fixed-height rows in a FlashList), the final
// exam and the certificate. Rows warm their chapter on press-in; coming back from a chapter shows the new progress.
import * as React from "react";
import { RefreshControl, View } from "react-native";
import { FlashList, type FlashListRef } from "@shopify/flash-list";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ArrowRight, ChevronLeft, ChevronRight, GraduationCap, Lock, Award } from "lucide-react-native";
import { useT } from "@/i18n";
import { Button, Card, Display, PillRow, PressableScale, Text, useBottomInset } from "@/ui";
import { blockColors, colors, GUTTER, radius, space } from "@/theme/tokens";
import { prefetchAcademy, useCatalog, type Catalog, type ChapterCard, type PhaseT, type SectionT, type Track } from "../api";
import { Directional, TopBar, useScrollY } from "../components/Bar";
import { CertificateCard } from "../components/Certificate";
import { Bar, StatusDot } from "../components/Pills";
import { AcademyState, PhaseSkeleton, RiskNote } from "../components/states";
import { fmtMin, levelLabel, nextOpenChapter, pct, phaseColor, TONE, TRACK_LABEL, TRACK_SHORT } from "../format";
import { usePull, useRefreshOnFocus, useRetryOnReconnect } from "../hooks";

export const CHAPTER_ROW_HEIGHT = 84;

type Filter = "all" | Track;
type Item =
  | { k: "hero" }
  | { k: "filter" }
  | { k: "section"; s: SectionT; done: number }
  | { k: "chapter"; c: ChapterCard; n: number; next: boolean }
  | { k: "exam" }
  | { k: "cert" }
  | { k: "nav" }
  | { k: "note" };

const ChapterRow = React.memo(function ChapterRow({ c, n, next, onOpen, onPressIn }: { c: ChapterCard; n: number; next: boolean; onOpen: (slug: string) => void; onPressIn: (slug: string) => void }) {
  const t = useT();
  const p = c.progress;
  const meta = p.completed && p.quiz_total ? t("academy.phase.quizScore", { score: `${p.quiz_best}/${p.quiz_total}` }) : p.read_pct > 0 ? t("academy.readPct", { pct: p.read_pct }) : null;
  return (
    <PressableScale
      onPress={() => onOpen(c.slug)}
      onPressIn={() => onPressIn(c.slug)}
      scaleTo={0.985}
      testID={`chapter-link-${c.slug}`}
      accessibilityLabel={`${n}. ${c.title}. ${p.completed ? t("common.completed") : ""}`}
      style={{ height: CHAPTER_ROW_HEIGHT, flexDirection: "row", alignItems: "center", gap: space[3], paddingHorizontal: GUTTER }}
    >
      <StatusDot state={p.completed ? "done" : next ? "next" : "open"} n={n} />
      <View style={{ flex: 1, gap: 3 }}>
        <Text variant="callout" weight="600" style={{ fontSize: 15.5, lineHeight: 20 }} numberOfLines={2}>
          {c.title}
        </Text>
        <Text variant="caption" tone="tertiary" style={{ fontVariant: ["tabular-nums"] }} numberOfLines={1}>
          {[t("academy.duration.min", { count: c.minutes }), meta].filter(Boolean).join(" · ")}
        </Text>
      </View>
      {p.completed ? null : (
        <Directional>
          <ChevronRight size={18} color={colors.text3} />
        </Directional>
      )}
    </PressableScale>
  );
});

function Hero({ p, cat }: { p: PhaseT; cat: Catalog }) {
  const t = useT();
  const router = useRouter();
  const next = nextOpenChapter(p);
  const nextPhase = cat.phases.find((x) => x.order === p.order + 1);
  const cta = next
    ? { label: p.progress.done ? t("common.continue") : t("academy.phase.start"), go: () => router.push(`/academy/chapter/${next.slug}`) }
    : p.exam && !p.exam.passed
      ? { label: t("academy.phase.takeExam"), go: () => router.push(`/academy/${p.slug}/exam`) }
      : nextPhase
        ? { label: t("academy.phase.next"), go: () => router.push(`/academy/${nextPhase.slug}`) }
        : null;
  // the obvious next step opens on content: warm it as soon as the phase is on screen
  const warmKey = next ? `c:${next.slug}` : p.exam && !p.exam.passed ? `e:${p.slug}` : "";
  React.useEffect(() => {
    if (warmKey.startsWith("c:")) prefetchAcademy.chapter(warmKey.slice(2));
    else if (warmKey.startsWith("e:")) prefetchAcademy.exam(warmKey.slice(2));
  }, [warmKey]);
  return (
    <View style={{ paddingHorizontal: GUTTER, paddingBottom: space[5] }}>
      <View style={{ backgroundColor: blockColors[phaseColor(p.order)], borderRadius: radius.block, padding: space[6], gap: space[4] }} testID="phase-hero">
        <View style={{ flexDirection: "row", alignItems: "center", gap: space[2] }}>
          <Text variant="label" color={colors.ink2} style={{ flex: 1 }}>
            {`${t("academy.phase.ofTotal", { n: p.order, total: cat.phases.length })} · ${levelLabel(t, p.level)}`}
          </Text>
          {p.certificate ? (
            <View style={{ height: 24, paddingHorizontal: space[3], borderRadius: radius.pill, backgroundColor: colors.ink, justifyContent: "center" }}>
              <Text variant="label" color={TONE.award} style={{ fontSize: 10, lineHeight: 13 }}>
                {t("academy.state.certified")}
              </Text>
            </View>
          ) : null}
        </View>
        <Display size="lg" color={colors.ink} accessibilityRole="header">
          {p.title}
        </Display>
        <Text variant="callout" color={colors.ink2} style={{ fontWeight: "500" }}>
          {p.summary}
        </Text>
        <View style={{ flexDirection: "row", gap: space[5] }}>
          <HeroStat value={String(p.progress.total)} label={t("academy.phase.chaptersTitle")} />
          <HeroStat value={fmtMin(t, p.minutes)} label={t("academy.reader.reading")} />
          {p.exam ? <HeroStat value={String(p.exam.questions)} label={t("academy.exam.questions")} /> : null}
        </View>
        <View style={{ gap: space[2] }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text variant="caption" color={colors.ink} weight="700" style={{ fontVariant: ["tabular-nums"] }}>
              {t("academy.phase.complete", { done: p.progress.done, total: p.progress.total })}
            </Text>
            <Text variant="caption" color={colors.ink} weight="700" style={{ fontVariant: ["tabular-nums"] }}>{`${pct(p.progress.done, p.progress.total)}%`}</Text>
          </View>
          <Bar value={pct(p.progress.done, p.progress.total)} ink />
        </View>
        {cta ? <Button label={cta.label} variant="secondary" full={false} onPress={cta.go} testID="phase-cta" style={{ marginTop: space[1] }} trailing={
              <Directional>
                <ArrowRight size={18} color={colors.text} />
              </Directional>
            }
          /> : null}
      </View>
    </View>
  );
}

function HeroStat({ value, label }: { value: string; label: string }) {
  return (
    <View style={{ gap: 2 }}>
      <Display size="sm" color={colors.ink} style={{ fontVariant: ["tabular-nums"] }}>
        {value}
      </Display>
      <Text variant="label" color={colors.ink3} style={{ fontSize: 10 }}>
        {label}
      </Text>
    </View>
  );
}

function SectionHead({ s, done }: { s: SectionT; done: number }) {
  const t = useT();
  const total = s.chapters.length;
  return (
    <View style={{ paddingHorizontal: GUTTER, paddingTop: space[6], paddingBottom: space[2], gap: space[1] }} testID={`section-${s.track}`}>
      <Text variant="label" color={s.track === "fundamental" ? colors.periwinkle : colors.ember}>
        {t(TRACK_LABEL[s.track])}
      </Text>
      <View style={{ flexDirection: "row", alignItems: "flex-end", gap: space[3] }}>
        <Display size="sm" style={{ flex: 1 }} accessibilityRole="header">
          {s.title}
        </Display>
        <Text variant="callout" tone="secondary" weight="700" style={{ fontVariant: ["tabular-nums"] }}>{`${done}/${total}`}</Text>
      </View>
      {s.summary ? (
        <Text variant="caption" tone="tertiary">
          {s.summary}
        </Text>
      ) : null}
      <Bar value={pct(done, total)} color={done === total && total > 0 ? TONE.done : colors.ember} height={4} style={{ marginTop: space[2] }} />
    </View>
  );
}

function ExamCard({ p }: { p: PhaseT }) {
  const t = useT();
  const router = useRouter();
  const e = p.exam;
  if (!e) return null;
  const left = p.progress.total - p.progress.done;
  return (
    <Card style={{ marginHorizontal: GUTTER, marginTop: space[8], gap: space[4] }} testID="exam-card">
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: space[3] }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="label" tone="ember">
            {t("academy.exam.final")}
          </Text>
          <Display size="md">{t("academy.exam.phaseExam", { n: p.order })}</Display>
        </View>
        <View style={{ width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: e.unlocked ? colors.gold : colors.surface2 }}>
          {e.unlocked ? <GraduationCap size={21} color={colors.ink} /> : <Lock size={19} color={colors.text3} />}
        </View>
      </View>
      <View style={{ flexDirection: "row", gap: space[2] }}>
        {(
          [
            [String(e.questions), t("academy.exam.questions")],
            [`${e.pass_mark}%`, t("academy.exam.passMark")],
            [e.best_pct === null ? "—" : `${e.best_pct}%`, t("academy.exam.bestScore")],
          ] as const
        ).map(([v, l]) => (
          <View key={l} style={{ flex: 1, borderRadius: radius.md, backgroundColor: colors.surface2, paddingHorizontal: space[3], paddingVertical: space[3], gap: 2 }}>
            <Display size="sm" style={{ fontVariant: ["tabular-nums"] }}>
              {v}
            </Display>
            <Text variant="caption" tone="tertiary" numberOfLines={1}>
              {l}
            </Text>
          </View>
        ))}
      </View>
      <Text variant="callout" tone="secondary">
        {e.passed ? t("academy.exam.passedText") : e.unlocked ? t("academy.exam.unlockedText") : t("academy.exam.lockedText", { count: left })}
      </Text>
      {e.unlocked ? (
        <Button
          label={e.passed ? t("academy.exam.retake") : e.attempts ? t("common.retry") : t("academy.exam.start")}
          variant={e.passed ? "secondary" : "primary"}
          full={false}
          icon={<GraduationCap size={18} color={e.passed ? colors.text : colors.ink} />}
          onPress={() => router.push(`/academy/${p.slug}/exam`)}
          testID="exam-open"
        />
      ) : (
        <Button label={t("academy.exam.locked")} variant="secondary" full={false} disabled icon={<Lock size={16} color={colors.text3} />} />
      )}
    </Card>
  );
}

function CertSlot({ p }: { p: PhaseT }) {
  const t = useT();
  if (p.certificate) return <View style={{ marginHorizontal: GUTTER, marginTop: space[4] }}><CertificateCard testID="certificate-card" code={p.certificate.code} issuedAt={p.certificate.issued_at} n={p.order} title={p.title} /></View>;
  return (
    <View style={{ marginHorizontal: GUTTER, marginTop: space[4], borderRadius: radius.card, borderWidth: 1, borderStyle: "dashed", borderColor: colors.lineStrong, padding: space[6], alignItems: "center", gap: space[3] }}>
      <Award size={28} color={colors.text3} />
      <Text variant="callout" tone="tertiary" align="center" style={{ maxWidth: 260 }}>
        {t("academy.cert.placeholder", { n: p.order })}
      </Text>
    </View>
  );
}

function PhaseNav({ p, cat }: { p: PhaseT; cat: Catalog }) {
  const t = useT();
  const router = useRouter();
  const prev = cat.phases.find((x) => x.order === p.order - 1);
  const next = cat.phases.find((x) => x.order === p.order + 1);
  return (
    <View style={{ paddingHorizontal: GUTTER, marginTop: space[6], gap: space[2] }}>
      {next ? (
        <PressableScale onPress={() => router.replace(`/academy/${next.slug}`)} scaleTo={0.985} style={{ minHeight: 56, flexDirection: "row", alignItems: "center", gap: space[3] }}>
          <View style={{ flex: 1 }}>
            <Text variant="label" tone="tertiary">
              {t("academy.phase.next")}
            </Text>
            <Text variant="callout" weight="600" numberOfLines={1}>
              {t("academy.phaseLink", { n: next.order, title: next.title })}
            </Text>
          </View>
          <Directional>
            <ChevronRight size={18} color={colors.text3} />
          </Directional>
        </PressableScale>
      ) : null}
      {prev ? (
        <PressableScale onPress={() => router.replace(`/academy/${prev.slug}`)} scaleTo={0.985} style={{ minHeight: 44, flexDirection: "row", alignItems: "center", gap: space[2] }}>
          <Directional>
            <ChevronLeft size={16} color={colors.text3} />
          </Directional>
          <Text variant="caption" tone="tertiary" numberOfLines={1} style={{ flex: 1 }}>
            {t("academy.phaseLink", { n: prev.order, title: prev.title })}
          </Text>
        </PressableScale>
      ) : null}
    </View>
  );
}

export function PhaseScreen() {
  const t = useT();
  const router = useRouter();
  const params = useLocalSearchParams<{ phase: string }>();
  const slug = typeof params.phase === "string" ? params.phase : "";
  const q = useCatalog();
  useRefreshOnFocus(q);
  useRetryOnReconnect(q);
  const { y, onScrollJs } = useScrollY();
  const bottom = useBottomInset(false);
  const pull = usePull(q.refresh);
  const [filter, setFilter] = React.useState<Filter>("all");
  const list = React.useRef<FlashListRef<Item>>(null);
  const heroH = React.useRef(0);
  const pickFilter = React.useCallback(
    (f: Filter) => {
      setFilter(f);
      // the list gets shorter: bring the track filter back under the bar instead of landing past the chapters
      if (y.value > heroH.current) requestAnimationFrame(() => list.current?.scrollToOffset({ offset: heroH.current, animated: true }));
    },
    [y],
  );
  const cat = q.data;
  const p = cat?.phases.find((x) => x.slug === slug);

  const items = React.useMemo<Item[]>(() => {
    if (!p) return [];
    const next = nextOpenChapter(p);
    const out: Item[] = [{ k: "hero" }, { k: "filter" }];
    for (const s of p.sections) {
      if (filter !== "all" && s.track !== filter) continue;
      out.push({ k: "section", s, done: s.chapters.filter((c) => c.progress.completed).length });
      s.chapters.forEach((c, i) => out.push({ k: "chapter", c, n: i + 1, next: c.slug === next?.slug }));
    }
    out.push({ k: "exam" }, { k: "cert" }, { k: "nav" }, { k: "note" });
    return out;
  }, [p, filter]);

  const open = React.useCallback((s: string) => router.push(`/academy/chapter/${s}`), [router]);
  const warm = React.useCallback((s: string) => prefetchAcademy.chapter(s), []);
  const filters = React.useMemo(
    () => [
      { key: "all" as Filter, label: t("academy.phase.bothTracks") },
      { key: "fundamental" as Filter, label: t(TRACK_SHORT.fundamental) },
      { key: "technical" as Filter, label: t(TRACK_SHORT.technical) },
    ],
    [t],
  );

  const renderItem = React.useCallback(
    ({ item }: { item: Item }) => {
      if (!p || !cat) return null;
      switch (item.k) {
        case "hero":
          return (
            <View onLayout={(e) => void (heroH.current = e.nativeEvent.layout.height)}>
              <Hero p={p} cat={cat} />
            </View>
          );
        case "filter":
          return <PillRow items={filters} value={filter} onChange={pickFilter} compact contentPadding={GUTTER} />;
        case "section":
          return <SectionHead s={item.s} done={item.done} />;
        case "chapter":
          return <ChapterRow c={item.c} n={item.n} next={item.next} onOpen={open} onPressIn={warm} />;
        case "exam":
          return <ExamCard p={p} />;
        case "cert":
          return <CertSlot p={p} />;
        case "nav":
          return <PhaseNav p={p} cat={cat} />;
        case "note":
          return <RiskNote />;
      }
    },
    [p, cat, filters, filter, pickFilter, open, warm],
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <TopBar title={p ? t("academy.phaseN", { n: p.order }) : undefined} y={y} />
      {p && cat ? (
        <FlashList
          ref={list}
          data={items}
          renderItem={renderItem}
          keyExtractor={(it) => (it.k === "chapter" ? it.c.slug : it.k === "section" ? it.s.slug : it.k)}
          getItemType={(it) => it.k}
          onScroll={onScrollJs}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: bottom + space[4] }}
          refreshControl={<RefreshControl refreshing={pull.refreshing} onRefresh={pull.onRefresh} tintColor={colors.text3} colors={[colors.ember]} progressBackgroundColor={colors.surface} />}
          testID="phase-list"
        />
      ) : cat && !p ? (
        <AcademyState notFound onRetry={() => void q.refresh()} />
      ) : q.error ? (
        <AcademyState error={q.error} onRetry={() => void q.refresh()} />
      ) : (
        <PhaseSkeleton />
      )}
    </View>
  );
}
