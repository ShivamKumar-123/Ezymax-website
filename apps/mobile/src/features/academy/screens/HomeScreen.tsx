// /academy: continue where you left off (a cream block), the learner's numbers (streak, chapters, quiz average,
// certificates) as huge figures with small labels, the eight phases as big colour blocks, the glossary, practice on
// demo and progress. Opens on the cached catalog, refreshes in the background and when it comes back into focus.
import * as React from "react";
import { RefreshControl, ScrollView, View } from "react-native";
import Animated from "react-native-reanimated";
import { useRouter } from "expo-router";
import { Award, ChevronRight, Flame, GraduationCap, Library, Search } from "lucide-react-native";
import { useFormat, useT } from "@/i18n";
import { useSession } from "@/session";
import { Button, Card, ColorBlock, Display, IconButton, PressableScale, Text, useBottomInset } from "@/ui";
import { colors, GUTTER, radius, space } from "@/theme/tokens";
import { prefetchAcademy, useCatalog, type Catalog } from "../api";
import { Directional, LargeTitle, SectionTitle, TopBar, useScrollY } from "../components/Bar";
import { PhaseBlock } from "../components/PhaseBlock";
import { Segments, Tag } from "../components/Pills";
import { usePractise, useDemoAccount } from "../components/Practice";
import { AcademyState, HomeSkeleton, RiskNote } from "../components/states";
import { fmtMin, pct, utcWeek } from "../format";
import { usePull, useRefreshOnFocus, useRetryOnReconnect } from "../hooks";

/** The web's glossary shortcuts. */
const POPULAR = ["Pip", "Spread", "Leverage", "Margin level", "Stop-out", "Swap", "Support", "RSI", "CPI", "Yield curve", "Drawdown", "Expectancy"];

function ContinueHero({ cat }: { cat: Catalog }) {
  const t = useT();
  const router = useRouter();
  const c = cat.me.continue;
  const phase = c ? (cat.phases.find((p) => p.slug === c.phase.slug) ?? cat.phases[0]) : cat.phases[0];
  // the chapter the learner is most likely to open next is warm before they tap
  const next = c?.slug;
  React.useEffect(() => {
    if (next) prefetchAcademy.chapter(next);
  }, [next]);
  if (!phase) return null;
  if (!c) {
    return (
      <ColorBlock color="cream" style={{ gap: space[3] }} testID="continue-hero">
        <Text variant="label" color={colors.ink2}>
          {t("academy.hero.allDone")}
        </Text>
        <Display size="lg" color={colors.ink}>
          {t("academy.hero.allDoneTitle")}
        </Display>
        <Text variant="callout" color={colors.ink2}>
          {t("academy.hero.allDoneText")}
        </Text>
        <Button label={t("academy.hero.myCertificates")} full={false} icon={<Award size={18} color={colors.ink} />} onPress={() => router.push("/academy/progress")} style={{ marginTop: space[2] }} />
      </ColorBlock>
    );
  }
  const label = c.started ? t("academy.hero.continue") : cat.me.chapters_done ? t("academy.hero.upNext") : t("academy.hero.startHere");
  const open = () => router.push(`/academy/chapter/${c.slug}${c.started ? "?resume=1" : ""}`);
  return (
    <ColorBlock color="cream" style={{ gap: space[4] }} testID="continue-hero">
      <View style={{ flexDirection: "row", alignItems: "center", gap: space[2] }}>
        <Text variant="label" color={colors.ink2} style={{ flex: 1 }}>
          {label}
        </Text>
        <View style={{ height: 24, paddingHorizontal: space[3], borderRadius: radius.pill, backgroundColor: colors.ink, justifyContent: "center" }}>
          <Text variant="label" color={colors.cream} style={{ fontSize: 10, lineHeight: 13 }}>
            {t("academy.phaseN", { n: phase.order })}
          </Text>
        </View>
      </View>
      <PressableScale onPress={open} onPressIn={() => prefetchAcademy.chapter(c.slug)} scaleTo={0.985} accessibilityLabel={c.title} style={{ gap: space[2] }}>
        <Display size="lg" color={colors.ink} numberOfLines={4}>
          {c.title}
        </Display>
        <Text variant="callout" color={colors.ink2} style={{ fontVariant: ["tabular-nums"] }}>
          {[phase.title, t("academy.hero.minRead", { time: fmtMin(t, c.minutes) }), c.read_pct > 0 ? t("academy.readPct", { pct: c.read_pct }) : null].filter(Boolean).join(" · ")}
        </Text>
      </PressableScale>
      <View style={{ gap: space[2] }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <Text variant="caption" color={colors.ink2} style={{ fontVariant: ["tabular-nums"] }}>
            {t("academy.hero.phaseProgress", { n: phase.order, done: phase.progress.done, total: phase.progress.total })}
          </Text>
          <Text variant="caption" color={colors.ink} weight="700" style={{ fontVariant: ["tabular-nums"] }}>
            {`${pct(phase.progress.done, phase.progress.total)}%`}
          </Text>
        </View>
        <Segments done={phase.progress.done} total={phase.progress.total} ink />
      </View>
      {/* on a 360 pt phone "Phase overview" takes the next line instead of running off the block */}
      <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: space[3], marginTop: space[1] }}>
        <Button label={c.started ? t("academy.hero.resume") : t("academy.hero.start")} full={false} onPress={open} testID="continue-open" />
        <PressableScale onPress={() => router.push(`/academy/${phase.slug}`)} scaleTo={1} style={{ minHeight: 44, justifyContent: "center", paddingHorizontal: space[2] }}>
          <Text variant="callout" weight="700" color={colors.ink}>
            {t("academy.hero.overview")}
          </Text>
        </PressableScale>
      </View>
    </ColorBlock>
  );
}

