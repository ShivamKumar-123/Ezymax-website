"use client";

import * as React from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowUp, BookOpen, Brain, CircleHelp, FilePlus2, Plus, RefreshCw, Save, Sparkles, Tag, ThumbsUp, UserRound, X } from "lucide-react";
import { toast } from "sonner";
import {
  Button,
  Card,
  CardHeader,
  Chip,
  DataTable,
  Field,
  Input,
  KpiCard,
  PageHeader,
  Progress,
  Reveal,
  Segmented,
  StatusChip,
  Toggle,
  cn,
  formatNumber,
  type Column,
} from "@kalks/ui";
import { SUP_ARTICLES, SUP_BOT_TESTS, SUP_KB_CATEGORIES, type SupArticle } from "@kalks/mock/admin-growth-support";
import { AiSpark } from "@/components/support/shared";
import { IS_DEMO as IS_DEMO_MODE } from "@kalks/mock/mode";
import { LiveKnowledge } from "@/components/support-live/knowledge";

const STATUS_MAP: Record<SupArticle["status"], { s: string; label: string }> = {
  published: { s: "active", label: "Published" },
  draft: { s: "draft", label: "Draft" },
  review: { s: "review", label: "In review" },
  stale: { s: "expired", label: "Stale · 60d+" },
};

const GAPS = [
  { q: "Can I withdraw to a Binance Pay ID?", count: 48, trend: "+12" },
  { q: "Do you support MT4 as well as MT5?", count: 31, trend: "+4" },
  { q: "What is the minimum lot on XAUUSD Cent?", count: 22, trend: "+9" },
  { q: "Is copy trading available in Pakistan?", count: 17, trend: "+2" },
  { q: "How do I change my account currency to EUR?", count: 12, trend: "+1" },
];

