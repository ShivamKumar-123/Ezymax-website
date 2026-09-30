// The chapter quiz, graded by the Academy service (the app never has the answers): every tap sends the answers so
// far and each answered question comes back right or wrong with its explanation at once. When all are answered the
// attempt counts; scoring 60 % or more completes the chapter (the service decides, the app shows its answer).
import * as React from "react";
import { ActivityIndicator, View } from "react-native";
import { RotateCcw } from "lucide-react-native";
import { useT } from "@/i18n";
import { Button, ColorBlock, Display, Text, toast } from "@/ui";
import { colors, radius, space } from "@/theme/tokens";
import { postQuiz, type Question, type QuizReply, type QuizResult } from "../api";
import { DONE_BLOCK, TONE } from "../format";
import { Feedback, Option, type OptionState } from "./Option";

const QuestionBlock = React.memo(function QuestionBlock({ qi, q, answer, result, onChoose }: { qi: number; q: Question; answer: number | null; result: QuizResult | undefined; onChoose: (qi: number, oi: number) => void }) {
  const t = useT();
  return (
    <View testID={`quiz-q-${qi}`} style={{ gap: space[2] }}>
      <View style={{ flexDirection: "row", gap: space[2], marginBottom: space[1] }}>
        <Text variant="headline" tone="tertiary" style={{ fontVariant: ["tabular-nums"] }}>{`${qi + 1}.`}</Text>
        <Text variant="headline" weight="600" style={{ flex: 1, fontSize: 16.5, lineHeight: 23 }}>
          {q.question}
        </Text>
      </View>
      {q.options.map((o, oi) => {
        const state: OptionState = result ? (oi === result.choice ? (result.correct ? "correct" : "wrong") : oi === result.answer ? "reveal" : "idle") : answer === oi ? "chosen" : "idle";
        // a graded question is final; while an answer is being checked choose() ignores taps (no dimming flash)
        return <Option key={oi} qi={qi} oi={oi} label={o} state={state} disabled={!!result} onChoose={onChoose} testID={`quiz-q-${qi}-o-${oi}`} />;
      })}
      {result ? <Feedback testID={`quiz-feedback-${qi}`} correct={result.correct} explanation={result.explanation} correctLabel={t("academy.quiz.correct")} wrongLabel={t("academy.quiz.notQuite")} /> : null}
    </View>
  );
});

type Props = { slug: string; lang: string; questions: Question[]; passedBefore: boolean; onDone?: (r: QuizReply) => void };

export function ChapterQuiz({ slug, lang, questions, passedBefore, onDone }: Props) {
  const t = useT();
  const [answers, setAnswers] = React.useState<(number | null)[]>(() => questions.map(() => null));
  const [results, setResults] = React.useState<Record<number, QuizResult>>({});
  const [final, setFinal] = React.useState<QuizReply | null>(null);
  const [busy, setBusy] = React.useState(false);
  // the latest state for the stable choose() handler (rows re-render only when their own question changes)
  const live = React.useRef({ answers, results, busy });
  live.current = { answers, results, busy };
  const doneRef = React.useRef(onDone);
  doneRef.current = onDone;

  const choose = React.useCallback(
    async (qi: number, oi: number) => {
      const cur = live.current;
      if (cur.busy || cur.results[qi]) return;
      const prev = cur.answers;
      const next = prev.map((a, i) => (i === qi ? oi : a));
      live.current = { ...cur, answers: next, busy: true };
      setAnswers(next);
      setBusy(true);
      const r = await postQuiz(slug, next, lang);
      setBusy(false);
      if (!r.ok) {
        live.current = { ...live.current, answers: prev, busy: false };
        setAnswers(prev);
        toast.show({ title: t("academy.toast.checkFailed"), body: r.error.message, tone: "error" });
        return;
      }
      setResults(Object.fromEntries(r.data.results.map((x) => [x.index, x])));
      if (r.data.all_answered) {
        setFinal(r.data);
        doneRef.current?.(r.data);
        if (r.data.completed_now)
          toast.show({ title: t("academy.toast.chapterComplete"), body: r.data.phase.exam_unlocked ? t("academy.toast.examUnlocked") : t("academy.toast.phaseProgress", { done: r.data.phase.done, total: r.data.phase.total }), tone: "success" }, 3600);
      }
    },
    [slug, lang, t],
  );

  const reset = () => {
    setAnswers(questions.map(() => null));
    setResults({});
    setFinal(null);
  };

  const answered = Object.keys(results).length;
  const need = final ? Math.ceil((final.pass_pct / 100) * final.total) : 0;
  return (
    <View testID="chapter-quiz" style={{ borderRadius: radius.card, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, padding: space[5], gap: space[6] }}>
      <View style={{ gap: space[1] }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: space[2] }}>
          <Text variant="label" tone="ember" style={{ flex: 1 }}>
            {t("academy.quiz.eyebrow")}
          </Text>
          {passedBefore && !final ? (
            <View style={{ height: 24, paddingHorizontal: space[3], borderRadius: radius.pill, backgroundColor: TONE.done, justifyContent: "center" }}>
              <Text variant="label" color={colors.ink} style={{ fontSize: 10 }}>
                {t("academy.quiz.alreadyPassed")}
              </Text>
            </View>
          ) : null}
        </View>
        <Display size="md" accessibilityRole="header">
          {t("academy.quiz.title")}
        </Display>
        <Text variant="caption" tone="tertiary">
          {t("academy.quiz.meta", { count: questions.length })}
        </Text>
      </View>

      {questions.map((q, qi) => (
        <QuestionBlock key={qi} qi={qi} q={q} answer={answers[qi] ?? null} result={results[qi]} onChoose={choose} />
      ))}

      {final ? (
        <ColorBlock color={final.passed ? DONE_BLOCK : "gold"} testID="quiz-result" style={{ gap: space[3], padding: space[5] }}>
          <Display size="xl" color={colors.ink} accessibilityLabel={t("academy.quiz.score", { score: final.score, total: final.total })}>
            {`${final.score} / ${final.total}`}
          </Display>
          <Text variant="callout" color={colors.ink2}>
            {final.passed ? (final.completed_now ? t("academy.quiz.passedComplete") : t("academy.quiz.passed")) : t("academy.quiz.needMore", { count: need })}
          </Text>
          <Button label={t("academy.quiz.retake")} variant="secondary" size="md" full={false} icon={<RotateCcw size={16} color={colors.text} />} onPress={reset} />
        </ColorBlock>
      ) : (
        <View style={{ flexDirection: "row", alignItems: "center", gap: space[2], minHeight: 20 }}>
          <Text variant="caption" tone="tertiary" style={{ fontVariant: ["tabular-nums"] }}>
            {t("academy.answered", { answered, total: questions.length })}
          </Text>
          {busy ? <ActivityIndicator size="small" color={colors.text3} /> : null}
        </View>
      )}
    </View>
  );
}
