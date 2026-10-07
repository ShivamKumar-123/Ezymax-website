"use client";

import * as React from "react";
import { AnimatePresence, motion } from "motion/react";
import { Angry, Frown, Meh, NotebookPen, Plus, Smile, Zap } from "lucide-react";
import { toast } from "sonner";
import { Button, Card, CardHeader, Chip, Dialog, DialogClose, Field, Input, Segmented, SymbolAvatar, cn, formatDateTime, formatMoney } from "@/components/kit";
import { JOURNAL, type JournalNote, type Mood } from "@kalks/mock/academy";

const MOODS: Record<Mood, { label: string; icon: typeof Smile; tone: "up" | "info" | "warn" | "down" | "ember" }> = {
  confident: { label: "Confident", icon: Smile, tone: "up" },
  calm: { label: "Calm", icon: Meh, tone: "info" },
  excited: { label: "Excited", icon: Zap, tone: "ember" },
  anxious: { label: "Anxious", icon: Frown, tone: "warn" },
  frustrated: { label: "Frustrated", icon: Angry, tone: "down" },
};

const TAG_OPTIONS = ["plan", "patience", "revenge", "news", "overtrading", "rule-break", "gold", "london", "fatigue"];

function AddNoteDialog({ onAdd }: { onAdd: (n: JournalNote) => void }) {
  const [open, setOpen] = React.useState(false);
  const [title, setTitle] = React.useState("");
  const [body, setBody] = React.useState("");
  const [symbol, setSymbol] = React.useState("XAUUSD");
  const [mood, setMood] = React.useState<Mood>("calm");
  const [tags, setTags] = React.useState<string[]>(["plan"]);
  const reset = () => {
    setTitle("");
    setBody("");
    setTags(["plan"]);
    setMood("calm");
  };
  return (
    <Dialog
      open={open}
      onOpenChange={setOpen}
      title="New journal note"
      description="Coach reads your notes to personalise the weekly review."
      width={540}
      trigger={
        <Button size="sm" variant="ember">
          <Plus /> Add note
        </Button>
      }
      footer={
        <>
          <DialogClose asChild>
            <Button variant="ghost">Cancel</Button>
          </DialogClose>
          <Button
            variant="ember"
            disabled={!title.trim()}
            onClick={() => {
              onAdd({ id: `j${Date.now()}`, date: new Date().toISOString(), title: title.trim(), body: body.trim() || "No details added.", tags, mood, symbol });
              toast.success("Journal note saved", { description: "Kalks Coach will factor it into your next review." });
              setOpen(false);
              reset();
            }}
          >
            Save note
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Title">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Held gold long through CPI" autoFocus />
        </Field>
        <div>
          <div className="mb-2 text-[12.5px] font-medium text-fg-2">Symbol</div>
          <div className="flex flex-wrap gap-1.5">
            {["XAUUSD", "EURUSD", "GBPJPY", "NAS100", "BTCUSD", "US30", "USOIL"].map((sym) => (
              <button key={sym} type="button" onClick={() => setSymbol(sym)} className={cn("inline-flex items-center gap-1.5 rounded-full border py-1 pl-1 pr-2.5 text-[12px] transition-colors", symbol === sym ? "border-ember/40 bg-ember-soft text-fg" : "border-line bg-surface-2 text-fg-2 hover:bg-surface-3")}>
                <SymbolAvatar symbol={sym} size={16} /> {sym}
              </button>
            ))}
          </div>
        </div>
        <Field label="What happened?" hint="Entry reason, emotions, what you'd change">
          <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} className="w-full resize-none rounded-[14px] border border-line bg-surface-2 px-3.5 py-3 text-sm text-fg outline-none placeholder:text-fg-3 focus:border-ember/50 focus:ring-4 focus:ring-ember/10" placeholder="I entered after the retest of…" />
        </Field>
        <div>
          <div className="mb-2 text-[12.5px] font-medium text-fg-2">Mood</div>
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(MOODS) as Mood[]).map((m) => {
              const M = MOODS[m];
              const on = mood === m;
              return (
                <button key={m} type="button" onClick={() => setMood(m)} className={cn("inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12.5px] transition-colors", on ? "border-ember/40 bg-ember-soft text-ember" : "border-line bg-surface-2 text-fg-2 hover:bg-surface-3")}>
                  <M.icon className="size-3.5" /> {M.label}
                </button>
              );
            })}
          </div>
        </div>
        <div>
          <div className="mb-2 text-[12.5px] font-medium text-fg-2">Tags</div>
          <div className="flex flex-wrap gap-1.5">
            {TAG_OPTIONS.map((t) => {
              const on = tags.includes(t);
              return (
                <button key={t} type="button" onClick={() => setTags((x) => (on ? x.filter((y) => y !== t) : [...x, t]))} className={cn("rounded-full border px-2.5 py-1 font-mono text-[11.5px] transition-colors", on ? "border-gold/40 bg-gold-soft text-gold" : "border-line bg-surface-2 text-fg-3 hover:text-fg-2")}>
                  #{t}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </Dialog>
  );
}

export function JournalCard() {
  const [notes, setNotes] = React.useState<JournalNote[]>(JOURNAL);
  const [filter, setFilter] = React.useState<"all" | "wins" | "losses">("all");
  const list = notes.filter((n) => filter === "all" || (filter === "wins" ? (n.pnl ?? 0) > 0 : (n.pnl ?? 0) < 0));
  return (
    <Card className="flex h-full flex-col">
      <CardHeader
        title="Trading journal"
        subtitle={`${notes.length} notes · Coach reads these`}
        icon={<NotebookPen />}
        action={<AddNoteDialog onAdd={(n) => setNotes((x) => [n, ...x])} />}
      />
      <div className="mt-4 px-4 sm:px-6">
        <Segmented size="xs" value={filter} onChange={setFilter} options={[{ value: "all", label: "All" }, { value: "wins", label: "Wins" }, { value: "losses", label: "Losses" }]} />
      </div>
      <div className="mt-3 grid flex-1 grid-cols-1 gap-2 px-4 pb-5 sm:px-6 md:grid-cols-2">
        <AnimatePresence initial={false}>
          {list.map((n) => {
            const M = MOODS[n.mood];
            return (
              <motion.div key={n.id} layout initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="k-row flex flex-col px-4 py-3.5">
                <div className="flex items-start gap-3">
                  {n.symbol && <SymbolAvatar symbol={n.symbol} size={24} />}
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13.5px] font-medium">{n.title}</div>
                    <div className="k-num text-[11px] text-fg-3">
                      {formatDateTime(n.date)} · {n.symbol}
                    </div>
                  </div>
                  {n.pnl !== undefined && <span className={cn("k-num text-[13px] font-semibold", n.pnl >= 0 ? "text-up" : "text-down")}>{n.pnl >= 0 ? "+" : "-"}{formatMoney(Math.abs(n.pnl))}</span>}
                </div>
                <p className="mt-2 line-clamp-2 text-[12.5px] leading-relaxed text-fg-2">{n.body}</p>
                <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-2.5">
                  <Chip size="sm" tone={M.tone}>
                    <M.icon className="size-3" /> {M.label}
                  </Chip>
                  {n.tags.map((t) => (
                    <span key={t} className="rounded-full bg-surface-3 px-2 py-0.5 font-mono text-[10.5px] text-fg-3">
                      #{t}
                    </span>
                  ))}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </Card>
  );
}
