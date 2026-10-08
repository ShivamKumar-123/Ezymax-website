"use client";

import * as React from "react";
import { Award, BookOpen, GraduationCap, Pencil, Plus, Search, Star, Users } from "lucide-react";
import { toast } from "sonner";
import { Avatar, Button, Card, CardHeader, Chip, Flag, KpiCard, PageHeader, Progress, Reveal, Segmented, type ChipTone, cn } from "@ezymex/ui";
import { CNT_COURSES, CNT_LANGS } from "@ezymex/mock/admin-growth-content";
import { PEOPLE } from "@ezymex/mock";
import { CourseEditor, type CourseState } from "@/components/content/course-editor";
import { RingPct } from "@/components/marketing/kit";
import { IS_DEMO } from "@ezymex/mock/mode";
import { LiveAcademyCms } from "@/components/academy-live/cms";

const LEVEL_TONE: Record<string, ChipTone> = { Beginner: "up", Intermediate: "gold", Advanced: "ember" };
const STATUS_TONE: Record<string, ChipTone> = { published: "up", draft: "neutral", scheduled: "info" };
// Priority order when a course is available in N languages
const LANG_PRIORITY = ["en", "ar", "hi", "es", "pt", "vi", "id", "tr", "fr", "de", "ru", "zh", "ms", "th", "ja", "ko", "ur", "fa", "it", "pl", "bn", "sw"];

const INIT: CourseState[] = CNT_COURSES.map((c) => ({ ...c, langs: LANG_PRIORITY.slice(0, c.languages) }));
type Filter = "all" | "published" | "scheduled" | "draft";

export default function AcademyPage() {
  // live builds: the real Academy CMS (services/academy); demo builds keep the showcase below
  return IS_DEMO ? <DemoAcademyPage /> : <LiveAcademyCms />;
}

