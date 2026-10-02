"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Award, BookOpen, CheckCircle2, Clock, Flame, GraduationCap, Library, PlayCircle, Search, Target } from "lucide-react";
import { Button, Card, CardHeader, Chip, PageHeader, Progress, Reveal, cn } from "@kalks/ui";
import type { T } from "@kalks/i18n";
import { useFormat, useT } from "@kalks/i18n/react";
import { LEVEL_TONE, coverOf, fmtDay, fmtMin, isElective, levelLabel, pct, trackCount, trackTallies, useAcademy, type Catalog, type PhaseT } from "./api";
import { AcademyUnavailable, PageSkeleton, PracticeButton, RISK_NOTE, Segments } from "./shared";

function ContinueHero({ cat }: { cat: Catalog }) {
  const t = useT();
  const c = cat.me.continue;
  const phase = c ? cat.phases.find((p) => p.slug === c.phase.slug) : cat.phases[0];
  if (!phase) return null;
  const allDone = !c;
  return (
    <Card className="relative h-full overflow-hidden">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={coverOf(phase.order)} alt="" className="absolute inset-0 size-full object-cover opacity-45" />
      <div className="absolute inset-0 bg-gradient-to-r from-bg rtl:bg-gradient-to-l via-bg/90 to-bg/30" />
      <div className="relative flex h-full flex-col p-6 sm:p-7">
        <div className="flex flex-wrap items-center gap-2">
          <Chip tone="ember" dot>
            {allDone ? t("academy.hero.allDone") : c!.started ? t("academy.hero.continue") : cat.me.chapters_done ? t("academy.hero.upNext") : t("academy.hero.startHere")}
          </Chip>
          <Chip tone={LEVEL_TONE[phase.level]}>{levelLabel(phase.level)}</Chip>
          <Chip>{t("academy.phaseN", { n: phase.order })}</Chip>
        </div>
        <h2 className="mt-4 max-w-xl text-[26px] font-medium leading-tight tracking-[-0.02em] sm:text-[32px]">{allDone ? t("academy.hero.allDoneTitle") : c!.title}</h2>
        <p className="mt-1.5 max-w-lg text-[13.5px] text-fg-2">
          {allDone ? (
            t("academy.hero.allDoneText")
          ) : (
            <>
              {phase.title} · <span className="k-num">{t("academy.hero.minRead", { time: fmtMin(c!.minutes) })}</span>
              {c!.read_pct > 0 && <span className="k-num"> · {t("academy.readPct", { pct: c!.read_pct })}</span>}
            </>
          )}
        </p>
        <div className="mt-6 max-w-md">
          <div className="mb-2 flex items-center justify-between text-[12px] text-fg-3">
            <span className="k-num">
              {t("academy.hero.phaseProgress", { n: phase.order, done: phase.progress.done, total: phase.progress.total })}
            </span>
            <span className="k-num font-medium text-fg">{pct(phase.progress.done, phase.progress.total)}%</span>
          </div>
          <Segments done={phase.progress.done} total={phase.progress.total} />
        </div>
        <div className="mt-auto flex flex-wrap items-center gap-3 pt-7">
          {allDone ? (
            <Link href="/academy/progress">
              <Button variant="ember" size="lg">
                <Award /> {t("academy.hero.myCertificates")}
              </Button>
            </Link>
          ) : (
            <Link href={`/academy/chapter/${c!.slug}`}>
              <Button variant="ember" size="lg">
                <PlayCircle /> {c!.started ? t("academy.hero.resume") : t("academy.hero.start")}
              </Button>
            </Link>
          )}
          <Link href={`/academy/phase/${phase.slug}`}>
            <Button variant="surface" size="lg">
              {t("academy.hero.overview")}
            </Button>
          </Link>
        </div>
      </div>
    </Card>
  );
}

