"use client";

import * as React from "react";
import { CheckCircle2, RotateCcw, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button, Card, Chip, cn } from "@/components/kit";
import { tr, useT } from "@ezymex/i18n/react";
import { academyApi, type Question, type QuizReply, type QuizResult } from "./api";

export function OptionButton({
  label,
  letter,
  state,
  disabled,
  onClick,
  testId,
}: {
  label: string;
  letter: string;
  state: "idle" | "chosen" | "correct" | "wrong" | "reveal";
  disabled?: boolean;
  onClick?: () => void;
  testId?: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      data-testid={testId}
      className={cn(
        "flex w-full items-start gap-3 rounded-[14px] border px-3.5 py-3 text-start text-[14px] transition-colors",
        state === "idle" && "border-line bg-surface-2 text-fg-2 hover:border-fg-3/50 hover:text-fg",
        state === "chosen" && "border-ember/50 bg-ember-soft text-fg",
        state === "correct" && "border-up/40 bg-up-soft text-fg",
        state === "wrong" && "border-down/40 bg-down-soft text-fg",
        state === "reveal" && "border-up/30 bg-surface-2 text-fg",
        disabled && state === "idle" && "opacity-60",
      )}
    >
      <span
        className={cn(
          "k-num mt-px grid size-6 shrink-0 place-items-center rounded-full border text-[11px] font-semibold",
          state === "correct" || state === "reveal" ? "border-up/40 text-up" : state === "wrong" ? "border-down/40 text-down" : state === "chosen" ? "border-ember/50 text-ember" : "border-line text-fg-3",
        )}
      >
        {state === "correct" || state === "reveal" ? <CheckCircle2 className="size-3.5" /> : state === "wrong" ? <XCircle className="size-3.5" /> : letter}
      </span>
      <span className="min-w-0 leading-snug">{label}</span>
    </button>
  );
}

export const LETTERS = ["A", "B", "C", "D", "E"];

/** Chapter quiz: every answer is checked by the service at once; the attempt is recorded when all are answered. */
export function ChapterQuiz({ slug, questions, passedBefore, onDone }: { slug: string; questions: Question[]; passedBefore: boolean; onDone: (r: QuizReply) => void }) {
  const t = useT();
  const [answers, setAnswers] = React.useState<(number | null)[]>(() => questions.map(() => null));
  const [results, setResults] = React.useState<Record<number, QuizResult>>({});
  const [final, setFinal] = React.useState<QuizReply | null>(null);
  const [busy, setBusy] = React.useState(false);

  const choose = async (qi: number, oi: number) => {
    if (busy || results[qi]) return;
    const next = answers.map((a, i) => (i === qi ? oi : a));
    setAnswers(next);
    setBusy(true);
    try {
      const r = await academyApi<QuizReply>(`chapters/${slug}/quiz`, { body: { answers: next } });
      setResults(Object.fromEntries(r.results.map((x) => [x.index, x])));
      if (r.all_answered) {
        setFinal(r);
        onDone(r);
        if (r.completed_now) toast.success(tr("academy.toast.chapterComplete"), { description: r.phase.exam_unlocked ? tr("academy.toast.examUnlocked") : tr("academy.toast.phaseProgress", { done: r.phase.done, total: r.phase.total }) });
      }
    } catch (e) {
      setAnswers(answers);
      toast.error(tr("academy.toast.checkFailed"), { description: e instanceof Error ? e.message : undefined });
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setAnswers(questions.map(() => null));
    setResults({});
    setFinal(null);
  };

  const answered = Object.keys(results).length;
  return (
    <Card className="p-5 sm:p-6" data-testid="chapter-quiz">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="k-label">{t("academy.quiz.eyebrow")}</div>
          <h2 className="mt-1 text-[19px] font-medium tracking-tight">{t("academy.quiz.title")}</h2>
          <p className="mt-0.5 text-[13px] text-fg-3">
            {t("academy.quiz.meta", { count: questions.length })}
          </p>
        </div>
        {passedBefore && !final && (
          <Chip tone="up" dot>
            {t("academy.quiz.alreadyPassed")}
          </Chip>
        )}
      </div>

      <div className="mt-5 space-y-6">
        {questions.map((q, qi) => {
          const r = results[qi];
          return (
            <div key={qi} data-testid={`quiz-q-${qi}`}>
              <div className="mb-2.5 flex gap-2 text-[14.5px] font-medium leading-snug text-fg">
                <span className="k-num text-fg-3">{qi + 1}.</span>
                <span>{q.question}</span>
              </div>
              <div className="grid gap-2">
                {q.options.map((o, oi) => {
                  const state = r ? (oi === r.choice ? (r.correct ? "correct" : "wrong") : oi === r.answer ? "reveal" : "idle") : answers[qi] === oi ? "chosen" : "idle";
                  return <OptionButton key={oi} letter={LETTERS[oi]!} label={o} state={state} disabled={!!r || busy} onClick={() => choose(qi, oi)} testId={`quiz-q-${qi}-o-${oi}`} />;
                })}
              </div>
              {r && (
                <div className={cn("mt-2.5 rounded-[12px] border px-3.5 py-2.5 text-[13px] leading-relaxed", r.correct ? "border-up/25 bg-up-soft text-fg-2" : "border-down/25 bg-down-soft text-fg-2")} data-testid={`quiz-feedback-${qi}`}>
                  <span className={cn("font-semibold", r.correct ? "text-up" : "text-down")}>{r.correct ? t("academy.quiz.correct") : t("academy.quiz.notQuite")} </span>
                  {r.explanation}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {final ? (
        <div className={cn("mt-6 flex flex-wrap items-center justify-between gap-3 rounded-[16px] border p-4", final.passed ? "border-up/30 bg-up-soft" : "border-warn/30 bg-warn-soft")} data-testid="quiz-result">
          <div>
            <div className="k-num text-[18px] font-semibold">
              {t("academy.quiz.score", { score: final.score, total: final.total })}
            </div>
            <div className="text-[13px] text-fg-2">{final.passed ? (final.completed_now ? t("academy.quiz.passedComplete") : t("academy.quiz.passed")) : t("academy.quiz.needMore", { count: Math.ceil((final.pass_pct / 100) * final.total) })}</div>
          </div>
          <Button variant="surface" size="sm" onClick={reset}>
            <RotateCcw /> {t("academy.quiz.retake")}
          </Button>
        </div>
      ) : (
        <div className="k-num mt-5 text-[12px] text-fg-3">
          {t("academy.answered", { answered, total: questions.length })}
        </div>
      )}
    </Card>
  );
}
