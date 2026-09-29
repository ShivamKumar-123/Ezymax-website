// /academy/progress: the learner's numbers (chapters, certificates, quiz average, streak) as huge figures, progress
// by phase (both tracks, exam, certificate) and the certificates themselves, each with Share, Copy link and Verify.
import * as React from "react";
import { RefreshControl, ScrollView, View } from "react-native";
import Animated from "react-native-reanimated";
import { useRouter } from "expo-router";
import { ChevronRight } from "lucide-react-native";
import { useLocale, useT } from "@/i18n";
import { Card, Display, EmptyState, PressableScale, Text, useBottomInset } from "@/ui";
import { colors, GUTTER, space } from "@/theme/tokens";
import { useCatalog, useCertificates, type Catalog, type PhaseT } from "../api";
import { LargeTitle, SectionTitle, TopBar, useScrollY } from "../components/Bar";
import { CertificateCard } from "../components/Certificate";
import { Bar, Tag } from "../components/Pills";
import { AcademyState, HomeSkeleton, RiskNote } from "../components/states";
import { fmtMin, levelLabel, pct, TRACK_SHORT } from "../format";
import { usePull, useRefreshOnFocus, useRetryOnReconnect } from "../hooks";

function Kpi({ value, label, chip }: { value: string; label: string; chip: string }) {
  return (
    <Card style={{ flex: 1, minHeight: 128, padding: space[4], justifyContent: "space-between", gap: space[2] }}>
      <Text variant="label" tone="tertiary" numberOfLines={2}>
        {label}
      </Text>
      <Display size="xl" numberOfLines={1} style={{ fontVariant: ["tabular-nums"] }}>
        {value}
      </Display>
      <Text variant="caption" tone="secondary" numberOfLines={2}>
        {chip}
      </Text>
    </Card>
  );
}

const PhaseLine = React.memo(function PhaseLine({ p, onOpen }: { p: PhaseT; onOpen: (slug: string) => void }) {
  const t = useT();
  const { rtl } = useLocale();
  const e = p.exam;
  const exam = e?.passed ? { label: t("academy.progress.examPassed", { pct: e.best_pct }), color: colors.mint } : e?.unlocked ? { label: t("academy.progress.ready"), color: colors.gold } : e?.attempts ? { label: t("academy.progress.best", { pct: e.best_pct }), color: colors.gold } : { label: t("academy.exam.locked"), color: colors.text3 };
  return (
    <PressableScale onPress={() => onOpen(p.slug)} scaleTo={0.985} style={{ paddingHorizontal: GUTTER, paddingVertical: space[4], gap: space[3], borderBottomWidth: 1, borderBottomColor: colors.line }} testID={`progress-${p.slug}`}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: space[2] }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="headline" weight="700" numberOfLines={1}>
            {`${p.order}. ${p.title}`}
          </Text>
          <Text variant="caption" tone="tertiary">
            {levelLabel(t, p.level)}
          </Text>
        </View>
        <ChevronRight size={18} color={colors.text3} style={rtl ? { transform: [{ scaleX: -1 }] } : undefined} />
      </View>
      <View style={{ flexDirection: "row", gap: space[4] }}>
        {(["fundamental", "technical"] as const).map((tk) => {
          const s = p.sections.find((x) => x.track === tk);
          const d = s?.chapters.filter((c) => c.progress.completed).length ?? 0;
          const n = s?.chapters.length ?? 0;
          return (
            <View key={tk} style={{ flex: 1, gap: 6 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text variant="caption" tone="secondary">
                  {t(TRACK_SHORT[tk])}
                </Text>
                <Text variant="caption" tone="secondary" style={{ fontVariant: ["tabular-nums"] }}>{`${d}/${n}`}</Text>
              </View>
              <Bar value={pct(d, n)} height={4} color={d === n && n > 0 ? colors.mint : colors.ember} />
            </View>
          );
        })}
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space[2] }}>
        <Tag label={`${t("academy.progress.col.exam")} · ${exam.label}`} color={exam.color} />
        {p.certificate ? <Tag label={p.certificate.code} color={colors.mint} /> : null}
      </View>
    </PressableScale>
  );
});

