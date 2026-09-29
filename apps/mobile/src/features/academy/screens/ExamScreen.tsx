// /academy/[phase]/exam: the phase's final exam. It unlocks when every chapter of the phase is complete (the service
// refuses it otherwise). Answers stay on the phone until Submit; the service grades them and, at the pass mark or
// above, issues the phase certificate at once. After submitting, each question shows the right answer and why.
import * as React from "react";
import { RefreshControl, ScrollView, View } from "react-native";
import Animated, { useAnimatedRef } from "react-native-reanimated";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Award, GraduationCap, Lock, RotateCcw } from "lucide-react-native";
import { useFormat, useT } from "@/i18n";
import { Button, Card, ColorBlock, Display, Text, toast, useBottomInset } from "@/ui";
import { colors, GUTTER, radius, space } from "@/theme/tokens";
import { postExam, useExam, type ExamReply, type ExamView, type Question, type QuizResult } from "../api";
import { LargeTitle, TopBar, useScrollY } from "../components/Bar";
import { CertificateCard } from "../components/Certificate";
import { Feedback, Option, type OptionState } from "../components/Option";
import { Bar, Tag } from "../components/Pills";
import { AcademyState, ReaderSkeleton, RiskNote } from "../components/states";
import { levelLabel, pct } from "../format";
import { usePull, useRetryOnReconnect } from "../hooks";

const ExamQuestion = React.memo(function ExamQuestion({ qi, q, answer, result, locked, onChoose }: { qi: number; q: Question; answer: number | null; result: QuizResult | undefined; locked: boolean; onChoose: (qi: number, oi: number) => void }) {
  const t = useT();
  return (
    <Card testID={`exam-q-${qi}`} style={{ marginHorizontal: GUTTER, gap: space[2] }}>
      <View style={{ flexDirection: "row", gap: space[2], marginBottom: space[1] }}>
        <Text variant="headline" tone="tertiary" style={{ fontVariant: ["tabular-nums"] }}>{`${qi + 1}.`}</Text>
        <Text variant="headline" weight="600" style={{ flex: 1, fontSize: 16.5, lineHeight: 23 }}>
          {q.question}
        </Text>
      </View>
      {q.options.map((o, oi) => {
        const state: OptionState = result ? (oi === result.choice ? (result.correct ? "correct" : "wrong") : oi === result.answer ? "reveal" : "idle") : answer === oi ? "chosen" : "idle";
        return <Option key={oi} qi={qi} oi={oi} label={o} state={state} disabled={locked} onChoose={onChoose} testID={`exam-q-${qi}-o-${oi}`} />;
      })}
      {result ? <Feedback correct={result.correct} explanation={result.explanation} correctLabel={t("academy.quiz.correct")} wrongLabel={t("academy.quiz.notQuite")} /> : null}
    </Card>
  );
});

function Locked({ data }: { data: ExamView }) {
  const t = useT();
  const router = useRouter();
  return (
    <Card testID="exam-locked" style={{ marginHorizontal: GUTTER, gap: space[4] }}>
      <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: colors.surface2, alignItems: "center", justifyContent: "center" }}>
        <Lock size={22} color={colors.text3} />
      </View>
      <Display size="sm">{t("academy.exam.lockedTitle")}</Display>
      <Text variant="callout" tone="secondary">
        {t("academy.exam.lockedBody", { done: data.chapters_done, total: data.chapters_total })}
      </Text>
      <Bar value={pct(data.chapters_done, data.chapters_total)} />
      <Button label={t("academy.exam.backToChapters")} full={false} onPress={() => (router.canGoBack() ? router.back() : router.replace(`/academy/${data.phase.slug}`))} />
    </Card>
  );
}

function Result({ r, data, onRetake }: { r: ExamReply; data: ExamView; onRetake: () => void }) {
  const t = useT();
  return (
    <View style={{ paddingHorizontal: GUTTER, gap: space[4] }}>
      <ColorBlock color={r.passed ? "mint" : "gold"} testID="exam-result" style={{ gap: space[3] }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: space[2] }}>
          {r.passed ? <Award size={18} color={colors.ink} /> : <GraduationCap size={18} color={colors.ink} />}
          <Text variant="label" color={colors.ink2}>
            {r.passed ? t("academy.exam.passed") : t("academy.exam.passMarkPct", { pct: r.pass_mark })}
          </Text>
        </View>
        <Display size="hero" color={colors.ink} style={{ fontVariant: ["tabular-nums"] }}>{`${r.pct}%`}</Display>
        <Text variant="callout" color={colors.ink2} style={{ fontWeight: "500" }}>
          {t("academy.exam.resultLine", { score: r.score, total: r.total })}
        </Text>
        {!r.certificate ? (
          <Text variant="callout" color={colors.ink2}>
            {t("academy.exam.reviewText")}
          </Text>
        ) : null}
        <Button label={t("academy.exam.retake")} variant="secondary" size="md" full={false} icon={<RotateCcw size={16} color={colors.text} />} onPress={onRetake} />
      </ColorBlock>
      {r.certificate ? <CertificateCard testID="exam-certificate" code={r.certificate.code} issuedAt={r.certificate.issued_at} n={data.phase.order} title={data.phase.title} scorePct={r.certificate.score_pct} /> : null}
    </View>
  );
}