function DemoKnowledgePage() {
  const [articles, setArticles] = React.useState<SupArticle[]>(SUP_ARTICLES);
  const [cat, setCat] = React.useState<string>("All");
  const [edit, setEdit] = React.useState<SupArticle>(SUP_ARTICLES[0]!);
  const [tagDraft, setTagDraft] = React.useState("");
  const [aiOnly, setAiOnly] = React.useState(true);

  const rows = articles.filter((a) => cat === "All" || a.category === cat);
  const totalUsed = articles.reduce((s, a) => s + a.usedIn, 0);
  const published = articles.filter((a) => a.status === "published").length;

  const save = (publish: boolean) => {
    const next: SupArticle = { ...edit, status: publish ? "published" : edit.status === "published" ? "published" : "draft", updated: "24 Sep 2026", updatedBy: "Priya Nair" };
    setArticles((as) => (as.some((a) => a.id === next.id) ? as.map((a) => (a.id === next.id ? next : a)) : [next, ...as]));
    setEdit(next);
    toast.success(publish ? "Article published" : "Draft saved", { description: publish ? "Re-embedded · Claude will use it within ~30 seconds" : next.title });
  };

  const cols: Column<SupArticle>[] = [
    {
      key: "title",
      header: "Article",
      cell: (a) => (
        <div className="flex min-w-0 items-center gap-3">
          <span className={cn("grid size-8 shrink-0 place-items-center rounded-xl border", a.id === edit.id ? "border-ember/40 bg-ember-soft text-ember" : "border-line bg-surface-2 text-fg-3")}>
            <BookOpen className="size-4" />
          </span>
          <div className="min-w-0">
            <div className="truncate font-medium">{a.title}</div>
            <div className="text-[11.5px] text-fg-3">
              {a.category} · <span className="font-mono">{a.id}</span> · {a.languages} lang
            </div>
          </div>
        </div>
      ),
      sort: (a) => a.title,
    },
    { key: "status", header: "Status", cell: (a) => <StatusChip status={STATUS_MAP[a.status].s} label={STATUS_MAP[a.status].label} /> },
    {
      key: "used",
      header: "Answers",
      align: "right",
      sort: (a) => a.usedIn,
      cell: (a) => (
        <div className="flex items-center justify-end gap-2">
          <span className="k-num font-medium">{formatNumber(a.usedIn, 0)}</span>
          <span className="hidden h-1.5 w-14 overflow-hidden rounded-full bg-surface-3 md:block">
            <span className="block h-full rounded-full bg-gradient-to-r from-ember to-gold" style={{ width: `${(a.usedIn / 6400) * 100}%` }} />
          </span>
        </div>
      ),
    },
    { key: "helpful", header: "Helpful", align: "right", hideOn: "md", sort: (a) => a.helpful, cell: (a) => <span className={cn("k-num", a.helpful >= 88 ? "text-up" : a.helpful >= 75 ? "text-fg-2" : a.helpful ? "text-warn" : "text-fg-3")}>{a.helpful ? `${a.helpful}%` : "—"}</span> },
    { key: "updated", header: "Updated", align: "right", hideOn: "lg", cell: (a) => <div className="whitespace-nowrap text-[12px]"><div className="text-fg-2">{a.updated.replace(" 2026", "")}</div><div className="text-fg-3">{a.updatedBy.split(" ")[0]}</div></div> },
  ];

  return (
    <div className="pb-16">
      <PageHeader
        title="AI knowledge base"
        subtitle="Everything Claude knows. Articles are embedded, cited in answers and scoped per tenant."
        actions={
          <>
            <Button variant="surface" onClick={() => toast.success("Re-index started", { description: `${articles.length} articles · 22 languages · ETA 2 min` })}>
              <RefreshCw /> Re-index
            </Button>
            <Button
              variant="ember"
              onClick={() => {
                setEdit({ id: `kb${120 + articles.length}`, title: "", category: "Deposits", body: "", tags: [], usedIn: 0, helpful: 0, updated: "24 Sep 2026", updatedBy: "Priya Nair", status: "draft", languages: 1, tenants: "All tenants" });
                toast.info("New article", { description: "Write it in English — Claude translates to 21 languages on publish" });
              }}
            >
              <Plus /> New article
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Articles live" value={<span className="k-num">{published}<span className="text-fg-3">/{articles.length}</span></span>} icon={<BookOpen />} chip="2 need review" chipTone="warn" />
        <KpiCard label="AI answers citing KB · 30d" value={<span className="k-num">{formatNumber(totalUsed, 0)}</span>} icon={<Sparkles />} chip="+18.4% vs Aug" chipTone="up" delay={0.05} />
        <KpiCard label="Answer helpfulness" value={<span className="k-num">87.9%</span>} icon={<ThumbsUp />} chip="thumbs-up rate" delay={0.1} />
        <KpiCard label="Knowledge gaps" value={<span className="k-num">14</span>} icon={<CircleHelp />} hot illustration="light_bulb" chip="130 unanswered questions" chipTone="ember" delay={0.15} />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Reveal delay={0.05} className="xl:col-span-7">
          <Card className="h-full">
            <CardHeader title="Articles" subtitle="Click an article to edit" icon={<BookOpen />} />
            <div className="mt-4 px-4 pb-5 sm:px-6">
              <DataTable
                columns={cols}
                rows={rows}
                pageSize={8}
                dense
                rowKey={(a) => a.id}
                onRowClick={(a) => setEdit(a)}
                search={(a) => `${a.title} ${a.tags.join(" ")} ${a.body}`}
                searchPlaceholder="Search articles…"
                exportName="knowledge-base"
                toolbar={
                  <div className="-mx-1 max-w-full overflow-x-auto px-1 [scrollbar-width:none]">
                    <Segmented size="xs" value={cat} onChange={setCat} options={["All", ...SUP_KB_CATEGORIES.slice(0, 6)]} />
                  </div>
                }
              />
            </div>
          </Card>
        </Reveal>

        <Reveal delay={0.1} className="xl:col-span-5">
          <Card className="flex h-full flex-col">
            <CardHeader
              title={edit.title ? "Edit article" : "New article"}
              subtitle={
                <span>
                  <span className="font-mono">{edit.id}</span> · {edit.usedIn ? `cited in ${formatNumber(edit.usedIn, 0)} answers` : "not yet used by Claude"}
                </span>
              }
              icon={<FilePlus2 />}
              action={<StatusChip status={STATUS_MAP[edit.status].s} label={STATUS_MAP[edit.status].label} />}
            />
            <div className="mt-4 flex flex-1 flex-col gap-4 px-4 pb-6 sm:px-6">
              <Field label="Title">
                <Input value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} placeholder="e.g. How long does a USDT withdrawal take?" />
              </Field>
              <div>
                <div className="mb-1.5 text-[12.5px] font-medium text-fg-2">Category</div>
                <div className="flex flex-wrap gap-1.5">
                  {SUP_KB_CATEGORIES.map((c) => (
                    <button key={c} onClick={() => setEdit({ ...edit, category: c })} className={cn("rounded-full border px-2.5 py-1 text-[12px] transition-colors", edit.category === c ? "border-ember/40 bg-ember-soft text-ember" : "border-line bg-surface-2 text-fg-2 hover:text-fg")}>
                      {c}
                    </button>
                  ))}
                </div>
              </div>
              <label className="flex flex-1 flex-col gap-1.5">
                <span className="flex items-center justify-between text-[12.5px] font-medium text-fg-2">
                  Body <span className="k-num font-normal text-fg-3">{edit.body.length} chars · ~{Math.ceil(edit.body.length / 4)} tokens</span>
                </span>
                <textarea
                  value={edit.body}
                  onChange={(e) => setEdit({ ...edit, body: e.target.value })}
                  rows={7}
                  placeholder="Write the policy in plain language. Claude quotes facts from here verbatim — include numbers, limits and exceptions."
                  className="min-h-[150px] w-full flex-1 resize-none rounded-[14px] border border-line bg-surface-2 px-3.5 py-3 text-[13.5px] leading-relaxed text-fg outline-none placeholder:text-fg-3 focus:border-ember/50 focus:ring-4 focus:ring-ember/10"
                />
              </label>
              <div>
                <div className="mb-1.5 text-[12.5px] font-medium text-fg-2">Tags</div>
                <div className="flex min-h-11 flex-wrap items-center gap-1.5 rounded-[14px] border border-line bg-surface-2 px-2.5 py-2">
                  {edit.tags.map((t) => (
                    <span key={t} className="inline-flex items-center gap-1 rounded-full bg-surface-3 px-2 py-0.5 font-mono text-[11.5px] text-fg-2">
                      <Tag className="size-3 text-fg-3" />
                      {t}
                      <button onClick={() => setEdit({ ...edit, tags: edit.tags.filter((x) => x !== t) })} className="text-fg-3 hover:text-down" aria-label={`Remove ${t}`}>
                        <X className="size-3" />
                      </button>
                    </span>
                  ))}
                  <input
                    value={tagDraft}
                    onChange={(e) => setTagDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && tagDraft.trim()) {
                        e.preventDefault();
                        setEdit({ ...edit, tags: [...edit.tags, tagDraft.trim().toLowerCase()] });
                        setTagDraft("");
                      }
                    }}
                    placeholder="Add tag + Enter"
                    className="min-w-[110px] flex-1 bg-transparent px-1 text-[12.5px] outline-none placeholder:text-fg-3"
                  />
                </div>
              </div>
              <div className="flex items-center justify-between rounded-[14px] border border-line bg-surface-2/60 px-3.5 py-2.5">
                <div className="text-[12.5px]">
                  <div className="font-medium">Use for AI answers</div>
                  <div className="text-fg-3">Scope: {edit.tenants}</div>
                </div>
                <Toggle checked={aiOnly} onChange={(v) => { setAiOnly(v); toast.info(v ? "Claude may cite this article" : "Article hidden from Claude, still visible in Help Centre"); }} label="Use for AI" />
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={() => toast.success("Translation queued", { description: "21 languages · machine translated, human review for AR, ES, PT" })}>
                  Translate
                </Button>
                <Button variant="surface" size="sm" onClick={() => save(false)}>
                  <Save /> Save draft
                </Button>
                <Button variant="ember" size="sm" onClick={() => (edit.title.trim() && edit.body.trim() ? save(true) : toast.error("Title and body are required"))}>
                  Publish
                </Button>
              </div>
            </div>
          </Card>
        </Reveal>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Reveal delay={0.05} className="xl:col-span-8">
          <BotPlayground articles={articles} onOpen={(id) => { const a = articles.find((x) => x.id === id); if (a) setEdit(a); }} />
        </Reveal>
        <Reveal delay={0.1} className="xl:col-span-4">
          <Card className="flex h-full flex-col">
            <CardHeader title="Knowledge gaps" subtitle="Questions Claude couldn't answer · 7d" icon={<CircleHelp />} />
            <div className="mt-4 flex-1 space-y-2 px-4 pb-5 sm:px-6">
              {GAPS.map((g) => (
                <div key={g.q} className="k-row flex items-center gap-3 px-3.5 py-2.5">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-medium">{g.q}</div>
                    <div className="mt-0.5 text-[11.5px] text-fg-3">
                      <span className="k-num text-fg-2">{g.count}</span> asks · <span className="k-num text-warn">{g.trend}</span> this week
                    </div>
                  </div>
                  <Button
                    size="xs"
                    variant="surface"
                    onClick={() => {
                      setEdit({ id: `kb${140 + g.count}`, title: g.q, category: "Platform", body: "", tags: ["gap"], usedIn: 0, helpful: 0, updated: "24 Sep 2026", updatedBy: "Priya Nair", status: "draft", languages: 1, tenants: "All tenants" });
                      toast.info("Draft created from gap", { description: "Claude pre-filled 3 sample conversations for context" });
                    }}
                  >
                    <Plus className="!size-3" /> Article
                  </Button>
                </div>
              ))}
            </div>
          </Card>
        </Reveal>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function BotPlayground({ articles, onOpen }: { articles: SupArticle[]; onOpen: (id: string) => void }) {
  const [q, setQ] = React.useState(SUP_BOT_TESTS[0]!.q);
  const [asked, setAsked] = React.useState<((typeof SUP_BOT_TESTS)[number] & { question: string }) | null>({ ...SUP_BOT_TESTS[0]!, question: SUP_BOT_TESTS[0]!.q });
  const [typed, setTyped] = React.useState("");
  const [thinking, setThinking] = React.useState(false);

  const ask = (question: string) => {
    if (!question.trim()) return;
    const t = question.toLowerCase();
    const hit =
      SUP_BOT_TESTS.find((x) => x.q.toLowerCase() === t) ??
      (/withdraw|pending|usdt/.test(t) ? SUP_BOT_TESTS[0] : /islam|swap/.test(t) ? SUP_BOT_TESTS[1] : /stop|refund|nfp|spread/.test(t) ? SUP_BOT_TESTS[2] : /leverage/.test(t) ? SUP_BOT_TESTS[3] : null);
    const res = hit ?? { q: question, answer: "I don't have a published article that answers this confidently. I'd hand this conversation to a human agent and log it as a knowledge gap.", cites: [], confidence: 34, handoff: true };
    setThinking(true);
    setAsked(null);
    setTyped("");
    setTimeout(() => {
      setThinking(false);
      setAsked({ ...res, question });
    }, 700);
  };

  React.useEffect(() => {
    if (!asked) return;
    let i = 0;
    const t = setInterval(() => {
      i += 4;
      setTyped(asked.answer.slice(0, i));
      if (i >= asked.answer.length) clearInterval(t);
    }, 16);
    return () => clearInterval(t);
  }, [asked]);

  const conf = asked?.confidence ?? 0;
  return (
    <Card className="relative h-full overflow-hidden">
      <div className="pointer-events-none absolute -right-20 -top-24 size-72 rounded-full bg-ember/10 blur-3xl" />
      <CardHeader title="Test the bot" subtitle="Ask as a client would. Answers use only published articles for the selected tenant." icon={<Brain />} action={<Chip tone="gold"><Sparkles className="size-3" /> Claude · KB mode</Chip>} />
      <div className="relative mt-4 px-4 pb-6 sm:px-6">
        <div className="mb-2.5 flex flex-wrap gap-1.5">
          {SUP_BOT_TESTS.map((t) => (
            <button key={t.q} onClick={() => { setQ(t.q); ask(t.q); }} className="rounded-full border border-line bg-surface-2 px-3 py-1 text-[12px] text-fg-2 transition-colors hover:border-ember/40 hover:text-fg">
              {t.q}
            </button>
          ))}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            ask(q);
          }}
          className="flex items-center gap-2 rounded-[20px] border border-ember/30 bg-surface-2 p-1.5 pl-2 shadow-[0_0_0_4px_rgba(255,90,31,0.06),0_10px_30px_-12px_rgba(255,90,31,0.4)]"
        >
          <AiSpark size={30} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ask anything a client might ask…" className="min-w-0 flex-1 bg-transparent px-2 text-[14px] outline-none placeholder:text-fg-3" />
          <Button type="submit" variant="ember" size="sm" className="!size-9 !px-0" aria-label="Ask">
            <ArrowUp />
          </Button>
        </form>

        <div className="mt-4 min-h-[210px]">
          <AnimatePresence mode="wait">
            {thinking && (
              <motion.div key="t" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-2.5 text-[13px] text-fg-3">
                <AiSpark size={22} className="animate-pulse" /> Searching {articles.filter((a) => a.status === "published").length} articles…
              </motion.div>
            )}
            {asked && (
              <motion.div key={asked.question} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_200px]">
                <div>
                  <div className="mb-2 flex items-center gap-2 text-[12px] text-fg-3">
                    <UserRound className="size-3.5" /> “{asked.question}”
                  </div>
                  <div className="rounded-[18px] rounded-tl-md border border-gold/25 bg-[linear-gradient(135deg,rgba(255,90,31,0.10),rgba(233,185,73,0.06))] px-4 py-3 text-[13.5px] leading-relaxed">
                    <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium text-gold">
                      <AiSpark size={14} /> Claude · AI
                    </div>
                    {typed}
                    {typed.length < asked.answer.length && <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse bg-ember align-middle" />}
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-1.5">
                    <span className="text-[11.5px] text-fg-3">Cited:</span>
                    {asked.cites.length ? (
                      asked.cites.map((id) => {
                        const a = articles.find((x) => x.id === id);
                        return (
                          <button key={id} onClick={() => onOpen(id)} className="inline-flex items-center gap-1.5 rounded-full border border-gold/30 bg-gold-soft px-2.5 py-1 text-[11.5px] text-gold hover:brightness-125">
                            <BookOpen className="size-3" />
                            {a?.title ?? id}
                          </button>
                        );
                      })
                    ) : (
                      <Chip size="sm" tone="warn">No matching article</Chip>
                    )}
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="k-row px-4 py-3">
                    <div className="text-[11px] uppercase tracking-wider text-fg-3">Confidence</div>
                    <div className={cn("k-num mt-1 text-[26px] font-semibold", conf >= 85 ? "text-up" : conf >= 70 ? "text-gold" : "text-warn")}>{conf}%</div>
                    <Progress value={conf} tone={conf >= 85 ? "up" : conf >= 70 ? "gold" : "warn"} className="mt-2" />
                    <div className="mt-2 text-[11px] text-fg-3">Handoff threshold 70%</div>
                  </div>
                  <div className={cn("rounded-[14px] border px-4 py-3 text-[12px]", asked.handoff ? "border-warn/30 bg-warn-soft text-warn" : "border-up/25 bg-up-soft text-up")}>
                    {asked.handoff ? "Would hand over to a human agent" : "Would resolve without a human"}
                  </div>
                </div>
              </motion.div>
            )}
            {!thinking && !asked && (
              <motion.div key="e" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid h-[210px] place-items-center rounded-[18px] border border-dashed border-line text-center">
                <div>
                  <AiSpark size={36} className="mx-auto" />
                  <div className="mt-3 text-[13.5px] font-medium">Try a question</div>
                  <div className="mt-1 text-[12.5px] text-fg-3">See the exact answer, the articles it cites and whether it would hand over.</div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </Card>
  );
}

/** Demo builds: the mock showcase. Live builds: services/support. */
export default function KnowledgePage() {
  return IS_DEMO_MODE ? <DemoKnowledgePage /> : <LiveKnowledge />;
}