function StatsCard({ cat }: { cat: Catalog }) {
  const t = useT();
  const f = useFormat();
  const me = cat.me;
  const days = new Set(me.active_days);
  const week = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(Date.now() - (6 - i) * 86400000);
    return { key: d.toISOString().slice(0, 10), label: f.date(d, { weekday: "narrow", timeZone: undefined }) };
  });
  return (
    <Card className="flex h-full flex-col p-6">
      <div className="flex items-start justify-between">
        <div>
          <div className="k-label">{t("academy.stats.streak")}</div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="k-num text-[44px] font-semibold leading-none tracking-tight">{me.streak}</span>
            <span className="text-fg-2">{t("academy.stats.days", { count: me.streak })}</span>
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
          <span className="text-fg-3">{t("academy.stats.courseProgress")}</span>
          <span className="k-num text-fg">
            {t("academy.stats.chapters", { done: me.chapters_done, total: me.chapters_total })}
          </span>
        </div>
        <Progress value={pct(me.chapters_done, me.chapters_total)} />
      </div>
      <div className="mt-auto grid grid-cols-3 gap-2 pt-5">
        {(
          [
            [<Award key="a" className="size-3.5" />, String(me.certificates), t("academy.stats.certificates", { count: me.certificates })],
            [<Target key="t" className="size-3.5" />, me.quiz_avg === null ? "–" : `${me.quiz_avg}%`, t("academy.stats.quizAvg")],
            [<Clock key="c" className="size-3.5" />, fmtMin(me.minutes_done), t("academy.stats.studied")],
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

function phaseState(p: PhaseT, t: T): { label: string; tone: "up" | "ember" | "neutral" | "gold" } {
  if (p.certificate) return { label: t("academy.state.certified"), tone: "up" };
  if (p.progress.done === p.progress.total && p.progress.total > 0) return { label: t("academy.state.examReady"), tone: "gold" };
  if (p.progress.done > 0) return { label: t("academy.state.inProgress"), tone: "ember" };
  return { label: t("academy.state.notStarted"), tone: "neutral" };
}

function PhaseCard({ p }: { p: PhaseT }) {
  const t = useT();
  const s = phaseState(p, t);
  const tracks = trackTallies(p.sections);
  const done = p.progress.done === p.progress.total && p.progress.total > 0;
  return (
    <Link href={`/academy/phase/${p.slug}`} className="group block h-full" data-testid={`phase-card-${p.slug}`}>
      <Card className="flex h-full flex-col overflow-hidden transition-colors group-hover:border-[var(--k-border-top)]">
        <div className="relative h-36 overflow-hidden rounded-t-[20px]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={coverOf(p.order)} alt="" className="size-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-surface via-surface/30 to-transparent" />
          <div className="absolute start-3.5 top-3.5 flex gap-1.5">
            <Chip size="sm" tone={LEVEL_TONE[p.level]} className="bg-black/60">
              {levelLabel(p.level)}
            </Chip>
            {isElective(p) && (
              <Chip size="sm" className="bg-black/60">
                {t("academy.elective")}
              </Chip>
            )}
          </div>
          <div className="absolute end-3.5 top-3.5">
            <Chip size="sm" tone={s.tone} dot className="bg-black/60">
              {s.label}
            </Chip>
          </div>
          <div className="k-num absolute bottom-2 start-4 text-[44px] font-semibold leading-none tracking-tight text-white/90">{String(p.order).padStart(2, "0")}</div>
        </div>
        <div className="flex flex-1 flex-col px-5 pb-5 pt-3">
          <div className="text-[11px] font-medium uppercase tracking-wider text-fg-3">{t("academy.phaseN", { n: p.order })}</div>
          <div className="mt-0.5 text-[15.5px] font-medium leading-snug tracking-tight">{p.title}</div>
          <p className="mt-1 line-clamp-2 text-[12.5px] text-fg-3">{p.summary}</p>
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-fg-3">
            {tracks.map((x) => (
              <span key={x.track} className="inline-flex items-center gap-1">
                <BookOpen className="size-3.5" /> <span className="k-num">{trackCount(t, x.track, x.total)}</span>
              </span>
            ))}
            <span className="inline-flex items-center gap-1">
              <Clock className="size-3.5" /> <span className="k-num">{fmtMin(p.minutes)}</span>
            </span>
          </div>
          <div className="mt-auto pt-4">
            <div className="mb-1.5 flex items-center justify-between text-[11.5px]">
              <span className="text-fg-3">{p.certificate ? t("academy.phaseCard.certificate", { date: fmtDay(p.certificate.issued_at) }) : p.exam ? t("academy.phaseCard.finalExam", { count: p.exam.questions }) : ""}</span>
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
  const t = useT();
  const router = useRouter();
  const [q, setQ] = React.useState("");
  return (
    <Card className="flex h-full flex-col">
      <CardHeader title={t("academy.home.glossary")} subtitle={t("academy.glossaryTeaser.subtitle")} icon={<Library />} />
      <form
        className="px-6 pt-4"
        onSubmit={(e) => {
          e.preventDefault();
          router.push(`/academy/glossary${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ""}`);
        }}
      >
        <div className="flex h-10 items-center gap-2 rounded-full border border-line bg-surface-2 px-3.5">
          <Search className="size-4 text-fg-3" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("academy.glossaryTeaser.placeholder")} aria-label={t("academy.glossaryTeaser.aria")} className="w-full bg-transparent text-[13px] outline-none placeholder:text-fg-3" />
        </div>
      </form>
      <div className="flex flex-wrap gap-1.5 px-6 pb-6 pt-4">
        {["Pip", "Spread", "Leverage", "Margin level", "Stop-out", "Swap", "Support", "RSI", "CPI", "Yield curve", "Drawdown", "Expectancy"].map((term) => (
          <Link key={term} href={`/academy/glossary?q=${encodeURIComponent(term)}`} className="rounded-full border border-line bg-surface-2 px-2.5 py-1 text-[12px] text-fg-2 transition-colors hover:text-fg">
            {term}
          </Link>
        ))}
      </div>
    </Card>
  );
}

function CertificatesCard({ cat }: { cat: Catalog }) {
  const t = useT();
  const certs = cat.phases.filter((p) => p.certificate);
  const ready = cat.phases.find((p) => !p.certificate && p.exam?.unlocked);
  return (
    <Card className="flex h-full flex-col">
      <CardHeader title={t("academy.certs.title")} subtitle={t("academy.certs.subtitle")} icon={<Award />} action={<Link href="/academy/progress" className="text-[12.5px] text-fg-3 hover:text-fg">{t("common.viewAll")}</Link>} />
      <div className="flex-1 space-y-2 px-4 pb-5 pt-4 sm:px-6">
        {certs.slice(0, 3).map((p) => (
          <Link key={p.slug} href="/academy/progress" className="k-row flex items-center gap-3 px-3 py-2.5">
            <span className="grid size-8 place-items-center rounded-full border border-up/30 bg-up-soft text-up">
              <CheckCircle2 className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-medium">
                {t("academy.phaseTitle", { n: p.order, title: p.title })}
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
              <div className="truncate text-[13px] font-medium">{t("academy.certs.examReady", { n: ready.order })}</div>
              <div className="text-[11.5px] text-fg-3">
                {t("academy.certs.examMeta", { count: ready.exam!.questions, pass: ready.exam!.pass_mark })}
              </div>
            </div>
            <ArrowRight className="size-4 text-fg-3 rtl:-scale-x-100" />
          </Link>
        )}
        {!certs.length && !ready && <p className="px-1 text-[13px] leading-relaxed text-fg-3">{t("academy.certs.empty")}</p>}
      </div>
    </Card>
  );
}

function PracticeCard() {
  const t = useT();
  return (
    <Card className="relative h-full overflow-hidden">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/assets/photos/trader.jpg" alt="" className="absolute inset-0 size-full object-cover opacity-30" />
      <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/85 to-bg/40" />
      <div className="relative flex h-full flex-col p-6">
        <Chip tone="gold" className="self-start">
          {t("academy.practiceCard.chip")}
        </Chip>
        <h3 className="mt-3 text-[19px] font-medium tracking-tight">{t("academy.practice.inTrader")}</h3>
        <p className="mt-1.5 text-[13px] leading-relaxed text-fg-2">{t("academy.practiceCard.text")}</p>
        <div className="mt-auto pt-5">
          <PracticeButton />
        </div>
      </div>
    </Card>
  );
}

export function LiveAcademyHome() {
  const t = useT();
  const { data, error, reload } = useAcademy<Catalog>("catalog");
  if (error) return <AcademyUnavailable error={error} onRetry={reload} />;
  if (!data) return <PageSkeleton />;
  const chapters = data.me.chapters_total;
  // core phases form the learning path; electives (product courses) are listed after it
  const core = data.phases.filter((p) => !isElective(p));
  const electives = data.phases.filter(isElective);
  return (
    <div className="pb-16">
      <PageHeader
        title={t("academy.title")}
        subtitle={t("academy.home.subtitle", { count: chapters })}
        actions={
          <>
            <Link href="/academy/glossary">
              <Button variant="surface">
                <Library /> {t("academy.home.glossary")}
              </Button>
            </Link>
            <Link href="/academy/progress">
              <Button variant="ember">
                <Award /> {t("academy.home.myProgress")}
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
            <h2 className="text-[19px] font-medium tracking-tight">{t("academy.home.pathTitle")}</h2>
            <p className="text-[13px] text-fg-3">{t("academy.home.pathText")}</p>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4" data-testid="phase-grid">
          {core.map((p) => (
            <PhaseCard key={p.slug} p={p} />
          ))}
        </div>
        {electives.length > 0 && (
          <>
            <div className="mb-4 mt-8">
              <h2 className="text-[19px] font-medium tracking-tight">{t("academy.home.electivesTitle")}</h2>
              <p className="text-[13px] text-fg-3">{t("academy.home.electivesText")}</p>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4" data-testid="elective-grid">
              {electives.map((p) => (
                <PhaseCard key={p.slug} p={p} />
              ))}
            </div>
          </>
        )}
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

      <p className="mt-8 max-w-3xl text-[11.5px] leading-relaxed text-fg-3">{t(RISK_NOTE)}</p>
    </div>
  );
}