function Exam({ data, refresh }: { data: ExamView; refresh: () => Promise<void> }) {
  const t = useT();
  const fmt = useFormat();
  const bottom = useBottomInset(false);
  const { y, onScroll } = useScrollY();
  const scroll = useAnimatedRef<Animated.ScrollView>();
  const total = data.exam.questions.length;
  const [answers, setAnswers] = React.useState<(number | null)[]>(() => Array.from({ length: total }, () => null));
  const [result, setResult] = React.useState<ExamReply | null>(null);
  const [busy, setBusy] = React.useState(false);
  const pull = usePull(refresh);
  // a different exam (content update): start over; a refresh of the attempts keeps the answers
  const examKey = `${data.phase.slug}:${total}`;
  React.useEffect(() => {
    setAnswers(Array.from({ length: Number(examKey.split(":")[1]) }, () => null));
    setResult(null);
  }, [examKey]);

  const busyRef = React.useRef(false);
  busyRef.current = busy;
  const choose = React.useCallback((qi: number, oi: number) => {
    if (busyRef.current) return;
    setAnswers((a) => a.map((x, i) => (i === qi ? oi : x)));
  }, []);
  const answered = answers.filter((a) => a !== null).length;
  const byIndex = React.useMemo(() => Object.fromEntries((result?.results ?? []).map((r) => [r.index, r])) as Record<number, QuizResult>, [result]);

  const submit = async () => {
    if (answered < total || busy) return;
    setBusy(true);
    const r = await postExam(data.phase.slug, answers as number[]);
    setBusy(false);
    if (!r.ok) {
      toast.show({ title: t("academy.toast.examFailed"), body: r.error.message, tone: "error" });
      return;
    }
    setResult(r.data);
    scroll.current?.scrollTo({ y: 0, animated: true });
    if (r.data.certificate_issued) {
      toast.show({ title: t("academy.toast.certIssued"), body: t("academy.phaseTitle", { n: data.phase.order, title: data.phase.title }), tone: "success" }, 3600);
    }
  };
  const retake = () => {
    setResult(null);
    setAnswers(Array.from({ length: total }, () => null));
    scroll.current?.scrollTo({ y: 0, animated: true });
    void refresh();
  };

  return (
    <>
      <TopBar title={t("academy.exam.phaseExam", { n: data.phase.order })} y={y} />
      <Animated.ScrollView
        ref={scroll}
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: bottom + (data.unlocked && !result ? 96 : space[6]) }}
        refreshControl={<RefreshControl refreshing={pull.refreshing} onRefresh={pull.onRefresh} tintColor={colors.text3} colors={[colors.ember]} progressBackgroundColor={colors.surface} />}
        testID="exam-scroll"
      >
        <View style={{ flexDirection: "row", gap: space[2], paddingHorizontal: GUTTER, paddingTop: space[2] }}>
          <Tag label={t("academy.exam.final")} color={colors.ember} />
          <Tag label={levelLabel(t, data.phase.level)} />
        </View>
        <LargeTitle title={t("academy.exam.phaseExam", { n: data.phase.order })} subtitle={`${data.phase.title} · ${t("academy.exam.intro", { count: total, pass: data.exam.pass_mark })}`} size="xl" style={{ paddingTop: space[3] }} />
        {!data.unlocked ? (
          <Locked data={data} />
        ) : (
          <View style={{ gap: space[4] }}>
            {result ? <Result r={result} data={data} onRetake={retake} /> : null}
            {data.exam.questions.map((q, qi) => (
              <ExamQuestion key={qi} qi={qi} q={q} answer={answers[qi] ?? null} result={byIndex[qi]} locked={!!result} onChoose={choose} />
            ))}
            {data.attempts.length > 0 && !result ? (
              <Text variant="caption" tone="tertiary" style={{ paddingHorizontal: GUTTER, fontVariant: ["tabular-nums"] }}>
                {t("academy.exam.previousAttempts", { list: data.attempts.map((a) => `${a.passed ? t("academy.exam.attemptPassed", { pct: a.pct }) : `${a.pct}%`} (${fmt.date(a.at)})`).join(" · ") })}
              </Text>
            ) : null}
          </View>
        )}
        <RiskNote />
      </Animated.ScrollView>
      {data.unlocked && !result ? (
        <View style={{ position: "absolute", start: 0, end: 0, bottom: 0, paddingHorizontal: GUTTER, paddingTop: space[3], paddingBottom: bottom, backgroundColor: colors.bg, borderTopWidth: 1, borderTopColor: colors.line, flexDirection: "row", alignItems: "center", gap: space[3] }}>
          <View style={{ flex: 1 }}>
            <Text variant="callout" weight="700" style={{ fontVariant: ["tabular-nums"] }}>
              {t("academy.answered", { answered, total })}
            </Text>
            {answered < total ? (
              <Text variant="caption" tone="tertiary" numberOfLines={2}>
                {t("mobileAcademy.exam.answerAll")}
              </Text>
            ) : null}
          </View>
          <Button label={busy ? t("academy.exam.submitting") : t("academy.exam.submit")} full={false} loading={busy} disabled={answered < total} onPress={() => void submit()} testID="exam-submit" />
        </View>
      ) : null}
    </>
  );
}

export function ExamScreen() {
  const params = useLocalSearchParams<{ phase: string }>();
  const phase = typeof params.phase === "string" ? params.phase : null;
  const q = useExam(phase);
  useRetryOnReconnect(q);
  const data = q.data && q.data.phase.slug === phase ? q.data : undefined;
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {data ? (
        <Exam data={data} refresh={q.refresh} />
      ) : (
        <>
          <TopBar />
          <ScrollView>{q.error ? <AcademyState error={q.error} onRetry={() => void q.refresh()} /> : <ReaderSkeleton />}</ScrollView>
        </>
      )}
    </View>
  );
}
