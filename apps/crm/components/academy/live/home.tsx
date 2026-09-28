"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Award, BookOpen, CheckCircle2, Clock, Flame, GraduationCap, Library, PlayCircle, Search, Target } from "lucide-react";
import { Button, Card, CardHeader, Chip, PageHeader, Progress, Reveal, cn } from "@kalks/ui";
import { LEVEL_TONE, coverOf, fmtDay, fmtMin, pct, useAcademy, type Catalog, type PhaseT } from "./api";
import { AcademyUnavailable, PageSkeleton, PracticeButton, RISK_NOTE, Segments } from "./shared";

function ContinueHero({ cat }: { cat: Catalog }) {
  const c = cat.me.continue;
  const phase = c ? cat.phases.find((p) => p.slug === c.phase.slug) : cat.phases[0];
  if (!phase) return null;
  const allDone = !c;
  return (
    <Card className="relative h-full overflow-hidden">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={coverOf(phase.order)} alt="" className="absolute inset-0 size-full object-cover opacity-45" />
      <div className="absolute inset-0 bg-gradient-to-r from-bg via-bg/90 to-bg/30" />
      <div className="relative flex h-full flex-col p-6 sm:p-7">
        <div className="flex flex-wrap items-center gap-2">
          <Chip tone="ember" dot>
            {allDone ? "All chapters complete" : c!.started ? "Continue learning" : cat.me.chapters_done ? "Up next" : "Start here"}
          </Chip>
          <Chip tone={LEVEL_TONE[phase.level]}>{phase.level}</Chip>
          <Chip>Phase {phase.order}</Chip>
        </div>
        <h2 className="mt-4 max-w-xl text-[26px] font-medium leading-tight tracking-[-0.02em] sm:text-[32px]">{allDone ? "You've completed every chapter" : c!.title}</h2>
        <p className="mt-1.5 max-w-lg text-[13.5px] text-fg-2">
          {allDone ? (
            "Review any chapter, sit the phase exams you haven't passed yet and download your certificates."
          ) : (
            <>
              {phase.title} · <span className="k-num">{fmtMin(c!.minutes)} read</span>
              {c!.read_pct > 0 && <span className="k-num"> · {c!.read_pct}% read</span>}
            </>
          )}
        </p>
        <div className="mt-6 max-w-md">
          <div className="mb-2 flex items-center justify-between text-[12px] text-fg-3">
            <span className="k-num">
              Phase {phase.order}: {phase.progress.done} of {phase.progress.total} chapters
            </span>
            <span className="k-num font-medium text-fg">{pct(phase.progress.done, phase.progress.total)}%</span>
          </div>
          <Segments done={phase.progress.done} total={phase.progress.total} />
        </div>
        <div className="mt-auto flex flex-wrap items-center gap-3 pt-7">
          {allDone ? (
            <Link href="/academy/progress">
              <Button variant="ember" size="lg">
                <Award /> My certificates
              </Button>
            </Link>
          ) : (
            <Link href={`/academy/chapter/${c!.slug}`}>
              <Button variant="ember" size="lg">
                <PlayCircle /> {c!.started ? "Resume chapter" : "Start chapter"}
              </Button>
            </Link>
          )}
          <Link href={`/academy/phase/${phase.slug}`}>
            <Button variant="surface" size="lg">
              Phase overview
            </Button>
          </Link>
        </div>
      </div>
    </Card>
  );
}

