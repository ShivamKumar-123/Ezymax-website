"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, BookOpen, CheckCircle2, Clock, GraduationCap, Lightbulb, MonitorPlay } from "lucide-react";
import { Button, Card, Chip, cn } from "@/components/kit";
import { useT } from "@kalks/i18n/react";
import { LEVEL_TONE, academyApi, isElective, levelLabel, trackLabel, trackTone, useAcademy, type ChapterView, type QuizReply } from "./api";
import { Markdown, headingsOf } from "./markdown";
import { ChapterQuiz } from "./quiz";
import { AcademyUnavailable, BackLink, PracticeButton, RISK_NOTE, StatusDot, TrackIcon } from "./shared";

/** Reports how far through the article the reader has scrolled (max so far), throttled. */
function useReadingProgress(slug: string, articleRef: React.RefObject<HTMLElement | null>, initial: number) {
  const [pct, setPct] = React.useState(initial);
  const sent = React.useRef(initial);
  const maxRef = React.useRef(initial);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    sent.current = initial;
    maxRef.current = initial;
    setPct(initial);
  }, [slug, initial]);

  React.useEffect(() => {
    const flush = (keepalive = false) => {
      const v = maxRef.current;
      if (v <= sent.current) return;
      sent.current = v;
      academyApi(`chapters/${slug}/progress`, { body: { read_pct: v }, keepalive }).catch(() => {});
    };
    const onScroll = () => {
      const el = articleRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const seen = window.innerHeight - r.top;
      const p = Math.max(0, Math.min(100, Math.round((seen / Math.max(1, r.height)) * 100)));
      if (p > maxRef.current) {
        maxRef.current = p;
        setPct(p);
        if (!timer.current) {
          timer.current = setTimeout(() => {
            timer.current = null;
            flush();
          }, 1500);
        }
      }
    };
    // register the visit (and the page that is already visible) once
    const first = setTimeout(() => {
      onScroll();
      if (sent.current === 0 && maxRef.current === 0) academyApi(`chapters/${slug}/progress`, { body: { read_pct: 0 } }).catch(() => {});
      else flush();
    }, 800);
    window.addEventListener("scroll", onScroll, { passive: true });
    const hide = () => document.visibilityState === "hidden" && flush(true);
    document.addEventListener("visibilitychange", hide);
    return () => {
      clearTimeout(first);
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
      flush(true);
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("visibilitychange", hide);
    };
  }, [slug, articleRef]);

  return pct;
}

function Toc({ body }: { body: string }) {
  const t = useT();
  const hs = React.useMemo(() => headingsOf(body).filter((h) => h.level === 2), [body]);
  const [active, setActive] = React.useState<string | null>(null);
  React.useEffect(() => {
    const els = hs.map((h) => document.getElementById(h.id)).filter(Boolean) as HTMLElement[];
    if (!els.length) return;
    const obs = new IntersectionObserver(
      (entries) => {
        const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (vis) setActive(vis.target.id);
      },
      { rootMargin: "-80px 0px -65% 0px" },
    );
    els.forEach((e) => obs.observe(e));
    return () => obs.disconnect();
  }, [hs]);
  if (hs.length < 2) return null;
  return (
    <nav aria-label={t("academy.reader.onThisPage")} className="text-[12.5px]">
      <div className="k-label mb-2.5">{t("academy.reader.onThisPage")}</div>
      <ul className="space-y-1.5 border-s border-line">
        {hs.map((h) => (
          <li key={h.id}>
            <a href={`#${h.id}`} className={cn("-ms-px block border-s py-0.5 ps-3 transition-colors", active === h.id ? "border-ember text-fg" : "border-transparent text-fg-3 hover:text-fg-2")}>
              {h.text}
            </a>
          </li>
        ))}
        <li>
          <a href="#quiz" className="-ms-px block border-s border-transparent py-0.5 ps-3 text-fg-3 hover:text-fg-2">
            {t("academy.quiz.title")}
          </a>
        </li>
      </ul>
    </nav>
  );
}

