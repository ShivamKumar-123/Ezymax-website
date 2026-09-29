"use client";

import * as React from "react";
import { toast } from "sonner";
import { FilePlus2, Loader2, Save, Search, Sparkles, Trash2 } from "lucide-react";
import { Button, Card, CardHeader, Chip, Field, Input, KpiCard, PageHeader, Segmented, cn } from "@kalks/ui";
import { Rich, errMsg, sapi, usePerms } from "./common";
import { useConfirm } from "@/components/confirm";

type Article = { id: number; slug: string; title: string; category: string; body: string; tags: string[]; status: "published" | "draft"; source: "seed" | "glossary" | "staff"; usedCount: number; updatedBy: string; updatedAt: string };
type ListResp = { items: Article[]; categories: { category: string; count: number }[]; totals: { published: number; drafts: number; used: number } };
type TestResp = { hits: { slug: string; title: string; category: string; score: number }[]; answer: string; handover: string | null; confidence: number; engine: string; model: string | null };

const EMPTY: Omit<Article, "id" | "slug" | "usedCount" | "updatedBy" | "updatedAt" | "source"> = { title: "", category: "", body: "", tags: [], status: "published" };

/** AI knowledge base: the articles the support bot answers from (help articles + Academy glossary + staff articles). */
export function LiveKnowledge() {
  const [ask, confirmDialog] = useConfirm();
  const { can } = usePerms();
  const [data, setData] = React.useState<ListResp | null>(null);
  const [source, setSource] = React.useState<"help" | "glossary">("help");
  const [q, setQ] = React.useState("");
  const [edit, setEdit] = React.useState<(typeof EMPTY & { id?: number; slug?: string }) | null>(null);
  const [tags, setTags] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [question, setQuestion] = React.useState("");
  const [test, setTest] = React.useState<TestResp | null>(null);
  const [testing, setTesting] = React.useState(false);

  const load = React.useCallback(async () => {
    const r = await sapi<ListResp>(`kb?${new URLSearchParams(q.trim() ? { q: q.trim() } : {})}`);
    if (r.ok) setData(r.data);
  }, [q]);
  React.useEffect(() => {
    const t = setTimeout(() => void load(), 200);
    return () => clearTimeout(t);
  }, [load]);

  const rows = (data?.items ?? []).filter((a) => (source === "glossary" ? a.source === "glossary" : a.source !== "glossary"));
  const open = (a: Article | null) => {
    setEdit(a ? { id: a.id, slug: a.slug, title: a.title, category: a.category, body: a.body, tags: a.tags, status: a.status } : { ...EMPTY });
    setTags(a ? a.tags.join(", ") : "");
  };
  const save = async () => {
    if (!edit) return;
    setSaving(true);
    const body = { ...edit, tags: tags.split(",").map((t) => t.trim()).filter(Boolean) };
    const r = await sapi<{ item: Article }>(edit.id ? `kb/${edit.id}` : "kb", { method: edit.id ? "PUT" : "POST", body });
    setSaving(false);
    if (!r.ok) return toast.error("Not saved", { description: errMsg(r.data) });
    toast.success(r.data.item.status === "published" ? "Article published" : "Draft saved", { description: "The assistant uses it from the next question." });
    open(r.data.item);
    void load();
  };
  const remove = async () => {
    if (!edit?.id || !(await ask({ title: `Delete “${edit.title}”?`, text: "The assistant stops using it.", confirm: "Delete", tone: "danger" }))) return;
    const r = await sapi(`kb/${edit.id}`, { method: "DELETE" });
    if (!r.ok) return toast.error("Not deleted", { description: errMsg(r.data) });
    setEdit(null);
    void load();
  };
  const runTest = async () => {
    if (!question.trim()) return;
    setTesting(true);
    const r = await sapi<TestResp>("kb/test", { body: { question } });
    setTesting(false);
    if (!r.ok) return toast.error("Test failed", { description: errMsg(r.data) });
    setTest(r.data);
  };

  return (
    <div>
      {confirmDialog}
      <PageHeader title="AI knowledge base" subtitle="Articles the support assistant answers from. It hands over to an agent when these don't cover a question." actions={can("support.write") ? <Button variant="ember" onClick={() => open(null)}><FilePlus2 /> New article</Button> : undefined} />
      <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label="Published" value={String(data?.totals.published ?? "–")} />
        <KpiCard label="Drafts" value={String(data?.totals.drafts ?? "–")} />
        <KpiCard label="Times cited" value={String(data?.totals.used ?? "–")} />
        <KpiCard label="Categories" value={String(data?.categories.length ?? "–")} />
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Card className="xl:col-span-5">
          <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
            <Segmented size="xs" value={source} onChange={setSource} options={[{ value: "help", label: "Help articles" }, { value: "glossary", label: "Glossary" }]} />
            <div className="ml-auto flex h-8 min-w-[160px] flex-1 items-center gap-2 rounded-full border border-line bg-surface-2 px-3">
              <Search className="size-3.5 text-fg-3" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search articles" className="min-w-0 flex-1 bg-transparent text-[12.5px] outline-none" />
            </div>
          </div>
          <div className="max-h-[640px] overflow-y-auto p-2">
            {!data && <div className="py-10 text-center text-fg-3"><Loader2 className="mx-auto size-5 animate-spin" /></div>}
            {rows.map((a) => (
              <button key={a.id} onClick={() => open(a)} className={cn("block w-full rounded-xl px-3 py-2.5 text-left hover:bg-surface-2", edit?.id === a.id && "bg-surface-3")}>
                <span className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium">{a.title}</span>
                  {a.status === "draft" && <Chip size="sm" tone="warn">Draft</Chip>}
                  {a.usedCount > 0 && <span className="k-num text-[11px] text-fg-3">{a.usedCount}×</span>}
                </span>
                <span className="mt-0.5 block truncate text-[11.5px] text-fg-3">{a.category} · {a.slug}</span>
              </button>
            ))}
            {data && rows.length === 0 && <div className="py-10 text-center text-[13px] text-fg-3">No articles.</div>}
          </div>
        </Card>

        <div className="space-y-4 xl:col-span-7">
          {edit && (
            <Card>
              <CardHeader title={edit.id ? "Edit article" : "New article"} subtitle={edit.slug ? `Slug ${edit.slug}` : "Plain text; **bold** and '-' lists render in the chat."} />
              <div className="space-y-3 px-6 pb-6 pt-4">
                <Field label="Title"><Input value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} disabled={!can("support.write")} /></Field>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Field label="Category">
                    <Input value={edit.category} list="kb-cats" onChange={(e) => setEdit({ ...edit, category: e.target.value })} disabled={!can("support.write")} />
                    <datalist id="kb-cats">{data?.categories.map((c) => <option key={c.category} value={c.category} />)}</datalist>
                  </Field>
                  <Field label="Tags (comma separated)"><Input value={tags} onChange={(e) => setTags(e.target.value)} disabled={!can("support.write")} /></Field>
                </div>
                <Field label="Body">
                  <textarea value={edit.body} onChange={(e) => setEdit({ ...edit, body: e.target.value })} rows={12} disabled={!can("support.write")} className="w-full rounded-xl border border-line bg-surface-2 px-3.5 py-2.5 text-[13.5px] leading-relaxed outline-none focus:border-ember/50" />
                </Field>
                {can("support.write") && (
                  <div className="flex flex-wrap items-center gap-2">
                    <Segmented size="xs" value={edit.status} onChange={(v) => setEdit({ ...edit, status: v })} options={[{ value: "published", label: "Published" }, { value: "draft", label: "Draft" }]} />
                    {edit.id && <Button size="sm" variant="ghost" onClick={() => void remove()}><Trash2 /> Delete</Button>}
                    <Button size="sm" variant="ember" className="ml-auto" disabled={saving} onClick={() => void save()}><Save /> Save</Button>
                  </div>
                )}
              </div>
            </Card>
          )}
          <Card>
            <CardHeader title="Test the assistant" subtitle="Which articles it finds and how it would answer (nothing is sent to a client)." icon={<Sparkles />} />
            <div className="space-y-3 px-6 pb-6 pt-4">
              <form onSubmit={(e) => { e.preventDefault(); void runTest(); }} className="flex gap-2">
                <Input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="e.g. How long does verification take?" />
                <Button variant="surface" disabled={testing || !question.trim()}>{testing ? <Loader2 className="animate-spin" /> : "Ask"}</Button>
              </form>
              {test && (
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-1.5">
                    {test.hits.map((h) => <Chip key={h.slug} size="sm" tone="gold">{h.title} · {h.score}</Chip>)}
                    {test.hits.length === 0 && <span className="text-[12px] text-fg-3">No matching article.</span>}
                  </div>
                  <div className="rounded-2xl border border-line bg-surface-2 px-4 py-3 text-[13.5px] leading-relaxed">
                    <Rich text={test.answer} />
                  </div>
                  <div className="text-[11.5px] text-fg-3">
                    {test.engine === "claude" ? `Claude (${test.model ?? "model"})` : test.engine === "rules" ? "Routed by rules" : "Help centre fallback (no AI key)"} · {test.confidence}% match
                    {test.handover && <span className="text-warn"> · would hand over: {test.handover}</span>}
                  </div>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