function StatsCard({ cat }: { cat: Catalog }) {
  const me = cat.me;
  const days = new Set(me.active_days);
  const week = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(Date.now() - (6 - i) * 86400000);
    return { key: d.toISOString().slice(0, 10), label: d.toLocaleDateString("en-GB", { weekday: "narrow" }) };
  });
  return (
    <Card className="flex h-full flex-col p-6">
      <div className="flex items-start justify-between">
        <div>
          <div className="k-label">Learning streak</div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="k-num text-[44px] font-semibold leading-none tracking-tight">{me.streak}</span>
            <span className="text-fg-2">{me.streak === 1 ? "day" : "days"}</span>
          </div>
        </div>
        <span className="grid size-11 place-items-center rounded-full border border-ember/30 bg-ember-soft text-ember">
          <Flame className="size-5" />
        </span>
      </div>
      <div className="mt-4 flex gap-1.5">
        {week.map((d) => (
          <div key={d.key} className="flex flex-1 flex-col items-center gap-1">
            <span className={cn("grid size-7 place-items-center rounded-full border text-[10px]", days.has(d.key) ? "border-ember/40 bg-ember text-white" : "border-line bg-surface-2 text-fg-3")}>
              {days.has(d.key) ? <Flame className="size-3.5" /> : null}
            </span>
            <span className="text-[10px] text-fg-3">{d.label}</span>
          </div>
        ))}
      </div>
      <div className="mt-5">
        <div className="mb-1.5 flex items-center justify-between text-[12px]">
          <span className="text-fg-3">Course progress</span>
          <span className="k-num text-fg">
            {me.chapters_done} / {me.chapters_total} chapters
          </span>
        </div>
        <Progress value={pct(me.chapters_done, me.chapters_total)} />
      </div>
      <div className="mt-auto grid grid-cols-3 gap-2 pt-5">
        {(
          [
            [<Award key="a" className="size-3.5" />, String(me.certificates), me.certificates === 1 ? "Certificate" : "Certificates"],
            [<Target key="t" className="size-3.5" />, me.quiz_avg === null ? "–" : `${me.quiz_avg}%`, "Quiz average"],
            [<Clock key="c" className="size-3.5" />, fmtMin(me.minutes_done), "Studied"],
          ] as const
        ).map(([ic, v, l], i) => (
          <div key={i} className="rounded-[14px] border border-line bg-surface-2 px-3 py-2.5">
            <div className="text-fg-3">{ic}</div>
            <div className="k-num mt-1 text-[15px] font-semibold">{v}</div>
            <div className="text-[10.5px] text-fg-3">{l}</div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function phaseState(p: PhaseT): { label: string; tone: "up" | "ember" | "neutral" | "gold" } {
  if (p.certificate) return { label: "Certified", tone: "up" };
  if (p.progress.done === p.progress.total && p.progress.total > 0) return { label: "Exam ready", tone: "gold" };
  if (p.progress.done > 0) return { label: "In progress", tone: "ember" };
  return { label: "Not started", tone: "neutral" };
}

function PhaseCard({ p }: { p: PhaseT }) {
  const s = phaseState(p);
  const count = (t: string) => p.sections.find((x) => x.track === t)?.chapters.length ?? 0;
  const done = p.progress.done === p.progress.total && p.progress.total > 0;
  return (
    <Link href={`/academy/phase/${p.slug}`} className="group block h-full" data-testid={`phase-card-${p.slug}`}>
      <Card className="flex h-full flex-col overflow-hidden transition-colors group-hover:border-[var(--k-border-top)]">
        <div className="relative h-36 overflow-hidden rounded-t-[20px]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={coverOf(p.order)} alt="" className="size-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-surface via-surface/30 to-transparent" />
          <div className="absolute left-3.5 top-3.5 flex gap-1.5">
            <Chip size="sm" tone={LEVEL_TONE[p.level]} className="bg-black/60">
              {p.level}
            </Chip>
          </div>
          <div className="absolute right-3.5 top-3.5">
            <Chip size="sm" tone={s.tone} dot className="bg-black/60">
              {s.label}
            </Chip>
          </div>
          <div className="k-num absolute bottom-2 left-4 text-[44px] font-semibold leading-none tracking-tight text-white/90">{String(p.order).padStart(2, "0")}</div>
        </div>
        <div className="flex flex-1 flex-col px-5 pb-5 pt-3">
          <div className="text-[11px] font-medium uppercase tracking-wider text-fg-3">Phase {p.order}</div>
          <div className="mt-0.5 text-[15.5px] font-medium leading-snug tracking-tight">{p.title}</div>
          <p className="mt-1 line-clamp-2 text-[12.5px] text-fg-3">{p.summary}</p>
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-fg-3">
            <span className="inline-flex items-center gap-1">
              <BookOpen className="size-3.5" /> <span className="k-num">{count("fundamental")} fundamental</span>
            </span>
            <span className="inline-flex items-center gap-1">
              <BookOpen className="size-3.5" /> <span className="k-num">{count("technical")} technical</span>
            </span>
            <span className="inline-flex items-center gap-1">
              <Clock className="size-3.5" /> <span className="k-num">{fmtMin(p.minutes)}</span>
            </span>
          </div>
          <div className="mt-auto pt-4">
            <div className="mb-1.5 flex items-center justify-between text-[11.5px]">
              <span className="text-fg-3">{p.certificate ? `Certificate ${fmtDay(p.certificate.issued_at)}` : p.exam ? `Final exam · ${p.exam.questions} questions` : ""}</span>
              <span className={cn("k-num", done ? "text-up" : p.progress.done ? "text-fg-2" : "text-fg-3")}>
                {p.progress.done}/{p.progress.total}
              </span>
            </div>
            <Progress value={pct(p.progress.done, p.progress.total)} tone={done ? "up" : "ember"} />
          </div>
        </div>
      </Card>
    </Link>
  );
}

function GlossaryTeaser() {
  const router = useRouter();
  const [q, setQ] = React.useState("");
  return (
    <Card className="flex h-full flex-col">
      <CardHeader title="Glossary" subtitle="Trading terms in plain language" icon={<Library />} />
      <form
        className="px-6 pt-4"
        onSubmit={(e) => {
          e.preventDefault();
          router.push(`/academy/glossary${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ""}`);
        }}
      >
        <div className="flex h-10 items-center gap-2 rounded-full border border-line bg-surface-2 px-3.5">
          <Search className="size-4 text-fg-3" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search: margin level, swap, RSI…" aria-label="Search the glossary" className="w-full bg-transparent text-[13px] outline-none placeholder:text-fg-3" />
        </div>
      </form>
      <div className="flex flex-wrap gap-1.5 px-6 pb-6 pt-4">
        {["Pip", "Spread", "Leverage", "Margin level", "Stop-out", "Swap", "Support", "RSI", "CPI", "Yield curve", "Drawdown", "Expectancy"].map((t) => (
          <Link key={t} href={`/academy/glossary?q=${encodeURIComponent(t)}`} className="rounded-full border border-line bg-surface-2 px-2.5 py-1 text-[12px] text-fg-2 transition-colors hover:text-fg">
            {t}
          </Link>
        ))}
      </div>
    </Card>
  );
}

function CertificatesCard({ cat }: { cat: Catalog }) {
  const certs = cat.phases.filter((p) => p.certificate);
  const ready = cat.phases.find((p) => !p.certificate && p.exam?.unlocked);
  return (
    <Card className="flex h-full flex-col">
      <CardHeader title="Certificates" subtitle="One per phase: every chapter plus the final exam" icon={<Award />} action={<Link href="/academy/progress" className="text-[12.5px] text-fg-3 hover:text-fg">View all</Link>} />
      <div className="flex-1 space-y-2 px-4 pb-5 pt-4 sm:px-6">
        {certs.slice(0, 3).map((p) => (
          <Link key={p.slug} href="/academy/progress" className="k-row flex items-center gap-3 px-3 py-2.5">
            <span className="grid size-8 place-items-center rounded-full border border-up/30 bg-up-soft text-up">
              <CheckCircle2 className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-medium">
                Phase {p.order} · {p.title}
              </div>
              <div className="k-num text-[11.5px] text-fg-3">
                {p.certificate!.code} · {fmtDay(p.certificate!.issued_at)}
              </div>
            </div>
          </Link>
        ))}
        {ready && (
          <Link href={`/academy/phase/${ready.slug}/exam`} className="k-row flex items-center gap-3 px-3 py-2.5">
            <span className="grid size-8 place-items-center rounded-full border border-gold/30 bg-gold-soft text-gold">
              <GraduationCap className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-medium">Phase {ready.order} exam is ready</div>
              <div className="text-[11.5px] text-fg-3">
                {ready.exam!.questions} questions · pass mark {ready.exam!.pass_mark}%
              </div>
            </div>
            <ArrowRight className="size-4 text-fg-3" />
          </Link>
        )}
        {!certs.length && !ready && <p className="px-1 text-[13px] leading-relaxed text-fg-3">Complete every chapter of a phase, then pass its final exam to earn a certificate you can share with a verification link.</p>}
      </div>
    </Card>
  );
}

function PracticeCard() {
  return (
    <Card className="relative h-full overflow-hidden">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/assets/photos/trader.jpg" alt="" className="absolute inset-0 size-full object-cover opacity-30" />
      <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/85 to-bg/40" />
      <div className="relative flex h-full flex-col p-6">
        <Chip tone="gold" className="self-start">
          Free · no risk
        </Chip>
        <h3 className="mt-3 text-[19px] font-medium tracking-tight">Practise in Kalks Trader</h3>
        <p className="mt-1.5 text-[13px] leading-relaxed text-fg-2">Every chapter ends with an exercise. Try it on a demo account with virtual funds, the same prices and the same order types as live trading.</p>
        <div className="mt-auto pt-5">
          <PracticeButton />
        </div>
      </div>
    </Card>
  );
}

export function LiveAcademyHome() {
  const { data, error, reload } = useAcademy<Catalog>("catalog");
  if (error) return <AcademyUnavailable error={error} onRetry={reload} />;
  if (!data) return <PageSkeleton />;
  const chapters = data.me.chapters_total;
  return (
    <div className="pb-16">
      <PageHeader
        title="Academy"
        subtitle={`Eight phases from your first pip to professional trading · ${chapters} chapters across fundamental and technical analysis, with quizzes, exams and certificates.`}
        actions={
          <>
            <Link href="/academy/glossary">
              <Button variant="surface">
                <Library /> Glossary
              </Button>
            </Link>
            <Link href="/academy/progress">
              <Button variant="ember">
                <Award /> My progress
              </Button>
            </Link>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Reveal className="xl:col-span-8">
          <ContinueHero cat={data} />
        </Reveal>
        <Reveal delay={0.05} className="xl:col-span-4">
          <StatsCard cat={data} />
        </Reveal>
      </div>

      <Reveal delay={0.08} className="mt-8">
        <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-[19px] font-medium tracking-tight">Your learning path</h2>
            <p className="text-[13px] text-fg-3">Each phase has a fundamental and a technical track, a final exam and a certificate.</p>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4" data-testid="phase-grid">
          {data.phases.map((p) => (
            <PhaseCard key={p.slug} p={p} />
          ))}
        </div>
      </Reveal>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Reveal delay={0.05}>
          <GlossaryTeaser />
        </Reveal>
        <Reveal delay={0.1}>
          <CertificatesCard cat={data} />
        </Reveal>
        <Reveal delay={0.15}>
          <PracticeCard />
        </Reveal>
      </div>

      <p className="mt-8 max-w-3xl text-[11.5px] leading-relaxed text-fg-3">{RISK_NOTE}</p>
    </div>
  );
}
