"use client";

import * as React from "react";
import { AnimatePresence, motion } from "motion/react";
import { BookOpen, Check, CheckCircle2, Clock, PlayCircle, RotateCcw, Search, Star, Users, X, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Avatar, Button, Card, CardHeader, Chip, Icon3D, Progress, Segmented, cn } from "@/components/kit";
import { PEOPLE } from "@ezymex/mock";
import { COURSES, GLOSSARY, LEARNING_PATHS, QUIZ, type Course, type Level } from "@ezymex/mock/academy";

export const LEVEL_TONE: Record<Level, "up" | "warn" | "down"> = { Beginner: "up", Intermediate: "warn", Advanced: "down" };
export const fmtMin = (m: number) => (m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`);

/* ------------------------------------------------------------------ */
/* Course grid                                                         */
/* ------------------------------------------------------------------ */

function CourseCard({ c, i }: { c: Course; i: number }) {
  const inst = PEOPLE[c.instructor]!;
  const done = c.progress === 100;
  return (
    <motion.div layout initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97 }} transition={{ duration: 0.35, delay: i * 0.03 }}>
      <Card className="group flex h-full flex-col overflow-hidden transition-colors hover:border-[var(--k-border-top)]">
        <button
          className="relative h-40 overflow-hidden rounded-t-[20px] text-left"
          onClick={() => toast(`${c.progress ? "Resuming" : "Starting"} “${c.title}”`, { description: `Lesson ${Math.max(1, Math.ceil((c.progress / 100) * c.lessons))} of ${c.lessons}` })}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={c.image} alt="" className="size-full object-cover transition-transform duration-700 group-hover:scale-105" />
          <div className="absolute inset-0 bg-gradient-to-t from-surface via-surface/20 to-transparent" />
          <div className="absolute left-3.5 top-3.5 flex gap-1.5">
            <Chip size="sm" tone={LEVEL_TONE[c.level]} className="bg-black/60 backdrop-blur-md">
              {c.level}
            </Chip>
            {c.tag && (
              <Chip size="sm" tone="ember" className="bg-black/60 backdrop-blur-md">
                {c.tag}
              </Chip>
            )}
          </div>
          <span className="absolute right-3.5 top-3.5 grid size-9 place-items-center rounded-full border border-white/15 bg-black/40 text-white opacity-0 backdrop-blur-md transition-opacity group-hover:opacity-100">
            <PlayCircle className="size-4" />
          </span>
          {done && (
            <span className="absolute bottom-3 right-3.5 inline-flex items-center gap-1 rounded-full bg-up px-2 py-0.5 text-[10.5px] font-semibold text-white">
              <Check className="size-3" /> Completed
            </span>
          )}
        </button>
        <div className="flex flex-1 flex-col px-5 pb-5 pt-2">
          <div className="text-[15.5px] font-medium leading-snug tracking-tight">{c.title}</div>
          <p className="mt-1 line-clamp-2 text-[12.5px] text-fg-3">{c.summary}</p>
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-fg-3">
            <span className="inline-flex items-center gap-1">
              <BookOpen className="size-3.5" /> <span className="k-num">{c.lessons} lessons</span>
            </span>
            <span className="inline-flex items-center gap-1">
              <Clock className="size-3.5" /> <span className="k-num">{fmtMin(c.minutes)}</span>
            </span>
            <span className="inline-flex items-center gap-1">
              <Star className="size-3.5 fill-gold text-gold" /> <span className="k-num text-fg-2">{c.rating}</span>
            </span>
            <span className="inline-flex items-center gap-1">
              <Users className="size-3.5" /> <span className="k-num">{(c.students / 1000).toFixed(1)}k</span>
            </span>
          </div>
          <div className="mt-auto pt-4">
            <div className="mb-1.5 flex items-center justify-between text-[11.5px]">
              <span className="flex items-center gap-2 text-fg-3">
                <Avatar src={inst.photo} name={inst.name} size={20} />
                {inst.name}
              </span>
              <span className={cn("k-num", done ? "text-up" : c.progress ? "text-fg-2" : "text-fg-3")}>{c.progress ? `${c.progress}%` : "Not started"}</span>
            </div>
            <Progress value={c.progress} tone={done ? "up" : "ember"} />
          </div>
        </div>
      </Card>
    </motion.div>
  );
}

export function CourseGrid() {
  const [level, setLevel] = React.useState<"All" | Level>("All");
  const list = COURSES.filter((c) => level === "All" || c.level === level);
  const count = (l: Level) => COURSES.filter((c) => c.level === l).length;
  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-[19px] font-medium tracking-tight">Courses</h2>
          <p className="text-[13px] text-fg-3">{COURSES.length} courses · taught by Ezymex analysts and funded traders</p>
        </div>
        <div className="-mx-1 overflow-x-auto px-1">
          <Segmented
            size="xs"
            value={level}
            onChange={setLevel}
            options={[
              { value: "All", label: <>All <span className="text-fg-3">{COURSES.length}</span></> },
              { value: "Beginner", label: <>Beginner <span className="text-fg-3">{count("Beginner")}</span></> },
              { value: "Intermediate", label: <>Intermediate <span className="text-fg-3">{count("Intermediate")}</span></> },
              { value: "Advanced", label: <>Advanced <span className="text-fg-3">{count("Advanced")}</span></> },
            ]}
          />
        </div>
      </div>
      <motion.div layout className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        <AnimatePresence mode="popLayout">
          {list.map((c, i) => (
            <CourseCard key={c.id} c={c} i={i} />
          ))}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Learning paths                                                      */
/* ------------------------------------------------------------------ */

export function LearningPaths() {
  return (
    <Card className="h-full">
      <CardHeader title="Learning paths" subtitle="Guided tracks with a certificate at the end" />
      <div className="mt-4 space-y-3 px-4 pb-6 sm:px-6">
        {LEARNING_PATHS.map((p) => {
          const pct = (p.current / p.steps.length) * 100;
          return (
            <div key={p.id} className="k-row px-4 py-4">
              <div className="flex items-center gap-3">
                <Icon3D name={p.icon} size={38} />
                <div className="min-w-0 flex-1">
                  <div className="text-[14px] font-medium">{p.title}</div>
                  <div className="truncate text-[11.5px] text-fg-3">
                    {p.subtitle} · {p.weeks} weeks
                  </div>
                </div>
                <Button size="xs" variant={p.current ? "ember" : "surface"} onClick={() => toast.success(p.current ? `Continuing ${p.title}` : `Enrolled in ${p.title}`, { description: `Next: ${p.steps[p.current]}` })}>
                  {p.current ? "Continue" : "Start"}
                </Button>
              </div>
              <ol className="mt-4 grid grid-cols-4 gap-1.5">
                {p.steps.map((s, i) => {
                  const done = i < p.current;
                  const on = i === p.current;
                  return (
                    <li key={s} className="min-w-0">
                      <div className={cn("h-1.5 rounded-full", done ? "bg-up" : on ? "bg-gradient-to-r from-ember to-ember/30" : "bg-surface-3")} />
                      <div className={cn("mt-1.5 flex items-start gap-1 text-[10.5px] leading-tight", done ? "text-fg-2" : on ? "text-fg" : "text-fg-3")}>
                        {done && <Check className="mt-px size-3 shrink-0 text-up" />}
                        <span className="line-clamp-2">{s}</span>
                      </div>
                    </li>
                  );
                })}
              </ol>
              <div className="sr-only">{pct}% complete</div>
            </div>
          );
        })}
        <div className="pt-2">
          <div className="k-label mb-2">Live sessions this week</div>
          {[
            { who: 9, title: "NFP live: trading the release", when: "Fri 03 Oct · 15:15 GMT+3", seats: 412 },
            { who: 12, title: "Journal review clinic", when: "Tue 30 Sep · 18:00 GMT+3", seats: 96 },
          ].map((s) => (
            <div key={s.title} className="flex items-center gap-3 border-b border-line py-2.5 last:border-0">
              <Avatar src={PEOPLE[s.who]!.photo} name={PEOPLE[s.who]!.name} size={30} online />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-medium">{s.title}</div>
                <div className="k-num text-[11px] text-fg-3">{s.when} · {s.seats} going</div>
              </div>
              <Button size="xs" variant="surface" onClick={() => toast.success("Seat reserved", { description: `${s.title} · ${s.when}. Added to your calendar.` })}>
                Reserve
              </Button>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Glossary                                                            */
/* ------------------------------------------------------------------ */

function highlight(text: string, q: string) {
  if (!q) return text;
  const i = text.toLowerCase().indexOf(q.toLowerCase());
  if (i < 0) return text;
  return (
    <>
      {text.slice(0, i)}
      <mark className="rounded bg-ember-soft px-0.5 text-ember">{text.slice(i, i + q.length)}</mark>
      {text.slice(i + q.length)}
    </>
  );
}

export function Glossary() {
  const [q, setQ] = React.useState("");
  const [open, setOpen] = React.useState<string | null>("Margin level");
  const list = GLOSSARY.filter((g) => !q || g.term.toLowerCase().includes(q.toLowerCase()) || g.def.toLowerCase().includes(q.toLowerCase()));
  return (
    <Card className="flex h-full flex-col">
      <CardHeader title="Glossary" subtitle={`${GLOSSARY.length} essential trading terms`} action={<Icon3D name="books" size={34} />} />
      <div className="mt-4 px-4 sm:px-6">
        <div className="flex h-10 items-center gap-2 rounded-full border border-line bg-surface-2 px-3.5 focus-within:border-ember/50 focus-within:ring-4 focus-within:ring-ember/10">
          <Search className="size-4 text-fg-3" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search pip, leverage, swap…" className="min-w-0 flex-1 bg-transparent text-[13.5px] outline-none placeholder:text-fg-3" />
          {q && (
            <button onClick={() => setQ("")} className="text-fg-3 hover:text-fg" aria-label="Clear">
              <X className="size-4" />
            </button>
          )}
          <span className="k-num text-[11px] text-fg-3">{list.length}</span>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {["Pip", "Leverage", "Spread", "Drawdown", "Swap"].map((t) => (
            <button key={t} onClick={() => { setQ(t); setOpen(t); }} className="rounded-full border border-line bg-surface-2 px-2.5 py-1 text-[11.5px] text-fg-2 hover:bg-surface-3 hover:text-fg">
              {t}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-3 max-h-[420px] flex-1 space-y-1.5 overflow-y-auto px-4 pb-5 sm:px-6">
        {list.map((g) => {
          const on = open === g.term;
          return (
            <button key={g.term} onClick={() => setOpen(on ? null : g.term)} className={cn("k-row block w-full px-4 py-2.5 text-left transition-colors hover:bg-surface-3/60", on && "border-[var(--k-border-top)] bg-surface-3/60")}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[13.5px] font-medium">{highlight(g.term, q)}</span>
                <span className="text-[11.5px] text-fg-3">{g.cat}</span>
              </div>
              <AnimatePresence initial={false}>
                {(on || !!q) && (
                  <motion.p initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden text-[12.5px] leading-relaxed text-fg-2">
                    <span className="block pt-1.5">{highlight(g.def, q)}</span>
                  </motion.p>
                )}
              </AnimatePresence>
            </button>
          );
        })}
        {list.length === 0 && <div className="py-10 text-center text-[13px] text-fg-3">No terms match “{q}”. Try the AI Coach for anything else.</div>}
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Quiz                                                                */
/* ------------------------------------------------------------------ */

export function QuizCard() {
  const [idx, setIdx] = React.useState(0);
  const [pick, setPick] = React.useState<number | null>(null);
  const [score, setScore] = React.useState(0);
  const q = QUIZ[idx]!;
  const answered = pick !== null;
  const right = pick === q.answer;
  return (
    <Card className="flex h-full flex-col">
      <CardHeader
        title="Quick quiz"
        subtitle={`Question ${idx + 1} of ${QUIZ.length} · +50 pts per correct answer`}
        action={
          <Chip tone="gold" className="k-num">
            {score}/{QUIZ.length}
          </Chip>
        }
      />
      <div className="mt-4 flex flex-1 flex-col px-4 pb-6 sm:px-6">
        <div className="flex gap-1">
          {QUIZ.map((_, i) => (
            <span key={i} className={cn("h-1 flex-1 rounded-full", i < idx ? "bg-up" : i === idx ? "bg-ember" : "bg-surface-3")} />
          ))}
        </div>
        <AnimatePresence mode="wait">
          <motion.div key={idx} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.25 }} className="flex flex-1 flex-col">
            <p className="mt-4 text-[15px] font-medium leading-snug">{q.q}</p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {q.options.map((o, i) => {
                const isRight = answered && i === q.answer;
                const isWrong = answered && i === pick && !right;
                return (
                  <motion.button
                    key={o}
                    disabled={answered}
                    onClick={() => {
                      setPick(i);
                      if (i === q.answer) {
                        setScore((s) => s + 1);
                        toast.success("Correct! +50 points");
                      }
                    }}
                    animate={isWrong ? { x: [0, -6, 6, -4, 4, 0] } : {}}
                    transition={{ duration: 0.35 }}
                    className={cn(
                      "k-row flex items-center justify-between px-4 py-3 text-left text-[14px] font-medium transition-colors",
                      !answered && "hover:border-ember/40 hover:bg-ember-soft",
                      isRight && "border-up/50 bg-up-soft text-up",
                      isWrong && "border-down/50 bg-down-soft text-down",
                      answered && !isRight && !isWrong && "opacity-50",
                    )}
                  >
                    <span className="k-num">{o}</span>
                    {isRight && <CheckCircle2 className="size-4" />}
                    {isWrong && <XCircle className="size-4" />}
                  </motion.button>
                );
              })}
            </div>
            <AnimatePresence>
              {answered && (
                <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className={cn("mt-3 rounded-[14px] border px-4 py-3 text-[12.5px] leading-relaxed", right ? "border-up/25 bg-up-soft/60 text-fg-2" : "border-down/25 bg-down-soft/60 text-fg-2")}>
                  <span className={cn("font-semibold", right ? "text-up" : "text-down")}>{right ? "Correct. " : "Not quite. "}</span>
                  {q.explain}
                </motion.div>
              )}
            </AnimatePresence>
            <div className="mt-auto flex items-center justify-end gap-2 pt-4">
              {idx === QUIZ.length - 1 && answered ? (
                <Button
                  size="sm"
                  variant="surface"
                  onClick={() => {
                    toast(`Quiz complete · ${score}/${QUIZ.length}`, { description: "Full 20-question Margin & Risk quiz unlocked in the Risk management course." });
                    setIdx(0);
                    setPick(null);
                    setScore(0);
                  }}
                >
                  <RotateCcw /> Restart
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant={answered ? "ember" : "ghost"}
                  onClick={() => {
                    if (!answered) toast("Skipped", { description: q.explain });
                    setIdx((i) => Math.min(QUIZ.length - 1, i + 1));
                    setPick(null);
                  }}
                >
                  {answered ? "Next question" : "Skip"}
                </Button>
              )}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </Card>
  );
}