function StatTile({ value, label, children, testID }: { value: string; label: string; children?: React.ReactNode; testID?: string }) {
  return (
    <Card style={{ flex: 1, minHeight: 128, padding: space[4], gap: space[1] }} testID={testID}>
      <Display size="xl" numberOfLines={1} style={{ fontVariant: ["tabular-nums"] }}>
        {value}
      </Display>
      <Text variant="label" tone="tertiary" numberOfLines={1}>
        {label}
      </Text>
      {children ? <View style={{ marginTop: "auto", paddingTop: space[2] }}>{children}</View> : null}
    </Card>
  );
}

/** The last seven days, a flame for each day the learner studied (the service's active days). The service counts
 *  learning days in UTC, so the labels are the UTC weekdays of those days (a local weekday would be a day off for
 *  part of the day far from UTC). */
function Week({ days }: { days: string[] }) {
  const fmt = useFormat();
  const set = new Set(days);
  const week = utcWeek().map((d) => ({ key: d.key, label: fmt.date(d.date, { weekday: "narrow", timeZone: "UTC" }) }));
  return (
    <View style={{ flexDirection: "row", gap: 3 }}>
      {week.map((d) => {
        const on = set.has(d.key);
        return (
          <View key={d.key} style={{ flex: 1, alignItems: "center", gap: 2 }}>
            <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: on ? colors.ember : colors.surface3, alignItems: "center", justifyContent: "center" }}>{on ? <Flame size={10} color={colors.ink} strokeWidth={2.4} /> : null}</View>
            <Text style={{ fontSize: 9, lineHeight: 11 }} tone="tertiary">
              {d.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

function Stats({ cat }: { cat: Catalog }) {
  const t = useT();
  const me = cat.me;
  return (
    <View style={{ paddingHorizontal: GUTTER, gap: space[3], marginTop: space[3] }}>
      <View style={{ flexDirection: "row", gap: space[3] }}>
        <StatTile value={String(me.streak)} label={t("mobileAcademy.stats.streakDays")} testID="stat-streak">
          <Week days={me.active_days} />
        </StatTile>
        <StatTile value={`${me.chapters_done}/${me.chapters_total}`} label={t("mobileAcademy.stats.chapters")} testID="stat-chapters">
          <View style={{ height: 4, borderRadius: 2, backgroundColor: colors.surface3, overflow: "hidden", flexDirection: "row" }}>
            <View style={{ width: `${pct(me.chapters_done, me.chapters_total)}%`, backgroundColor: colors.ember }} />
          </View>
        </StatTile>
      </View>
      <View style={{ flexDirection: "row", gap: space[3] }}>
        <StatTile value={me.quiz_avg === null ? "—" : `${me.quiz_avg}%`} label={t("academy.stats.quizAvg")} testID="stat-quiz">
          <Text variant="caption" tone="tertiary" numberOfLines={2}>
            {t("academy.progress.bestPerChapter")}
          </Text>
        </StatTile>
        <StatTile value={`${me.certificates}/${cat.phases.length}`} label={t("mobileAcademy.stats.certificates")} testID="stat-certs">
          <Text variant="caption" tone="tertiary" numberOfLines={2}>
            {t("academy.progress.onePerPhase")}
          </Text>
        </StatTile>
      </View>
    </View>
  );
}

function GlossaryTeaser() {
  const t = useT();
  const router = useRouter();
  return (
    <Card style={{ marginHorizontal: GUTTER, gap: space[4] }} testID="glossary-teaser">
      <View style={{ gap: space[1] }}>
        <Display size="md">{t("academy.home.glossary")}</Display>
        <Text variant="callout" tone="secondary">
          {t("academy.glossaryTeaser.subtitle")}
        </Text>
      </View>
      <PressableScale
        onPressIn={prefetchAcademy.glossary}
        onPress={() => router.push("/academy/glossary?focus=1")}
        scaleTo={0.985}
        accessibilityRole="search"
        accessibilityLabel={t("academy.glossaryTeaser.aria")}
        style={{ height: 48, borderRadius: radius.pill, backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.line, flexDirection: "row", alignItems: "center", gap: space[2], paddingHorizontal: space[4] }}
      >
        <Search size={18} color={colors.text3} />
        <Text variant="callout" tone="tertiary" numberOfLines={1} style={{ flex: 1 }}>
          {t("academy.glossaryTeaser.placeholder")}
        </Text>
      </PressableScale>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space[2] }}>
        {POPULAR.map((term) => (
          <PressableScale
            key={term}
            onPressIn={prefetchAcademy.glossary}
            onPress={() => router.push(`/academy/glossary?q=${encodeURIComponent(term)}`)}
            scaleTo={0.96}
            style={{ height: 36, paddingHorizontal: space[3], borderRadius: radius.pill, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface2, justifyContent: "center" }}
          >
            <Text variant="caption" tone="secondary" weight="600">
              {term}
            </Text>
          </PressableScale>
        ))}
      </View>
    </Card>
  );
}

function PracticeTeaser() {
  const t = useT();
  const demo = useDemoAccount();
  const practise = usePractise();
  return (
    <ColorBlock color="periwinkle" style={{ marginHorizontal: GUTTER, gap: space[3] }} testID="practice-teaser">
      <Tag label={t("academy.practiceCard.chip")} color={colors.ink} fg={colors.cream} solid style={{ alignSelf: "flex-start" }} />
      <Display size="md" color={colors.ink}>
        {t("mobileAcademy.practice.title")}
      </Display>
      <Text variant="callout" color={colors.ink2} style={{ fontWeight: "500" }}>
        {t("academy.practiceCard.text")}
      </Text>
      <Button
        label={demo === null ? t("academy.practice.openFreeDemo") : demo ? t("mobileAcademy.practice.onDemo", { login: demo.login }) : t("academy.practice.demo")}
        variant="secondary"
        size="md"
        full={false}
        onPress={() => practise()}
        style={{ marginTop: space[1] }}
      />
    </ColorBlock>
  );
}

function ProgressLinks({ cat }: { cat: Catalog }) {
  const t = useT();
  const router = useRouter();
  const ready = cat.phases.find((p) => !p.certificate && p.exam?.unlocked);
  const chevron = (
    <Directional>
      <ChevronRight size={18} color={colors.text3} />
    </Directional>
  );
  return (
    <Card padded={false} style={{ marginHorizontal: GUTTER }}>
      {ready ? (
        <PressableScale onPressIn={() => prefetchAcademy.exam(ready.slug)} onPress={() => router.push(`/academy/${ready.slug}/exam`)} scaleTo={0.985} style={{ minHeight: 72, flexDirection: "row", alignItems: "center", gap: space[3], paddingHorizontal: space[4], borderBottomWidth: 1, borderBottomColor: colors.line }} testID="exam-ready">
          <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.gold, alignItems: "center", justifyContent: "center" }}>
            <GraduationCap size={20} color={colors.ink} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="headline" weight="700">
              {t("academy.certs.examReady", { n: ready.order })}
            </Text>
            <Text variant="caption" tone="tertiary">
              {t("academy.certs.examMeta", { count: ready.exam!.questions, pass: ready.exam!.pass_mark })}
            </Text>
          </View>
          {chevron}
        </PressableScale>
      ) : null}
      <PressableScale onPressIn={prefetchAcademy.certificates} onPress={() => router.push("/academy/progress")} scaleTo={0.985} style={{ minHeight: 72, flexDirection: "row", alignItems: "center", gap: space[3], paddingHorizontal: space[4] }} testID="my-progress">
        <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface2, alignItems: "center", justifyContent: "center" }}>
          <Award size={20} color={colors.text} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="headline" weight="700">
            {t("academy.home.myProgress")}
          </Text>
          <Text variant="caption" tone="tertiary" numberOfLines={2}>
            {t("academy.progress.subtitle")}
          </Text>
        </View>
        {chevron}
      </PressableScale>
    </Card>
  );
}

