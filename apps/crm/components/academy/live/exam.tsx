"use client";

import * as React from "react";
import Link from "next/link";
import { Award, Download, GraduationCap, Lock, RotateCcw, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button, Card, Chip, Progress, cn } from "@kalks/ui";
import { LEVEL_TONE, academyApi, fmtDay, pct, useAcademy, type ExamReply, type ExamView } from "./api";
import { LETTERS, OptionButton } from "./quiz";
import { AcademyUnavailable, BackLink, PageSkeleton, RISK_NOTE } from "./shared";

export function LiveExam({ phase }: { phase: string }) {
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
      if (r.certificate_issued) toast.success("Certificate issued", { description: `Phase ${p.order} · ${p.title}` });
    } catch (e) {
      toast.error("Couldn't submit the exam", { description: e instanceof Error ? e.message : undefined });
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
        Phase {p.order} · {p.title}
      </BackLink>
      <div className="flex flex-wrap items-center gap-2">
        <Chip tone="ember">Final exam</Chip>
        <Chip tone={LEVEL_TONE[p.level]}>{p.level}</Chip>
      </div>
      <h1 className="mt-3 text-[28px] font-medium leading-tight tracking-[-0.02em] sm:text-[32px]">
        Phase {p.order} exam: {p.title}
      </h1>
      <p className="mt-2 text-[14px] text-fg-2">
        {total} questions across both tracks · pass mark {data.exam.pass_mark}% · take your time, there is no timer.
      </p>

      {!data.unlocked ? (
        <Card className="mt-6 p-6" data-testid="exam-locked">
          <div className="flex items-start gap-4">
            <span className="grid size-11 shrink-0 place-items-center rounded-full border border-line bg-surface-2 text-fg-3">
              <Lock className="size-5" />
            </span>
            <div className="flex-1">
              <h2 className="text-[17px] font-medium">The exam unlocks when every chapter is complete</h2>
              <p className="mt-1 text-[13.5px] text-fg-3">
                You have completed {data.chapters_done} of {data.chapters_total} chapters in this phase. Pass each chapter quiz to complete it.
              </p>
              <Progress value={pct(data.chapters_done, data.chapters_total)} className="mt-4 max-w-sm" />
              <Link href={`/academy/phase/${p.slug}`} className="mt-5 inline-block">
                <Button variant="ember">Back to the chapters</Button>
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
                      {result.score} of {result.total} correct · {result.passed ? "Passed" : `Pass mark ${result.pass_mark}%`}
                    </div>
                  </div>
                </div>
                <Button variant="surface" onClick={retake}>
                  <RotateCcw /> Retake exam
                </Button>
              </div>
              {result.certificate ? (
                <div className="mt-5 flex flex-col gap-4 rounded-[16px] border border-line bg-surface-2 p-4 sm:flex-row sm:items-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/api/academy/certificates/${result.certificate.code}/image`} alt="Certificate" className="aspect-[1600/1131] w-full rounded-[10px] border border-line bg-[#0b0b0e] sm:w-56" />
                  <div className="flex-1">
                    <div className="text-[15px] font-medium">Your Phase {p.order} certificate</div>
                    <div className="k-num mt-0.5 text-[12.5px] text-fg-3">
                      {result.certificate.code} · issued {fmtDay(result.certificate.issued_at)}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <a href={`/api/academy/certificates/${result.certificate.code}/image?download=1`}>
                        <Button size="sm" variant="surface">
                          <Download /> Download
                        </Button>
                      </a>
                      <Link href={`/certificate/${result.certificate.code}`} target="_blank">
                        <Button size="sm" variant="ghost">
                          <ShieldCheck /> Verify page
                        </Button>
                      </Link>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="mt-4 text-[13px] text-fg-3">Review the explanations below, revisit the chapters they come from, then try again.</p>
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
            <div className="sticky bottom-4 mt-6 flex items-center justify-between gap-3 rounded-[18px] border border-line bg-surface/95 p-3 pl-5 shadow-lg backdrop-blur">
              <span className="k-num text-[13px] text-fg-2">
                {answered} of {total} answered
              </span>
              <Button variant="ember" disabled={answered < total || busy} onClick={submit} data-testid="exam-submit">
                <GraduationCap /> {busy ? "Submitting…" : "Submit exam"}
              </Button>
            </div>
          )}
          {data.attempts.length > 0 && !result && (
            <p className="k-num mt-4 text-[12px] text-fg-3">
              Previous attempts: {data.attempts.map((a) => `${a.pct}%${a.passed ? " (passed)" : ""}`).join(" · ")}
            </p>
          )}
        </>
      )}
      <p className="mt-8 text-[11.5px] leading-relaxed text-fg-3">{RISK_NOTE}</p>
    </div>
  );
}