function DemoAcademyPage() {
  const [courses, setCourses] = React.useState<CourseState[]>(INIT);
  const [filter, setFilter] = React.useState<Filter>("all");
  const [q, setQ] = React.useState("");
  const [editing, setEditing] = React.useState<CourseState | null>(null);
  const [open, setOpen] = React.useState(false);

  const edit = (c: CourseState) => {
    setEditing(c);
    setOpen(true);
  };
  const create = () =>
    edit({
      id: `new_${Date.now()}`,
      title: "",
      subtitle: "",
      cover: "/assets/photos/charts.jpg",
      level: "Beginner",
      category: "Forex",
      lessons: [],
      quizzes: 0,
      enrolments: 0,
      completion: 0,
      rating: 0,
      status: "draft",
      author: PEOPLE[4]!,
      languages: 1,
      updated: "24 Sep 2026",
      tenants: "All tenants",
      langs: ["en"],
    });

  const list = courses.filter((c) => (filter === "all" || c.status === filter) && (!q || `${c.title} ${c.category}`.toLowerCase().includes(q.toLowerCase())));
  const published = courses.filter((c) => c.status === "published");
  const enrol = courses.reduce((s, c) => s + c.enrolments, 0);
  const avgCompletion = published.reduce((s, c) => s + c.completion * c.enrolments, 0) / Math.max(1, published.reduce((s, c) => s + c.enrolments, 0));
  const totalLessons = courses.reduce((s, c) => s + c.lessons.length, 0);
  const langName = Object.fromEntries(CNT_LANGS.map((l) => [l.code, l]));

  return (
    <div className="pb-16">
      <PageHeader
        title="Academy"
        subtitle="Courses, lessons and quizzes shown in the Client Area Academy. Completion feeds the AI Coach and Rewards."
        actions={
          <>
            <Button variant="surface" onClick={() => toast.success("Certificates", { description: "12,480 issued · template “Ezymex Academy 2026” · auto-sent at 100% completion" })}>
              <Award /> Certificates
            </Button>
            <Button variant="ember" shimmer onClick={create}>
              <Plus /> New course
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Courses" icon={<BookOpen />} value={<span className="k-num">{courses.length}</span>} chip={`${published.length} published · ${totalLessons} lessons`} />
        <KpiCard label="Enrolments" icon={<Users />} value={<span className="k-num">{enrol.toLocaleString("en-US")}</span>} chip="+2,140 this month" chipTone="up" delay={0.05} />
        <KpiCard label="Avg completion" icon={<GraduationCap />} value={<span className="k-num">{avgCompletion.toFixed(1)}%</span>} chip="Weighted by enrolments" chipTone="gold" delay={0.1} />
        <KpiCard label="Learners who deposit" icon={<Star />} value={<span className="k-num">3.2×</span>} hot illustration="graduation_cap" footer={<Chip tone="up">vs non-learners · 90d</Chip>} delay={0.15} />
      </div>

      <Reveal delay={0.1} className="mt-8">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-[18px] font-medium tracking-tight">Courses</h2>
            <p className="text-[13px] text-fg-3">Click a course to open the editor and manage its lessons</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex h-9 items-center gap-2 rounded-full border border-line bg-surface-2 px-3.5">
              <Search className="size-3.5 text-fg-3" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search courses…" className="w-40 bg-transparent text-[13px] outline-none placeholder:text-fg-3" />
            </div>
            <Segmented
              size="sm"
              value={filter}
              onChange={setFilter}
              options={[
                { value: "all", label: <>All <span className="text-fg-3">{courses.length}</span></> },
                { value: "published", label: "Published" },
                { value: "scheduled", label: "Scheduled" },
                { value: "draft", label: "Draft" },
              ]}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {list.map((c, i) => (
            <Reveal key={c.id} delay={0.03 * i}>
              <button type="button" onClick={() => edit(c)} className="k-card group flex h-full w-full flex-col overflow-hidden text-left transition-[border-color] hover:border-[var(--k-border-top)]">
                <div className="relative aspect-[16/9] overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={c.cover} alt="" className="absolute inset-0 size-full object-cover transition-transform duration-700 group-hover:scale-[1.04]" />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0b0b0e] via-black/25 to-black/10" />
                  <div className="absolute inset-0 bg-[radial-gradient(90%_70%_at_0%_100%,rgba(255,90,31,0.25),transparent_60%)]" />
                  <div className="absolute left-3 top-3 flex gap-1.5">
                    <Chip size="sm" tone={LEVEL_TONE[c.level]} className="bg-black/60 backdrop-blur">
                      {c.level}
                    </Chip>
                  </div>
                  <div className="absolute right-3 top-3">
                    <Chip size="sm" tone={STATUS_TONE[c.status]} dot className="bg-black/50 backdrop-blur">
                      {c.status[0]!.toUpperCase() + c.status.slice(1)}
                    </Chip>
                  </div>
                  <span className="absolute bottom-3 right-3 grid size-8 place-items-center rounded-full border border-white/15 bg-black/40 text-white/80 opacity-0 backdrop-blur transition-opacity group-hover:opacity-100">
                    <Pencil className="size-3.5" />
                  </span>
                </div>
                <div className="flex flex-1 flex-col px-5 pb-4 pt-3.5">
                  <div className="text-[11.5px] font-medium uppercase tracking-wider text-fg-3">{c.category}</div>
                  <div className="mt-0.5 line-clamp-1 text-[15px] font-medium">{c.title || "Untitled course"}</div>
                  <div className="line-clamp-1 text-[12.5px] text-fg-3">{c.subtitle}</div>

                  <div className="mb-4 mt-3 flex items-center gap-3">
                    <RingPct value={c.completion} size={42} tone={c.completion >= 55 ? "up" : "gold"} />
                    <div className="grid flex-1 grid-cols-2 gap-x-3 gap-y-0.5 text-[12px]">
                      <span className="text-fg-3">Lessons</span>
                      <span className="k-num text-right text-fg">{c.lessons.length}</span>
                      <span className="text-fg-3">Enrolled</span>
                      <span className="k-num text-right text-fg">{c.enrolments.toLocaleString("en-US")}</span>
                    </div>
                  </div>

                  <div className="mt-auto flex items-center justify-between gap-2 border-t border-line pt-3">
                    <span className="flex items-center">
                      <span className="flex -space-x-1.5">
                        {c.langs.slice(0, 5).map((l) => (
                          <Flag key={l} country={langName[l]?.flag ?? "gb"} className="size-4 ring-2 ring-surface" />
                        ))}
                      </span>
                      {c.langs.length > 5 && <span className="k-num ml-1.5 text-[11px] text-fg-3">+{c.langs.length - 5}</span>}
                    </span>
                    {c.rating > 0 ? (
                      <span className="k-num flex items-center gap-1 text-[12px] text-gold">
                        <Star className="size-3.5 fill-current" /> {c.rating.toFixed(1)}
                      </span>
                    ) : (
                      <span className="text-[11.5px] text-fg-3">No ratings</span>
                    )}
                  </div>
                </div>
              </button>
            </Reveal>
          ))}
          {list.length === 0 && <Card className="py-14 text-center text-sm text-fg-3 md:col-span-2 xl:col-span-4">No courses match these filters.</Card>}
        </div>
      </Reveal>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Reveal delay={0.1} className="xl:col-span-8">
          <Card className="h-full">
            <CardHeader title="Course performance" subtitle="Enrolments and completion · published courses" />
            <div className="space-y-2 px-4 pb-5 pt-4 sm:px-6">
              {[...published]
                .sort((a, b) => b.enrolments - a.enrolments)
                .map((c) => (
                  <button key={c.id} type="button" onClick={() => edit(c)} className="k-row flex w-full items-center gap-3 px-3 py-2.5 text-left">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={c.cover} alt="" className="h-9 w-14 shrink-0 rounded-[8px] object-cover" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px] font-medium">{c.title}</div>
                      <div className="mt-1.5 flex items-center gap-2">
                        <Progress value={c.completion} tone={c.completion >= 55 ? "up" : "gold"} className="max-w-[260px]" />
                        <span className="k-num text-[11.5px] text-fg-3">{c.completion}% complete</span>
                      </div>
                    </div>
                    <div className="hidden text-right sm:block">
                      <div className="k-num text-[13px]">{c.enrolments.toLocaleString("en-US")}</div>
                      <div className="text-[11px] text-fg-3">enrolled</div>
                    </div>
                    <div className="hidden w-24 text-right md:block">
                      <div className="k-num text-[13px]">{Math.round((c.enrolments * c.completion) / 100).toLocaleString("en-US")}</div>
                      <div className="text-[11px] text-fg-3">certificates</div>
                    </div>
                  </button>
                ))}
            </div>
          </Card>
        </Reveal>
        <Reveal delay={0.15} className="xl:col-span-4">
          <Card className="h-full">
            <CardHeader title="Instructors" subtitle="Staff who author academy content" />
            <div className="space-y-2 px-4 pb-5 pt-4 sm:px-6">
              {Array.from(new Map(courses.map((c) => [c.author.id, c.author])).values()).map((a) => {
                const mine = courses.filter((c) => c.author.id === a.id);
                return (
                  <div key={a.id} className="k-row flex items-center gap-3 px-3 py-2.5">
                    <Avatar src={a.photo} name={a.name} size={36} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 text-[13px] font-medium">
                        {a.name} <Flag country={a.country} className="size-3.5" />
                      </div>
                      <div className="truncate text-[11.5px] text-fg-3">{mine.map((c) => c.category).join(" · ")}</div>
                    </div>
                    <div className="text-right">
                      <div className="k-num text-[13px]">{mine.length}</div>
                      <div className="text-[11px] text-fg-3">{mine.length === 1 ? "course" : "courses"}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </Reveal>
      </div>

      <CourseEditor
        course={editing}
        open={open}
        onOpenChange={setOpen}
        onSave={(c) => setCourses((cs) => (cs.some((x) => x.id === c.id) ? cs.map((x) => (x.id === c.id ? c : x)) : [c, ...cs]))}
      />
    </div>
  );
}
