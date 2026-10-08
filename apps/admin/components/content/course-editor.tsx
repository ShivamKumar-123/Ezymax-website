"use client";

import * as React from "react";
import { ArrowDown, ArrowUp, FileText, GripVertical, HelpCircle, ImagePlus, PlayCircle, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button, Chip, Dialog, DialogClose, Field, Flag, Input, Segmented, Toggle, cn } from "@ezymex/ui";
import { CNT_LANGS, type CntCourse, type CntLesson } from "@ezymex/mock/admin-growth-content";

export type CourseState = CntCourse & { langs: string[] };

const COVERS = ["trading-screen", "gold", "bitcoin", "analytics", "trader", "stock-market", "finance", "dashboard", "charts", "crypto-coins", "london", "skyline"];
const TYPE_ICON = { video: PlayCircle, article: FileText, quiz: HelpCircle } as const;

export function CourseEditor({ course, open, onOpenChange, onSave }: { course: CourseState | null; open: boolean; onOpenChange: (o: boolean) => void; onSave: (c: CourseState) => void }) {
  const [draft, setDraft] = React.useState<CourseState | null>(course);
  React.useEffect(() => setDraft(course), [course]);
  if (!draft) return null;
  const set = (p: Partial<CourseState>) => setDraft({ ...draft, ...p });
  const lessons = draft.lessons;
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= lessons.length) return;
    const next = [...lessons];
    [next[i], next[j]] = [next[j]!, next[i]!];
    set({ lessons: next });
  };
  const addLesson = (type: CntLesson["type"]) => {
    const l: CntLesson = { id: `l${Date.now()}`, title: type === "quiz" ? "Knowledge check" : type === "video" ? "New video lesson" : "New article", type, duration: type === "quiz" ? "5 Q" : type === "video" ? "5:00" : "4 min" };
    set({ lessons: [...lessons, l] });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      side="right"
      title={draft.id.startsWith("new") ? "New course" : "Edit course"}
      description={`${lessons.length} lessons · ${draft.langs.length} languages · ${draft.enrolments.toLocaleString("en-US")} enrolled`}
      footer={
        <>
          <DialogClose asChild>
            <Button size="sm" variant="ghost">
              Cancel
            </Button>
          </DialogClose>
          <Button
            size="sm"
            variant="ember"
            onClick={() => {
              if (!draft.title.trim()) return toast.error("Course title is required");
              onSave(draft);
              onOpenChange(false);
              toast.success(`${draft.title} saved`, { description: draft.status === "published" ? "Live in the Client Area Academy" : "Saved as draft" });
            }}
          >
            <Save /> Save course
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {/* cover */}
        <div>
          <div className="relative aspect-[16/7] overflow-hidden rounded-[16px] border border-line">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={draft.cover} alt="" className="absolute inset-0 size-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />
            <div className="absolute bottom-3 left-4 right-4">
              <Chip size="sm" tone="gold">
                {draft.level}
              </Chip>
              <div className="mt-1.5 truncate text-[17px] font-medium text-white">{draft.title || "Untitled course"}</div>
            </div>
          </div>
          <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1">
            {COVERS.map((c) => {
              const src = `/assets/photos/${c}.jpg`;
              return (
                <button key={c} type="button" onClick={() => set({ cover: src })} className={cn("relative h-10 w-16 shrink-0 overflow-hidden rounded-[8px] border-2 transition", draft.cover === src ? "border-ember" : "border-transparent opacity-60 hover:opacity-100")} aria-label={`Cover ${c}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt="" className="size-full object-cover" />
                </button>
              );
            })}
            <button type="button" onClick={() => toast.info("Upload cover", { description: "JPG or PNG, at least 1600×700" })} className="grid h-10 w-16 shrink-0 place-items-center rounded-[8px] border border-dashed border-line text-fg-3 hover:text-fg" aria-label="Upload cover">
              <ImagePlus className="size-4" />
            </button>
          </div>
        </div>

        <Field label="Title">
          <Input value={draft.title} onChange={(e) => set({ title: e.target.value })} />
        </Field>
        <Field label="Subtitle">
          <Input value={draft.subtitle} onChange={(e) => set({ subtitle: e.target.value })} />
        </Field>

        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="mb-1.5 text-[12.5px] font-medium text-fg-2">Level</div>
            <Segmented size="sm" value={draft.level} onChange={(v) => set({ level: v })} options={["Beginner", "Intermediate", "Advanced"] as const} />
          </div>
          <label className="flex items-center gap-2.5 text-[13px] text-fg-2">
            Published
            <Toggle checked={draft.status === "published"} onChange={(v) => set({ status: v ? "published" : "draft" })} label="Published" />
          </label>
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between text-[12.5px] font-medium text-fg-2">
            <span>Language availability</span>
            <span className="font-normal text-fg-3">{draft.langs.length} of {CNT_LANGS.length}</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {CNT_LANGS.map((l) => {
              const on = draft.langs.includes(l.code);
              return (
                <button
                  key={l.code}
                  type="button"
                  onClick={() => set({ langs: on ? draft.langs.filter((x) => x !== l.code) : [...draft.langs, l.code] })}
                  className={cn("inline-flex h-7 items-center gap-1.5 rounded-full border px-2 text-[11.5px] font-medium uppercase", on ? "border-ember/35 bg-ember-soft text-fg" : "border-line bg-surface-2 text-fg-3 hover:text-fg-2")}
                >
                  <Flag country={l.flag} className="size-3.5" />
                  {l.code}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="k-label">Lessons</span>
            <div className="flex gap-1">
              {(["video", "article", "quiz"] as const).map((t) => {
                const I = TYPE_ICON[t];
                return (
                  <Button key={t} size="xs" variant="surface" onClick={() => addLesson(t)}>
                    <Plus className="!size-3" />
                    <I className="!size-3.5" /> <span className="capitalize">{t}</span>
                  </Button>
                );
              })}
            </div>
          </div>
          <div className="space-y-1.5">
            {lessons.map((l, i) => {
              const I = TYPE_ICON[l.type];
              return (
                <div key={l.id} className="k-row group flex items-center gap-2 py-1.5 pl-2 pr-1.5">
                  <GripVertical className="size-4 shrink-0 text-fg-3" />
                  <span className="k-num w-5 shrink-0 text-center text-[11.5px] text-fg-3">{i + 1}</span>
                  <span className={cn("grid size-7 shrink-0 place-items-center rounded-full", l.type === "quiz" ? "bg-gold-soft text-gold" : l.type === "video" ? "bg-ember-soft text-ember" : "bg-info-soft text-info")}>
                    <I className="size-3.5" />
                  </span>
                  <input
                    value={l.title}
                    onChange={(e) => set({ lessons: lessons.map((x) => (x.id === l.id ? { ...x, title: e.target.value } : x)) })}
                    className="min-w-0 flex-1 rounded-md bg-transparent px-1 py-1 text-[13px] outline-none focus:bg-surface-3"
                  />
                  <span className="k-num shrink-0 text-[11.5px] text-fg-3">{l.duration}</span>
                  <div className="flex shrink-0 opacity-60 transition-opacity group-hover:opacity-100">
                    <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="grid size-7 place-items-center rounded-full text-fg-3 hover:bg-surface-3 hover:text-fg disabled:opacity-30" aria-label="Move up">
                      <ArrowUp className="size-3.5" />
                    </button>
                    <button type="button" onClick={() => move(i, 1)} disabled={i === lessons.length - 1} className="grid size-7 place-items-center rounded-full text-fg-3 hover:bg-surface-3 hover:text-fg disabled:opacity-30" aria-label="Move down">
                      <ArrowDown className="size-3.5" />
                    </button>
                    <button type="button" onClick={() => set({ lessons: lessons.filter((x) => x.id !== l.id) })} className="grid size-7 place-items-center rounded-full text-fg-3 hover:bg-down-soft hover:text-down" aria-label="Delete lesson">
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
            {lessons.length === 0 && <div className="rounded-[14px] border border-dashed border-line py-6 text-center text-[12.5px] text-fg-3">No lessons yet. Add a video, article or quiz.</div>}
          </div>
        </div>
      </div>
    </Dialog>
  );
}
