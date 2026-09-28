"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, Award, BarChart3, Clock, Download, GraduationCap, Landmark, Lock, PlayCircle, ShieldCheck } from "lucide-react";
import { Button, Card, Chip, Progress, Reveal, Segmented, cn } from "@kalks/ui";
import { LEVEL_TONE, TRACK_LABEL, coverOf, fmtDay, fmtMin, pct, useAcademy, type Catalog, type PhaseT, type SectionT, type Track } from "./api";
import { AcademyUnavailable, BackLink, PageSkeleton, RISK_NOTE, StatusDot } from "./shared";

function SectionCard({ s, phase }: { s: SectionT; phase: PhaseT }) {
  const done = s.chapters.filter((c) => c.progress.completed).length;
  const firstOpen = s.chapters.findIndex((c) => !c.progress.completed);
  return (
    <Card className="h-full" data-testid={`section-${s.track}`}>
      <div className="flex items-start gap-3 px-6 pt-5">
        <span className={cn("grid size-10 shrink-0 place-items-center rounded-full border", s.track === "fundamental" ? "border-info/25 bg-info-soft text-info" : "border-ember/30 bg-ember-soft text-ember")}>
          {s.track === "fundamental" ? <Landmark className="size-4" /> : <BarChart3 className="size-4" />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-medium uppercase tracking-wider text-fg-3">{TRACK_LABEL[s.track]}</div>
          <h3 className="text-[17px] font-medium tracking-tight">{s.title}</h3>
          <p className="mt-0.5 text-[13px] text-fg-3">{s.summary}</p>
        </div>
        <span className="k-num shrink-0 text-[12.5px] text-fg-2">
          {done}/{s.chapters.length}
        </span>
      </div>
      <div className="px-6 pt-3">
        <Progress value={pct(done, s.chapters.length)} tone={done === s.chapters.length ? "up" : "ember"} />
      </div>
      <ol className="space-y-1.5 px-3 pb-4 pt-4 sm:px-4">
        {s.chapters.map((c, i) => {
          const q = c.progress.quiz_total ? `${c.progress.quiz_best}/${c.progress.quiz_total}` : null;
          return (
            <li key={c.slug}>
              <Link href={`/academy/chapter/${c.slug}`} className={cn("k-row flex items-start gap-3 px-3 py-3", i === firstOpen && "border-ember/30")} data-testid={`chapter-link-${c.slug}`}>
                <StatusDot state={c.progress.completed ? "done" : "open"} n={i + 1} />
                <div className="min-w-0 flex-1">
                  <div className="text-[13.5px] font-medium leading-snug">{c.title}</div>
                  <div className="mt-0.5 line-clamp-2 text-[12px] text-fg-3">{c.summary}</div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1 text-[11px] text-fg-3">
                  <span className="k-num inline-flex items-center gap-1">
                    <Clock className="size-3" /> {c.minutes} min
                  </span>
                  {c.progress.completed ? (
                    <Chip size="sm" tone="up">
                      Quiz {q}
                    </Chip>
                  ) : c.progress.read_pct > 0 ? (
                    <span className="k-num text-fg-2">{c.progress.read_pct}% read</span>
                  ) : null}
                </div>
              </Link>
            </li>
          );
        })}
      </ol>
      <div className="sr-only">{phase.title}</div>
    </Card>
  );
}

function ExamCard({ p }: { p: PhaseT }) {
  const e = p.exam;
  if (!e) return null;
  const left = p.progress.total - p.progress.done;
  return (
    <Card className="flex h-full flex-col p-6" data-testid="exam-card">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="k-label">Final exam</div>
          <h3 className="mt-1 text-[18px] font-medium tracking-tight">Phase {p.order} exam</h3>
        </div>
        <span className={cn("grid size-11 place-items-center rounded-full border", e.unlocked ? "border-gold/30 bg-gold-soft text-gold" : "border-line bg-surface-2 text-fg-3")}>
          {e.unlocked ? <GraduationCap className="size-5" /> : <Lock className="size-5" />}
        </span>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2">
        {(
          [
            [String(e.questions), "Questions"],
            [`${e.pass_mark}%`, "Pass mark"],
            [e.best_pct === null ? "–" : `${e.best_pct}%`, "Best score"],
          ] as const
        ).map(([v, l]) => (
          <div key={l} className="rounded-[14px] border border-line bg-surface-2 px-3 py-2.5">
            <div className="k-num text-[15px] font-semibold">{v}</div>
            <div className="text-[10.5px] text-fg-3">{l}</div>
          </div>
        ))}
      </div>
      <p className="mt-4 text-[13px] leading-relaxed text-fg-3">
        {e.passed
          ? "You passed this exam. You can retake it to practise; your certificate stays valid."
          : e.unlocked
            ? "Questions cover both tracks. Pass it to earn your certificate for this phase."
            : `Unlocks when every chapter of this phase is complete: ${left} ${left === 1 ? "chapter" : "chapters"} to go.`}
      </p>
      <div className="mt-auto pt-5">
        {e.unlocked ? (
          <Link href={`/academy/phase/${p.slug}/exam`}>
            <Button variant={e.passed ? "surface" : "ember"}>
              <GraduationCap /> {e.passed ? "Retake exam" : e.attempts ? "Try again" : "Start exam"}
            </Button>
          </Link>
        ) : (
          <Button variant="surface" disabled>
            <Lock /> Locked
          </Button>
        )}
      </div>
    </Card>
  );
}

function CertificateCard({ p }: { p: PhaseT }) {
  const c = p.certificate;
  if (!c) {
    return (
      <Card className="flex h-full flex-col p-6">
        <div className="k-label">Certificate</div>
        <div className="mt-4 grid flex-1 place-items-center rounded-[16px] border border-dashed border-line bg-surface-2/50 p-6 text-center">
          <div>
            <Award className="mx-auto size-7 text-fg-3" />
            <p className="mt-2 max-w-[240px] text-[12.5px] text-fg-3">Your Phase {p.order} certificate appears here once you pass the final exam.</p>
          </div>
        </div>
      </Card>
    );
  }
  const img = `/api/academy/certificates/${c.code}/image`;
  return (
    <Card className="flex h-full flex-col p-6" data-testid="certificate-card">
      <div className="flex items-center justify-between">
        <div className="k-label">Certificate</div>
        <Chip tone="up" dot>
          Issued {fmtDay(c.issued_at)}
        </Chip>
      </div>
      <a href={img} target="_blank" rel="noopener" className="mt-4 block overflow-hidden rounded-[12px] border border-line">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={img} alt={`Phase ${p.order} certificate`} className="block aspect-[1600/1131] w-full bg-[#0b0b0e]" />
      </a>
      <div className="mt-4 flex flex-wrap gap-2">
        <a href={`${img}?download=1`}>
          <Button size="sm" variant="surface">
            <Download /> Download
          </Button>
        </a>
        <Link href={`/certificate/${c.code}`} target="_blank">
          <Button size="sm" variant="ghost">
            <ShieldCheck /> Verify page
          </Button>
        </Link>
      </div>
    </Card>
  );
}

export function LivePhase({ slug }: { slug: string }) {
  const { data, error, reload } = useAcademy<Catalog>("catalog");
  const [track, setTrack] = React.useState<"all" | Track>("all");
  if (error) return <AcademyUnavailable error={error} onRetry={reload} />;
  if (!data) return <PageSkeleton />;
  const p = data.phases.find((x) => x.slug === slug);
  if (!p) return <AcademyUnavailable error={null} notFound onRetry={reload} />;
  const next = p.sections.flatMap((s) => s.chapters).find((c) => !c.progress.completed);
  const prev = data.phases.find((x) => x.order === p.order - 1);
  const nextPhase = data.phases.find((x) => x.order === p.order + 1);
  const sections = p.sections.filter((s) => track === "all" || s.track === track);
  return (
    <div className="pb-16">
      <BackLink href="/academy">Academy</BackLink>
      <Reveal>
        <Card className="relative overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={coverOf(p.order)} alt="" className="absolute inset-0 size-full object-cover opacity-40" />
          <div className="absolute inset-0 bg-gradient-to-r from-bg via-bg/90 to-bg/40" />
          <div className="relative flex flex-col gap-6 p-6 sm:p-8 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <div className="flex flex-wrap items-center gap-2">
                <Chip tone="ember">Phase {p.order} of {data.phases.length}</Chip>
                <Chip tone={LEVEL_TONE[p.level]}>{p.level}</Chip>
                {p.certificate && (
                  <Chip tone="up" dot>
                    Certified
                  </Chip>
                )}
              </div>
              <h1 className="mt-4 text-[28px] font-medium leading-tight tracking-[-0.02em] sm:text-[34px]">{p.title}</h1>
              <p className="mt-2 text-[14px] leading-relaxed text-fg-2">{p.summary}</p>
              <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-[12.5px] text-fg-3">
                <span className="k-num">{p.progress.total} chapters</span>
                <span className="k-num">{fmtMin(p.minutes)} reading</span>
                {p.exam && <span className="k-num">Final exam · {p.exam.questions} questions</span>}
              </div>
            </div>
            <div className="w-full max-w-sm">
              <div className="mb-2 flex items-center justify-between text-[12px] text-fg-3">
                <span className="k-num">
                  {p.progress.done} of {p.progress.total} complete
                </span>
                <span className="k-num font-medium text-fg">{pct(p.progress.done, p.progress.total)}%</span>
              </div>
              <Progress value={pct(p.progress.done, p.progress.total)} tone={p.progress.done === p.progress.total ? "up" : "ember"} />
              <div className="mt-4 flex flex-wrap gap-2">
                {next ? (
                  <Link href={`/academy/chapter/${next.slug}`}>
                    <Button variant="ember">
                      <PlayCircle /> {p.progress.done ? "Continue" : "Start phase"}
                    </Button>
                  </Link>
                ) : p.exam && !p.exam.passed ? (
                  <Link href={`/academy/phase/${p.slug}/exam`}>
                    <Button variant="ember">
                      <GraduationCap /> Take the final exam
                    </Button>
                  </Link>
                ) : nextPhase ? (
                  <Link href={`/academy/phase/${nextPhase.slug}`}>
                    <Button variant="ember">
                      Next phase <ArrowRight />
                    </Button>
                  </Link>
                ) : null}
              </div>
            </div>
          </div>
        </Card>
      </Reveal>

      <div className="mb-4 mt-8 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-[19px] font-medium tracking-tight">Chapters</h2>
          <p className="text-[13px] text-fg-3">Each chapter ends with a short quiz; pass it to complete the chapter.</p>
        </div>
        <Segmented
          size="xs"
          value={track}
          onChange={setTrack}
          options={[
            { value: "all", label: "Both tracks" },
            { value: "fundamental", label: "Fundamental" },
            { value: "technical", label: "Technical" },
          ]}
        />
      </div>
      <div className={cn("grid grid-cols-1 gap-4", sections.length > 1 && "xl:grid-cols-2")}>
        {sections.map((s, i) => (
          <Reveal key={s.slug} delay={0.04 * i}>
            <SectionCard s={s} phase={p} />
          </Reveal>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Reveal delay={0.05}>
          <ExamCard p={p} />
        </Reveal>
        <Reveal delay={0.1}>
          <CertificateCard p={p} />
        </Reveal>
      </div>

      <div className="mt-6 flex flex-wrap justify-between gap-3">
        {prev ? (
          <Link href={`/academy/phase/${prev.slug}`} className="text-[13px] text-fg-3 hover:text-fg">
            ← Phase {prev.order}: {prev.title}
          </Link>
        ) : (
          <span />
        )}
        {nextPhase && (
          <Link href={`/academy/phase/${nextPhase.slug}`} className="text-[13px] text-fg-3 hover:text-fg">
            Phase {nextPhase.order}: {nextPhase.title} →
          </Link>
        )}
      </div>
      <p className="mt-8 max-w-3xl text-[11.5px] leading-relaxed text-fg-3">{RISK_NOTE}</p>
    </div>
  );
}
