"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowUpRight, Award, Bot, Flame, PlayCircle, Target } from "lucide-react";
import { toast } from "sonner";
import { Avatar, Button, Card, Chip, Icon3D, PageHeader, Reveal, Starfield, cn } from "@kalks/ui";
import { PEOPLE } from "@kalks/mock";
import { CONTINUE_LEARNING, COURSES } from "@kalks/mock/academy";
import { CourseGrid, Glossary, LEVEL_TONE, LearningPaths, QuizCard } from "@/components/academy/learn";
import { IS_DEMO } from "@kalks/mock/mode";
import { LiveAcademyHome } from "@/components/academy/live/home";

function ContinueHero() {
  const c = COURSES.find((x) => x.id === CONTINUE_LEARNING.courseId)!;
  const inst = PEOPLE[c.instructor]!;
  const done = Math.round((c.progress / 100) * c.lessons);
  return (
    <Card className="relative h-full overflow-hidden">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={c.image} alt="" className="absolute inset-0 size-full object-cover opacity-50" />
      <div className="absolute inset-0 bg-gradient-to-r from-bg via-bg/85 to-bg/20" />
      <div className="absolute inset-0 bg-[radial-gradient(70%_100%_at_100%_100%,rgba(255,90,31,0.25),transparent_60%)]" />
      <div className="relative flex h-full flex-col p-6 sm:p-7">
        <div className="flex flex-wrap items-center gap-2">
          <Chip tone="ember" dot>
            Continue learning
          </Chip>
          <Chip tone={LEVEL_TONE[c.level]}>{c.level}</Chip>
        </div>
        <h2 className="mt-4 max-w-xl text-[26px] font-medium leading-tight tracking-[-0.02em] sm:text-[32px]">{c.title}</h2>
        <p className="mt-1.5 max-w-lg text-[13.5px] text-fg-2">
          Lesson {CONTINUE_LEARNING.lesson} · <span className="text-fg">{CONTINUE_LEARNING.lessonTitle}</span> · {CONTINUE_LEARNING.remainingMin} min left
        </p>
        <div className="mt-6 max-w-md">
          <div className="mb-2 flex items-center justify-between text-[12px] text-fg-3">
            <span className="k-num">
              {done} of {c.lessons} lessons
            </span>
            <span className="k-num font-medium text-fg">{c.progress}%</span>
          </div>
          <div className="flex gap-1">
            {Array.from({ length: c.lessons }, (_, i) => (
              <span key={i} className={cn("h-1.5 flex-1 rounded-full", i < done ? "bg-ember" : i === done ? "animate-pulse bg-ember/50" : "bg-white/10")} />
            ))}
          </div>
        </div>
        <div className="mt-auto flex flex-wrap items-center gap-3 pt-7">
          <Button variant="ember" size="lg" shimmer onClick={() => toast(`Resuming lesson ${CONTINUE_LEARNING.lesson}`, { description: CONTINUE_LEARNING.lessonTitle })}>
            <PlayCircle /> Resume lesson
          </Button>
          <div className="flex items-center gap-2.5 rounded-full border border-white/10 bg-black/35 py-1 pl-1 pr-3.5 backdrop-blur-md">
            <Avatar src={inst.photo} name={inst.name} size={30} verified />
            <div className="leading-tight">
              <div className="text-[12.5px] font-medium">{inst.name}</div>
              <div className="text-[10.5px] text-fg-3">Head of Risk Education</div>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}

function StatsCard() {
  const week = [1, 1, 0, 1, 1, 1, 1];
  return (
    <Card hot className="relative h-full overflow-hidden">
      <Starfield density={40} />
      <div className="relative flex h-full flex-col p-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="k-label">Learning streak</div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="k-num text-[44px] font-semibold leading-none tracking-tight">12</span>
              <span className="text-fg-2">days</span>
            </div>
          </div>
          <Icon3D name="fire" size={64} />
        </div>
        <div className="mt-4 flex gap-1.5">
          {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
            <div key={i} className="flex flex-1 flex-col items-center gap-1">
              <span className={cn("grid size-7 place-items-center rounded-full border text-[10px]", week[i] ? "border-ember/40 bg-ember text-white shadow-[0_0_14px_-4px_rgba(255,90,31,0.8)]" : "border-line bg-black/30 text-fg-3")}>
                {week[i] ? <Flame className="size-3.5" /> : null}
              </span>
              <span className="text-[10px] text-fg-3">{d}</span>
            </div>
          ))}
        </div>
        <div className="mt-auto grid grid-cols-3 gap-2 pt-5">
          {[
            [<Award key="a" className="size-3.5" />, "1", "Certificate"],
            [<Target key="t" className="size-3.5" />, "34", "Lessons"],
            [<PlayCircle key="p" className="size-3.5" />, "9h 40m", "Watched"],
          ].map(([ic, v, l], i) => (
            <div key={i} className="rounded-[14px] border border-white/10 bg-black/30 px-3 py-2.5 backdrop-blur-sm">
              <div className="text-fg-3">{ic}</div>
              <div className="k-num mt-1 text-[15px] font-semibold">{v}</div>
              <div className="text-[10.5px] text-fg-3">{l}</div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

function DemoChallengeCard() {
  return (
    <Card className="relative overflow-hidden">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/assets/photos/skyline.jpg" alt="" className="absolute inset-0 size-full object-cover opacity-35" />
      <div className="absolute inset-0 bg-gradient-to-r from-bg via-bg/85 to-transparent" />
      <div className="relative flex flex-col gap-5 p-6 sm:p-7 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-5">
          <Icon3D name="rocket" size={72} className="hidden shrink-0 sm:block" />
          <div className="max-w-xl">
            <Chip tone="gold" className="mb-3">
              Demo challenge · free
            </Chip>
            <h3 className="text-[22px] font-medium tracking-tight">Practise the $25k prop challenge on demo</h3>
            <p className="mt-1.5 text-[13.5px] text-fg-2">Same rules as the real evaluation — 8% target, 5% daily loss, 10% max drawdown — with zero risk. Pass it and get 20% off your first funded challenge.</p>
            <div className="mt-3 flex flex-wrap gap-2 text-[11.5px]">
              {["8% profit target", "5% daily loss", "10% max DD", "30 days"].map((t) => (
                <span key={t} className="rounded-full border border-line bg-surface-2/80 px-2.5 py-1 text-fg-2">
                  {t}
                </span>
              ))}
            </div>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Button variant="surface" onClick={() => toast.success("Demo challenge account #90023117 created", { description: "$25,000 demo balance · Kalks-Demo01" })}>
            Start on demo
          </Button>
          <Link href="/prop">
            <Button variant="ember">
              View prop challenges <ArrowUpRight />
            </Button>
          </Link>
        </div>
      </div>
    </Card>
  );
}

function CoachTeaser() {
  return (
    <Link href="/academy/coach" className="group block h-full">
      <Card className="flex h-full flex-col overflow-hidden transition-colors group-hover:border-[var(--k-border-top)]">
        <div className="relative flex flex-1 flex-col p-6">
          <div className="flex items-start justify-between">
            <div className="grid size-11 place-items-center rounded-full border border-ember/30 bg-ember-soft text-ember">
              <Bot className="size-5" />
            </div>
            <ArrowUpRight className="size-4 text-fg-3 transition-colors group-hover:text-fg" />
          </div>
          <div className="mt-4 text-[16px] font-medium">Kalks Coach</div>
          <p className="mt-1 text-[13px] text-fg-3">Your weekly review is ready. 22 trades analysed.</p>
          <div className="mt-4 rounded-[14px] border border-line bg-surface-2 p-3.5 text-[12.5px] leading-relaxed text-fg-2">
            “Your New York session trades made <span className="font-medium text-up">$11,260</span> — more than Asia and London combined. Friday late-session trades are dragging your win rate.”
          </div>
          <div className="mt-auto pt-4">
            <span className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-ember">Open coach <ArrowUpRight className="size-3.5" /></span>
          </div>
        </div>
      </Card>
    </Link>
  );
}

export default function AcademyPage() {
  // live builds: the real Academy (services/academy); demo builds keep the showcase below
  if (!IS_DEMO) return <LiveAcademyHome />;
  return (
    <div className="pb-16">
      <PageHeader
        title="Academy"
        subtitle="Courses, paths and practice — from your first pip to your first funded account."
        actions={
          <Link href="/academy/coach">
            <Button variant="ember" size="lg" shimmer>
              <Bot /> Ask Kalks Coach
            </Button>
          </Link>
        }
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Reveal className="xl:col-span-8">
          <ContinueHero />
        </Reveal>
        <Reveal delay={0.08} className="xl:col-span-4">
          <StatsCard />
        </Reveal>
      </div>

      <Reveal delay={0.1} className="mt-8">
        <CourseGrid />
      </Reveal>

      <div className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-12">
        <Reveal delay={0.05} className="xl:col-span-4">
          <LearningPaths />
        </Reveal>
        <Reveal delay={0.1} className="xl:col-span-4">
          <Glossary />
        </Reveal>
        <div className="flex flex-col gap-4 lg:col-span-2 xl:col-span-4">
          <Reveal delay={0.15}>
            <QuizCard />
          </Reveal>
          <Reveal delay={0.2} className="flex-1">
            <CoachTeaser />
          </Reveal>
        </div>
      </div>

      <Reveal delay={0.1} className="mt-4">
        <DemoChallengeCard />
      </Reveal>
    </div>
  );
}