function Body({ cat }: { cat: Catalog }) {
  const t = useT();
  const router = useRouter();
  const certs = useCertificates();
  const me = cat.me;
  const open = React.useCallback((slug: string) => router.push(`/academy/${slug}`), [router]);
  return (
    <>
      <View style={{ paddingHorizontal: GUTTER, gap: space[3] }}>
        <View style={{ flexDirection: "row", gap: space[3] }}>
          <Kpi label={t("academy.progress.chaptersComplete")} value={`${me.chapters_done}/${me.chapters_total}`} chip={t("academy.progress.ofCourse", { pct: pct(me.chapters_done, me.chapters_total) })} />
          <Kpi label={t("academy.certs.title")} value={`${me.certificates}/${cat.phases.length}`} chip={t("academy.progress.onePerPhase")} />
        </View>
        <View style={{ flexDirection: "row", gap: space[3] }}>
          <Kpi label={t("academy.stats.quizAvg")} value={me.quiz_avg === null ? "–" : `${me.quiz_avg}%`} chip={t("academy.progress.bestPerChapter")} />
          <Kpi label={t("academy.stats.streak")} value={String(me.streak)} chip={t("academy.progress.studied", { time: fmtMin(t, me.minutes_done) })} />
        </View>
      </View>

      <SectionTitle title={t("academy.progress.byPhase")} />
      <Text variant="callout" tone="tertiary" style={{ paddingHorizontal: GUTTER, marginTop: -space[1], marginBottom: space[2] }}>
        {t("academy.progress.byPhaseSub")}
      </Text>
      <View style={{ borderTopWidth: 1, borderTopColor: colors.line }} testID="progress-table">
        {cat.phases.map((p) => (
          <PhaseLine key={p.slug} p={p} onOpen={open} />
        ))}
      </View>

      <SectionTitle title={t("academy.certs.title")} />
      <Text variant="callout" tone="tertiary" style={{ paddingHorizontal: GUTTER, marginTop: -space[1], marginBottom: space[4] }}>
        {t("academy.progress.certsText")}
      </Text>
      {certs.data && certs.data.certificates.length > 0 ? (
        <View style={{ paddingHorizontal: GUTTER, gap: space[4] }}>
          {certs.data.certificates.map((c) => (
            <CertificateCard key={c.code} testID="certificate-tile" code={c.code} issuedAt={c.issued_at} n={c.phase_order} title={c.phase_title} url={c.verify_url} scorePct={c.score_pct} />
          ))}
        </View>
      ) : certs.data || certs.error ? (
        <EmptyState
          illustration="kycApproved"
          size={170}
          title={t("academy.progress.noCerts")}
          body={t("academy.progress.noCertsText")}
          action={t("academy.hero.continue")}
          onAction={() => router.dismissTo("/academy")}
          style={{ paddingVertical: space[4] }}
        />
      ) : null}
    </>
  );
}

export function ProgressScreen() {
  const t = useT();
  const q = useCatalog();
  const certs = useCertificates();
  useRefreshOnFocus(q);
  useRetryOnReconnect(q);
  const { y, onScroll } = useScrollY();
  const bottom = useBottomInset(false);
  const refresh = React.useCallback(async () => {
    await Promise.all([q.refresh(), certs.refresh()]);
  }, [q.refresh, certs.refresh]);
  const pull = usePull(refresh);
  const rc = <RefreshControl refreshing={pull.refreshing} onRefresh={pull.onRefresh} tintColor={colors.text3} colors={[colors.ember]} progressBackgroundColor={colors.surface} />;
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <TopBar title={t("academy.home.myProgress")} y={y} />
      {q.data ? (
        <Animated.ScrollView onScroll={onScroll} scrollEventThrottle={16} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: bottom + space[4] }} refreshControl={rc} testID="academy-progress">
          <LargeTitle eyebrow={t("mobileAcademy.eyebrow")} title={t("academy.home.myProgress")} subtitle={t("academy.progress.subtitle")} />
          <Body cat={q.data} />
          <RiskNote />
        </Animated.ScrollView>
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: bottom }} refreshControl={rc}>
          <LargeTitle eyebrow={t("mobileAcademy.eyebrow")} title={t("academy.home.myProgress")} />
          {q.error ? <AcademyState error={q.error} onRetry={() => void q.refresh()} /> : <HomeSkeleton />}
        </ScrollView>
      )}
    </View>
  );
}
