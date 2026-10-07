"use client";

import * as React from "react";
import Link from "next/link";
import { Award, Download, GraduationCap, Lock, RotateCcw, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button, Card, Chip, Progress, cn } from "@/components/kit";
import { tr, useT } from "@kalks/i18n/react";
import { LEVEL_TONE, academyApi, fmtDay, isElective, levelLabel, pct, useAcademy, type ExamReply, type ExamView } from "./api";
import { LETTERS, OptionButton } from "./quiz";
import { AcademyUnavailable, BackLink, PageSkeleton, RISK_NOTE } from "./shared";

export function LiveExam({ phase }: { phase: string }) {
  const t = useT();
  const { data, error, reload } = useAcademy<ExamView>(`exams/${phase}`);
  const [answers, setAnswers] = React.useState<(number | null)[]>([]);
  const [result, setResult] = React.useState<ExamReply | null>(null);
  const [busy, setBusy] = React.useState(false);
  // reset answers when the exam itself changes, not when attempts are refreshed after a retake
  const examKey = data ? `${data.phase.slug}:${data.exam.questions.length}` : "";
  React.useEffect(() => {
    if (examKey) setAnswers(Array.from({ length: Number(examKey.split(":")[1]) }, () => null));
  }, [examKey]);

  if (error) return <AcademyUnavailable error={error} onRetry={reload} />;
  if (!data) return <PageSkeleton />;
  const p = data.phase;
  const answered = answers.filter((a) => a !== null).length;
  const total = data.exam.questions.length;
  const byIndex = Object.fromEntries((result?.results ?? []).map((r) => [r.index, r]));

  const submit = async () => {
    setBusy(true);
    try {
      const r = await academyApi<ExamReply>(`exams/${phase}`, { body: { answers } });
      setResult(r);
      window.scrollTo({ top: 0, behavior: "smooth" });
      if (r.certificate_issued) toast.success(tr("academy.toast.certIssued"), { description: tr("academy.phaseTitle", { n: p.order, title: p.title }) });
    } catch (e) {
      toast.error(tr("academy.toast.examFailed"), { description: e instanceof Error ? e.message : undefined });
    } finally {
      setBusy(false);
    }
  };
  const retake = () => {
    setResult(null);
    setAnswers(data.exam.questions.map(() => null));
    reload();
    window.scrollTo({ top: 0 });
  };

  return (
    <div className="mx-auto max-w-[820px] pb-16">
      <BackLink href={`/academy/phase/${p.slug}`}>
        {t("academy.phaseTitle", { n: p.order, title: p.title })}
      </BackLink>
      <div className="flex flex-wrap items-center gap-2">
        <Chip tone="ember">{t("academy.exam.final")}</Chip>
        <Chip tone={LEVEL_TONE[p.level]}>{levelLabel(p.level)}</Chip>
        {isElective(p) && <Chip>{t("academy.elective")}</Chip>}
      </div>
      <h1 className="mt-3 text-[28px] font-medium leading-tight tracking-[-0.02em] sm:text-[32px]">
        {t("academy.exam.pageTitle", { n: p.order, title: p.title })}
      </h1>
      <p className="mt-2 text-[14px] text-fg-2">
        {/* an elective is a single product track, so its exam doesn't span "both tracks" */}
        {t(isElective(p) ? "academy.exam.introOneTrack" : "academy.exam.intro", { count: total, pass: data.exam.pass_mark })}
      </p>

      {!data.unlocked ? (
        <Card className="mt-6 p-6" data-testid="exam-locked">
          <div className="flex items-start gap-4">
            <span className="grid size-11 shrink-0 place-items-center rounded-full border border-line bg-surface-2 text-fg-3">
              <Lock className="size-5" />
            </span>
            <div className="flex-1">
              <h2 className="text-[17px] font-medium">{t("academy.exam.lockedTitle")}</h2>
              <p className="mt-1 text-[13.5px] text-fg-3">
                {t("academy.exam.lockedBody", { done: data.chapters_done, total: data.chapters_total })}
              </p>
              <Progress value={pct(data.chapters_done, data.chapters_total)} className="mt-4 max-w-sm" />
              <Link href={`/academy/phase/${p.slug}`} className="mt-5 inline-block">
                <Button variant="ember">{t("academy.exam.backToChapters")}</Button>
              </Link>
            </div>
          </div>
        </Card>
      ) : (
        <>
          {result && (
            <Card className={cn("mt-6 p-6", result.passed ? "border-up/30" : "border-warn/30")} data-testid="exam-result">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <span className={cn("grid size-14 place-items-center rounded-full border", result.passed ? "border-up/30 bg-up-soft text-up" : "border-warn/30 bg-warn-soft text-warn")}>
                    {result.passed ? <Award className="size-6" /> : <GraduationCap className="size-6" />}
                  </span>
                  <div>
                    <div className="k-num text-[28px] font-semibold leading-none">{result.pct}%</div>
                    <div className="mt-1 text-[13px] text-fg-2">
                      {t("academy.exam.resultLine", { score: result.score, total: result.total })} · {result.passed ? t("academy.exam.passed") : t("academy.exam.passMarkPct", { pct: result.pass_mark })}
                    </div>
                  </div>
                </div>
                <Button variant="surface" onClick={retake}>
                  <RotateCcw /> {t("academy.exam.retake")}
                </Button>
              </div>
              {result.certificate ? (
                <div className="mt-5 flex flex-col gap-4 rounded-[16px] border border-line bg-surface-2 p-4 sm:flex-row sm:items-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/api/academy/certificates/${result.certificate.code}/image`} alt={t("academy.cert.title")} className="aspect-[1600/1131] w-full rounded-[10px] border border-line bg-[#0b0b0e] sm:w-56" />
                  <div className="flex-1">
                    <div className="text-[15px] font-medium">{t("academy.cert.yours", { n: p.order })}</div>
                    <div className="k-num mt-0.5 text-[12.5px] text-fg-3">
                      {t("academy.cert.codeIssued", { code: result.certificate.code, date: fmtDay(result.certificate.issued_at) })}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <a href={`/api/academy/certificates/${result.certificate.code}/image?download=1`}>
                        <Button size="sm" variant="surface">
                          <Download /> {t("common.download")}
                        </Button>
                      </a>
                      <Link href={`/certificate/${result.certificate.code}`} target="_blank">
                        <Button size="sm" variant="ghost">
                          <ShieldCheck /> {t("academy.cert.verifyPage")}
                        </Button>
                      </Link>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="mt-4 text-[13px] text-fg-3">{t("academy.exam.reviewText")}</p>
              )}
            </Card>
          )}

          <div className="mt-6 space-y-4">
            {data.exam.questions.map((q, qi) => {
              const r = byIndex[qi];
              return (
                <Card key={qi} className="p-5" data-testid={`exam-q-${qi}`}>
                  <div className="mb-3 flex gap-2 text-[14.5px] font-medium leading-snug">
                    <span className="k-num text-fg-3">{qi + 1}.</span>
                    <span>{q.question}</span>
                  </div>
                  <div className="grid gap-2">
                    {q.options.map((o, oi) => {
                      const state = r ? (oi === r.choice ? (r.correct ? "correct" : "wrong") : oi === r.answer ? "reveal" : "idle") : answers[qi] === oi ? "chosen" : "idle";
                      return (
                        <OptionButton
                          key={oi}
                          letter={LETTERS[oi]!}
                          label={o}
                          state={state}
                          disabled={!!result}
                          testId={`exam-q-${qi}-o-${oi}`}
                          onClick={() => setAnswers((a) => a.map((x, i) => (i === qi ? oi : x)))}
                        />
                      );
                    })}
                  </div>
                  {r && <div className={cn("mt-2.5 rounded-[12px] border px-3.5 py-2.5 text-[13px] leading-relaxed text-fg-2", r.correct ? "border-up/25 bg-up-soft" : "border-down/25 bg-down-soft")}>{r.explanation}</div>}
                </Card>
              );
            })}
          </div>

          {!result && (
            <div className="sticky bottom-4 mt-6 flex items-center justify-between gap-3 rounded-[18px] border border-line bg-surface/95 p-3 ps-5 shadow-lg backdrop-blur">
              <span className="k-num text-[13px] text-fg-2">
                {t("academy.answered", { answered, total })}
              </span>
              <Button variant="ember" disabled={answered < total || busy} onClick={submit} data-testid="exam-submit">
                <GraduationCap /> {busy ? t("academy.exam.submitting") : t("academy.exam.submit")}
              </Button>
            </div>
          )}
          {data.attempts.length > 0 && !result && (
            <p className="k-num mt-4 text-[12px] text-fg-3">
              {t("academy.exam.previousAttempts", { list: data.attempts.map((a) => (a.passed ? t("academy.exam.attemptPassed", { pct: a.pct }) : `${a.pct}%`)).join(" · ") })}
            </p>
          )}
        </>
      )}
      <p className="mt-8 text-[11.5px] leading-relaxed text-fg-3">{t(RISK_NOTE)}</p>
    </div>
  );
}