export function AcademyHomeScreen() {
  const t = useT();
  const router = useRouter();
  const q = useCatalog();
  useRefreshOnFocus(q);
  useRetryOnReconnect(q);
  const { y, onScroll } = useScrollY();
  const bottom = useBottomInset(false);
  const pull = usePull(q.refresh);
  const cat = q.data;
  const openPhase = React.useCallback((slug: string) => router.push(`/academy/${slug}`), [router]);

  // a view-only login can't open the Academy (the server says so): no shortcuts into it either
  const viewer = useSession((s) => !!s.viewer);
  const actions = viewer ? null : (
    <>
      <IconButton tone="ghost" accessibilityLabel={t("mobileAcademy.a11y.glossary")} icon={<Library size={21} color={colors.text} />} onPress={() => router.push("/academy/glossary")} />
      <IconButton tone="ghost" accessibilityLabel={t("mobileAcademy.a11y.progress")} icon={<Award size={21} color={colors.text} />} onPress={() => router.push("/academy/progress")} />
    </>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* opened from a link with nothing under it: back goes to the More tab (where the Academy lives) */}
      <TopBar title={t("academy.title")} y={y} right={actions} onBack={() => (router.canGoBack() ? router.back() : router.replace("/more"))} />
      {!cat ? (
        <ScrollView contentContainerStyle={{ paddingBottom: bottom }} refreshControl={<RefreshControl refreshing={pull.refreshing} onRefresh={pull.onRefresh} tintColor={colors.text3} colors={[colors.ember]} progressBackgroundColor={colors.surface} />}>
          <LargeTitle eyebrow={t("mobileAcademy.eyebrow")} title={t("academy.title")} />
          {q.error ? <AcademyState error={q.error} onRetry={() => void q.refresh()} /> : <HomeSkeleton />}
        </ScrollView>
      ) : (
        <Animated.ScrollView
          onScroll={onScroll}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: bottom + space[4] }}
          refreshControl={<RefreshControl refreshing={pull.refreshing} onRefresh={pull.onRefresh} tintColor={colors.text3} colors={[colors.ember]} progressBackgroundColor={colors.surface} />}
          testID="academy-home"
        >
          <LargeTitle eyebrow={t("mobileAcademy.eyebrow")} title={t("academy.title")} subtitle={t("mobileAcademy.home.subtitle", { count: cat.me.chapters_total })} />
          <View style={{ paddingHorizontal: GUTTER }}>
            <ContinueHero cat={cat} />
          </View>
          <Stats cat={cat} />
          <SectionTitle title={t("academy.home.pathTitle")} />
          <Text variant="callout" tone="tertiary" style={{ paddingHorizontal: GUTTER, marginTop: -space[1], marginBottom: space[4] }}>
            {t("academy.home.pathText")}
          </Text>
          <View style={{ paddingHorizontal: GUTTER, gap: space[3] }} testID="phase-grid">
            {cat.phases.map((p) => (
              <PhaseBlock key={p.slug} p={p} onOpen={openPhase} />
            ))}
          </View>
          <View style={{ height: space[8] }} />
          <ProgressLinks cat={cat} />
          <View style={{ height: space[4] }} />
          <GlossaryTeaser />
          <View style={{ height: space[4] }} />
          <PracticeTeaser />
          <RiskNote />
        </Animated.ScrollView>
      )}
    </View>
  );
}