function Article({ view, onQuiz }: { view: ChapterView; onQuiz: (r: QuizReply) => void }) {
  const t = useT();
  const { chapter: c, phase, section } = view;
  const ref = React.useRef<HTMLElement | null>(null);
  const read = useReadingProgress(c.slug, ref, view.progress.read_pct);
  const [completed, setCompleted] = React.useState(view.progress.completed);
  React.useEffect(() => setCompleted(view.progress.completed), [view.progress.completed, c.slug]);
  const chapters = section.chapters.map((x) => (x.slug === c.slug ? { ...x, completed } : x));

  return (
    <>
      <div className="fixed inset-x-0 top-0 z-50 h-[3px] bg-transparent" aria-hidden>
        <div className="h-full bg-ember transition-[width] duration-300" style={{ width: `${read}%` }} data-testid="read-progress" />
      </div>
      <BackLink href={`/academy/phase/${phase.slug}`}>
        {t("academy.phaseTitle", { n: phase.order, title: phase.title })}
      </BackLink>
      <div className="grid grid-cols-1 gap-8 xl:grid-cols-[240px_minmax(0,1fr)_200px]">
        <aside className="hidden xl:block">
          <div className="sticky top-24">
            <div className="k-label mb-1">{trackLabel(t, section.track)}</div>
            <div className="mb-3 text-[13.5px] font-medium">{section.title}</div>
            <ol className="space-y-1">
              {chapters.map((x, i) => (
                <li key={x.slug}>
                  <Link href={`/academy/chapter/${x.slug}`} className={cn("flex items-start gap-2.5 rounded-[12px] px-2 py-2 text-[12.5px] leading-snug transition-colors", x.slug === c.slug ? "bg-surface-2 text-fg" : "text-fg-3 hover:text-fg-2")}>
                    <StatusDot state={x.completed ? "done" : "open"} n={i + 1} />
                    <span className="pt-1">{x.title}</span>
                  </Link>
                </li>
              ))}
            </ol>
          </div>
        </aside>

        <article ref={ref} className="min-w-0 max-w-[760px]" data-testid="chapter-article">
          <div className="flex flex-wrap items-center gap-2">
            <Chip tone={trackTone(section.track)}>
              <TrackIcon track={section.track} className="size-3" />
              {trackLabel(t, section.track)}
            </Chip>
            <Chip tone={LEVEL_TONE[phase.level]}>{levelLabel(phase.level)}</Chip>
            {isElective(phase) && <Chip>{t("academy.elective")}</Chip>}
            {completed && (
              <Chip tone="up" dot>
                {t("common.completed")}
              </Chip>
            )}
          </div>
          <h1 className="mt-4 text-[28px] font-medium leading-tight tracking-[-0.02em] sm:text-[34px]">{c.title}</h1>
          <p className="mt-2 text-[15px] leading-relaxed text-fg-2">{c.summary}</p>
          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1 border-b border-line pb-5 text-[12.5px] text-fg-3">
            <span className="inline-flex items-center gap-1.5">
              <BookOpen className="size-3.5" /> {t("academy.reader.chapterOf", { n: section.index, total: section.count })}
            </span>
            <span className="k-num inline-flex items-center gap-1.5">
              <Clock className="size-3.5" /> {t("academy.reader.minRead", { count: c.minutes })}
            </span>
            <span className="k-num inline-flex items-center gap-1.5">
              <GraduationCap className="size-3.5" /> {t("academy.reader.quizLength", { count: c.quiz.length })}
            </span>
          </div>

          <Markdown src={c.body} className="mt-6" />

          {c.takeaways.length > 0 && (
            <Card className="mt-10 p-5 sm:p-6" data-testid="takeaways">
              <div className="flex items-center gap-2">
                <Lightbulb className="size-4 text-gold" />
                <h2 className="text-[16px] font-medium tracking-tight">{t("academy.reader.takeaways")}</h2>
              </div>
              <ul className="mt-3 space-y-2.5">
                {c.takeaways.map((tk, i) => (
                  <li key={i} className="flex gap-3 text-[14px] leading-relaxed text-fg-2">
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-up" />
                    <span>{tk}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {c.practice && (
            <Card className="mt-4 flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6" data-testid="practice">
              <div className="flex items-start gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-full border border-ember/30 bg-ember-soft text-ember">
                  <MonitorPlay className="size-4" />
                </span>
                <div>
                  <div className="k-label">{t("academy.practice.inTrader")}{c.practice.symbol ? ` · ${c.practice.symbol}` : ""}</div>
                  <p className="mt-1 text-[14px] leading-relaxed text-fg-2">{c.practice.label}</p>
                </div>
              </div>
              <div className="shrink-0">
                <PracticeButton size="sm" label={t("academy.practice.openDemo")} />
              </div>
            </Card>
          )}

          <div id="quiz" className="mt-4 scroll-mt-24">
            <ChapterQuiz
              key={c.slug}
              slug={c.slug}
              questions={c.quiz}
              passedBefore={view.progress.completed}
              onDone={(r) => {
                if (r.completed) setCompleted(true);
                onQuiz(r);
              }}
            />
          </div>

          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {view.prev ? (
              <Link href={`/academy/chapter/${view.prev.slug}`} className="k-row flex items-center gap-3 px-4 py-3.5" data-testid="prev-chapter">
                <ArrowLeft className="size-4 shrink-0 text-fg-3 rtl:-scale-x-100" />
                <div className="min-w-0">
                  <div className="text-[12px] text-fg-3">{t("academy.reader.previous")}</div>
                  <div className="truncate text-[13.5px] font-medium">{view.prev.title}</div>
                </div>
              </Link>
            ) : (
              <span className="hidden sm:block" />
            )}
            {view.next ? (
              <Link href={`/academy/chapter/${view.next.slug}`} className="k-row flex items-center justify-end gap-3 px-4 py-3.5 text-end" data-testid="next-chapter">
                <div className="min-w-0">
                  <div className="text-[12px] text-fg-3">{t("common.next")}</div>
                  <div className="truncate text-[13.5px] font-medium">{view.next.title}</div>
                </div>
                <ArrowRight className="size-4 shrink-0 text-fg-3 rtl:-scale-x-100" />
              </Link>
            ) : (
              <Link href="/academy/progress" className="k-row flex items-center justify-end gap-3 px-4 py-3.5 text-end">
                <div className="text-[13.5px] font-medium">{t("academy.reader.end")}</div>
                <ArrowRight className="size-4 shrink-0 text-fg-3 rtl:-scale-x-100" />
              </Link>
            )}
          </div>
          <p className="mt-8 text-[11.5px] leading-relaxed text-fg-3">{t(RISK_NOTE)}</p>
        </article>

        <aside className="hidden xl:block">
          <div className="sticky top-24 space-y-6">
            <div>
              <div className="k-label mb-2">{t("academy.reader.reading")}</div>
              <div className="k-num text-[22px] font-semibold">{read}%</div>
              <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-surface-3">
                <div className="h-full bg-ember" style={{ width: `${read}%` }} />
              </div>
            </div>
            <Toc body={c.body} />
            <Link href="#quiz">
              <Button size="sm" variant="surface" className="w-full">
                <GraduationCap /> {t("academy.reader.goToQuiz")}
              </Button>
            </Link>
          </div>
        </aside>
      </div>
    </>
  );
}

export function LiveChapter({ slug }: { slug: string }) {
  const { data, error, reload } = useAcademy<ChapterView>(`chapters/${slug}`);
  React.useEffect(() => {
    if (data) window.scrollTo({ top: 0 });
  }, [data?.chapter.slug]); // eslint-disable-line react-hooks/exhaustive-deps
  if (error) return <AcademyUnavailable error={error} onRetry={reload} />;
  if (!data || data.chapter.slug !== slug)
    return (
      <div className="mx-auto max-w-[760px] space-y-4 pb-16 pt-8">
        <div className="h-8 w-3/4 animate-pulse rounded-[10px] bg-surface-2" />
        <div className="h-4 w-full animate-pulse rounded bg-surface-2" />
        <div className="h-4 w-5/6 animate-pulse rounded bg-surface-2" />
        <div className="h-64 w-full animate-pulse rounded-[16px] bg-surface-2" />
      </div>
    );
  return (
    <div className="pb-16">
      <Article view={data} onQuiz={() => {}} />
    </div>
  );
}
